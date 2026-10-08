import test from 'node:test';
import assert from 'node:assert/strict';
import { localNets, routeSchematic, edgeCurrents } from './schematic.js';
import { initialProject } from './circuit.js';
import { PARTS, pinPosition, pinDirection, partBox } from './parts.js';

const part = (id, type, x, y, rotation = 0) => ({ id, type, x, y, rotation, value: PARTS[type].value, schematic: { x, y, rotation } });
const wire = (from, to) => ({ id: `${from}-${to}`, from, to, color: '#000' });
const board = { id: 'bb', type: 'breadboard', x: 0, y: 0, rotation: 0, value: 30 };
const netOf = (nets, pin) => nets.find(n => n.pins.includes(pin));
const sameNet = (nets, a, b) => netOf(nets, a) === netOf(nets, b);

/** Axis-aligned segments of every routed net, tagged with the net index. */
function segments(result) {
  return result.nets.flatMap((net, n) => net.edges.map(({ a, b }) => {
    const A = net.nodes[a], B = net.nodes[b], h = A.y === B.y;
    return { n, h, c: h ? A.y : A.x, lo: h ? Math.min(A.x, B.x) : Math.min(A.y, B.y), hi: h ? Math.max(A.x, B.x) : Math.max(A.y, B.y) };
  }));
}

/** Structural checks that must hold for every routed net. */
function assertTrees(result, components) {
  const byId = new Map(components.map(c => [c.id, c]));
  for (const net of result.nets) {
    assert.ok(net.pins.length >= 2, `${net.key} has fewer than two pins`);
    assert.equal(net.edges.length, net.nodes.length - 1, `${net.key} is not a tree`);
    const keys = new Set(net.nodes.map(p => `${p.x},${p.y}`));
    assert.equal(keys.size, net.nodes.length, `${net.key} repeats a node`);
    for (const { a, b } of net.edges) {
      const A = net.nodes[a], B = net.nodes[b];
      assert.ok(A && B, `${net.key} edge refers to a missing node`);
      assert.ok((A.x === B.x) !== (A.y === B.y), `${net.key} edge ${JSON.stringify([A, B])} is not a straight axis-aligned run`);
      for (const v of [A.x, A.y, B.x, B.y]) assert.equal(v % 10, 0, `${net.key} leaves the grid`);
    }
    for (const pin of net.pins) {
      const node = net.pinNodes[pin], [id, i] = pin.split(':');
      assert.ok(Number.isInteger(node), `${pin} has no node`);
      assert.deepEqual(net.nodes[node], pinPosition(byId.get(id), Number(i), 'schematic'));
    }
    // Connected: a walk from node 0 reaches every node.
    const adjacent = net.nodes.map(() => []);
    for (const { a, b } of net.edges) { adjacent[a].push(b); adjacent[b].push(a); }
    const seen = new Set([0]), stack = [0];
    while (stack.length) for (const w of adjacent[stack.pop()]) if (!seen.has(w)) { seen.add(w); stack.push(w); }
    assert.equal(seen.size, net.nodes.length, `${net.key} is not connected`);
  }
}

/** Visual-short checks: overlaps and touches between nets, wires over parts or other nets' pins. */
function conflicts(result, components) {
  const segs = segments(result), found = [];
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i], t = segs[j];
    if (s.n === t.n) continue;
    if (s.h === t.h) {
      if (s.c === t.c && Math.min(s.hi, t.hi) >= Math.max(s.lo, t.lo)) found.push(['overlap', s, t]);
    } else if (t.c >= s.lo && t.c <= s.hi && s.c >= t.lo && s.c <= t.hi && !(t.c > s.lo && t.c < s.hi && s.c > t.lo && s.c < t.hi)) {
      found.push(['touch', s, t]);
    }
  }
  const owner = new Map();
  result.nets.forEach((net, n) => net.pins.forEach(pin => owner.set(pin, n)));
  for (const c of components) {
    if (c.type === 'breadboard') continue;
    const box = partBox(c, 'schematic');
    for (const s of segs) {
      const [x1, y1, x2, y2] = s.h ? [s.lo, s.c, s.hi, s.c] : [s.c, s.lo, s.c, s.hi];
      if (x2 > box.x + 4 && x1 < box.x + box.w - 4 && y2 > box.y + 4 && y1 < box.y + box.h - 4) found.push(['body', c.id, s]);
    }
    PARTS[c.type].pins.forEach((_, i) => {
      const p = pinPosition(c, i, 'schematic'), n = owner.get(`${c.id}:${i}`);
      for (const s of segs) if (s.n !== n && (s.h ? p.y === s.c && p.x >= s.lo && p.x <= s.hi : p.x === s.c && p.y >= s.lo && p.y <= s.hi)) found.push(['pin', `${c.id}:${i}`, s]);
    });
  }
  return found;
}

function transistorSwitch() {
  const components = [
    part('bat1', 'battery', 80, 320), part('sw1', 'switch', 180, 200),
    part('r2', 'resistor', 300, 260, 90), part('r3', 'resistor', 300, 400, 90),
    part('r1', 'resistor', 400, 340), part('q1', 'npn', 520, 340),
    part('led1', 'led', 540, 220, 90), part('r4', 'resistor', 540, 100, 90),
    part('g1', 'ground', 540, 460), part('g2', 'ground', 80, 460), part('g3', 'ground', 300, 500),
  ];
  const wires = [
    wire('bat1:0', 'sw1:0'), wire('sw1:1', 'r4:0'), wire('sw1:1', 'r2:0'),
    wire('r4:1', 'led1:0'), wire('led1:1', 'q1:0'),
    wire('r2:1', 'r3:0'), wire('r3:0', 'r1:0'), wire('r3:1', 'g3:0'), wire('r1:1', 'q1:1'), wire('q1:2', 'g1:0'), wire('bat1:1', 'g2:0'),
  ];
  return { components, wires };
}

/** A deterministic pseudo-random circuit with local wiring. */
function randomCircuit(count, seed, cols = 15, pitch = 160) {
  const types = ['resistor', 'led', 'capacitor', 'diode', 'switch', 'npn', 'potentiometer', 'battery', 'lamp', 'ground', 'spdt', 'motor'];
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const components = [], wires = [];
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(rand() * types.length)];
    components.push(part(`p${i}`, type, 100 + (i % cols) * pitch, 100 + Math.floor(i / cols) * pitch, [0, 90, 180, 270][Math.floor(rand() * 4)]));
  }
  const pins = components.flatMap((c, i) => PARTS[c.type].pins.map((_, k) => ({ pin: `${c.id}:${k}`, col: i % cols, row: Math.floor(i / cols) })));
  for (const p of pins) {
    if (rand() < 0.15) continue;
    const near = pins.filter(q => q !== p && Math.abs(q.col - p.col) <= 2 && Math.abs(q.row - p.row) <= 1);
    const q = near[Math.floor(rand() * near.length)];
    if (q) wires.push(wire(p.pin, q.pin));
  }
  return { components, wires };
}

test('localNets joins breadboard rows a–e and f–j per column only', () => {
  const components = [board, part('r1', 'resistor', 0, 0), part('r2', 'resistor', 200, 0), part('r3', 'resistor', 400, 0), part('r4', 'resistor', 600, 0)];
  const wires = [
    wire('r1:1', 'bb:a:5'), wire('bb:e:5', 'r2:0'), // same column, same half: joined
    wire('r2:1', 'bb:f:7'), wire('bb:e:7', 'r3:0'), // across the centre channel: separate
    wire('r3:1', 'bb:j:9'), wire('bb:j:10', 'r4:0'), // neighbouring columns: separate
  ];
  const nets = localNets(components, wires);
  assert.ok(sameNet(nets, 'r1:1', 'r2:0'));
  assert.ok(!sameNet(nets, 'r2:1', 'r3:0'));
  assert.ok(!sameNet(nets, 'r3:1', 'r4:0'));
  assert.deepEqual(netOf(nets, 'r1:1'), { key: 'r1:1', pins: ['r1:1', 'r2:0'] });
  for (const net of nets) for (const pin of net.pins) assert.ok(!pin.startsWith('bb:'), 'breadboard holes never appear as pins');
  assert.equal(nets.reduce((sum, n) => sum + n.pins.length, 0), 8, 'every component pin appears exactly once');
});

test('localNets joins each power rail across all columns and keeps rails apart', () => {
  const components = [board, part('b', 'battery', 0, 0), part('r1', 'resistor', 200, 0), part('r2', 'resistor', 400, 0)];
  const wires = [
    wire('b:0', 'bb:topPlus:0'), wire('bb:topPlus:29', 'r1:0'),
    wire('b:1', 'bb:topMinus:3'), wire('r1:1', 'bb:topMinus:20'),
    wire('r2:0', 'bb:bottomPlus:4'), wire('r2:1', 'bb:bottomMinus:4'),
  ];
  const nets = localNets(components, wires);
  assert.ok(sameNet(nets, 'b:0', 'r1:0'));
  assert.ok(sameNet(nets, 'b:1', 'r1:1'));
  assert.ok(!sameNet(nets, 'b:0', 'b:1'));
  assert.ok(!sameNet(nets, 'r2:0', 'b:0'), 'top and bottom rails are separate');
  assert.ok(!sameNet(nets, 'r2:0', 'r2:1'));
});

test('localNets orders pins by component then pin, keys nets stably, and skips bad wires', () => {
  const components = [part('a', 'resistor', 0, 0), part('b', 'resistor', 100, 0), part('c', 'npn', 200, 0)];
  const wires = [wire('c:2', 'b:1'), wire('b:1', 'a:0'), wire('ghost:0', 'a:1'), wire('a:1', 'b:7'), { id: 'x', from: 'b:0', color: '#000' }];
  const nets = localNets(components, wires);
  assert.deepEqual(nets.map(n => n.key), ['a:0', 'a:1', 'b:0', 'c:0', 'c:1']);
  assert.deepEqual(netOf(nets, 'c:2').pins, ['a:0', 'b:1', 'c:2']);
  assert.deepEqual(localNets(components, wires.slice().reverse()), nets, 'wire order does not matter');
});

test('ground symbols are not merged: each anchors its own local net', () => {
  const components = [part('b', 'battery', 100, 100), part('r', 'resistor', 300, 100), part('g1', 'ground', 100, 220), part('g2', 'ground', 400, 220)];
  const wires = [wire('b:0', 'r:0'), wire('b:1', 'g1:0'), wire('r:1', 'g2:0')];
  const nets = localNets(components, wires);
  assert.ok(!sameNet(nets, 'g1:0', 'g2:0'));
  assert.deepEqual(netOf(nets, 'g1:0').pins, ['b:1', 'g1:0']);
  assert.deepEqual(netOf(nets, 'g2:0').pins, ['r:1', 'g2:0']);
  const routed = routeSchematic(components, wires);
  assert.equal(routed.nets.length, 3);
  assertTrees(routed, components);
});

test('two facing pins on one row are joined by a single straight wire', () => {
  const components = [part('r1', 'resistor', 100, 100), part('r2', 'resistor', 300, 100)];
  const { nets, unconnected } = routeSchematic(components, [wire('r1:1', 'r2:0')]);
  assert.equal(nets.length, 1);
  assert.deepEqual(nets[0].nodes.slice().sort((a, b) => a.x - b.x), [{ x: 140, y: 100 }, { x: 260, y: 100 }]);
  assert.equal(nets[0].edges.length, 1);
  assert.deepEqual(nets[0].junctions, []);
  assert.deepEqual(unconnected, ['r1:0', 'r2:1']);
  assert.equal(nets[0].label.horizontal, true);
  assert.equal(nets[0].label.x, 200);
  assert.notEqual(nets[0].label.y, 100, 'the label sits off the wire');
});

test('a T-shaped net gets exactly one junction dot at the tee', () => {
  const components = [part('r1', 'resistor', 100, 100), part('r2', 'resistor', 300, 100), part('r3', 'resistor', 200, 200, 90)];
  const wires = [wire('r1:1', 'r2:0'), wire('r2:0', 'r3:0')];
  const result = routeSchematic(components, wires);
  assertTrees(result, components);
  const [net] = result.nets;
  assert.deepEqual(net.junctions, [{ x: 200, y: 100 }]);
  assert.equal(net.nodes.length, 4);
  assert.deepEqual(result.unconnected, ['r1:0', 'r2:1', 'r3:1']);
});

/** Nodes where three or more branches meet, counting each pin's own lead as a branch. */
function expectedJunctions(net) {
  const degree = net.nodes.map(() => 0);
  for (const { a, b } of net.edges) { degree[a]++; degree[b]++; }
  for (const pin of net.pins) degree[net.pinNodes[pin]]++;
  return { degree, junctions: net.nodes.filter((_, i) => degree[i] >= 3) };
}

test('junction dots mark three or more branches, including a pin with two wires, never plain corners', () => {
  const { components, wires } = transistorSwitch();
  let corners = 0;
  for (const net of routeSchematic(components, wires).nets) {
    const { degree, junctions } = expectedJunctions(net);
    assert.deepEqual(net.junctions, junctions);
    corners += degree.filter(d => d === 2).length;
  }
  assert.ok(corners > 0, 'the example has corners, and none of them got a dot');
  // r2's left lead lands exactly on r1's right lead: that pin has two wires (r1's lead and the run to r4).
  const stacked = [part('r1', 'resistor', 100, 100), part('r2', 'resistor', 180, 100), part('r4', 'resistor', 300, 200, 90)];
  const [net] = routeSchematic(stacked, [wire('r1:1', 'r2:0'), wire('r2:0', 'r4:0')]).nets;
  assert.deepEqual(net.junctions, expectedJunctions(net).junctions);
  assert.ok(net.junctions.some(j => j.x === 140 && j.y === 100));
});

test('the dense transistor switch routes without shorts, body crossings, or backwards leads', () => {
  const { components, wires } = transistorSwitch();
  const result = routeSchematic(components, wires);
  assert.equal(result.nets.length, 9);
  assert.deepEqual(result.unconnected, []);
  assertTrees(result, components);
  assert.deepEqual(conflicts(result, components), []);
  const byId = new Map(components.map(c => [c.id, c]));
  const step = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
  for (const net of result.nets) for (const pin of net.pins) {
    const node = net.pinNodes[pin], [id, i] = pin.split(':'), [dx, dy] = step[pinDirection(byId.get(id), Number(i))];
    for (const { a, b } of net.edges) {
      if (a !== node && b !== node) continue;
      const P = net.nodes[node], Q = net.nodes[a === node ? b : a];
      assert.ok(Math.sign(Q.x - P.x) !== -dx || dx === 0, `${pin} leaves backwards`);
      assert.ok(Math.sign(Q.y - P.y) !== -dy || dy === 0, `${pin} leaves backwards`);
    }
  }
});

test('the starter project routes as a clean loop, with and without schematic placements', () => {
  const placed = initialProject();
  const placements = { bat1: { x: 300, y: 380, rotation: 0 }, sw1: { x: 420, y: 260, rotation: 0 }, r1: { x: 580, y: 260, rotation: 0 }, led1: { x: 740, y: 380, rotation: 90 } };
  for (const c of placed.components) if (placements[c.id]) c.schematic = placements[c.id];
  const fallback = initialProject();
  for (const c of fallback.components) delete c.schematic;
  for (const p of [placed, fallback]) {
    const result = routeSchematic(p.components, p.wires);
    const expected = localNets(p.components, p.wires).filter(n => n.pins.length > 1);
    assert.deepEqual(result.nets.map(n => n.pins), expected.map(n => n.pins));
    assertTrees(result, p.components);
    assert.deepEqual(conflicts(result, p.components), []);
    for (const net of result.nets) assert.deepEqual(net.junctions, [], 'a series loop has no junctions');
  }
  const { nets } = routeSchematic(placed.components, placed.wires);
  // The switch-to-resistor net is a single straight run between facing pins.
  const straight = nets.find(n => n.pins.includes('sw1:1') && n.pins.includes('r1:0'));
  assert.equal(straight.edges.length, 1);
});

test('edgeCurrents conserves current at every node of a three-pin net', () => {
  const components = [part('r1', 'resistor', 100, 100), part('r2', 'resistor', 300, 100), part('r3', 'resistor', 200, 200, 90)];
  const [net] = routeSchematic(components, [wire('r1:1', 'r2:0'), wire('r2:0', 'r3:0')]).nets;
  const pinCurrents = { 'r1:1': -0.03, 'r2:0': 0.01, 'r3:0': 0.02 };
  const currents = edgeCurrents(net, pinCurrents);
  assert.equal(currents.length, net.edges.length);
  const balance = net.nodes.map(() => 0);
  for (const [pin, node] of Object.entries(net.pinNodes)) balance[node] -= pinCurrents[pin];
  net.edges.forEach(({ a, b }, e) => { balance[a] -= currents[e]; balance[b] += currents[e]; });
  for (const residual of balance) assert.ok(Math.abs(residual) < 1e-12, `residual ${residual}`);
  // All 30 mA leaves r1's pin along its wire.
  const fromR1 = net.edges.findIndex(({ a, b }) => a === net.pinNodes['r1:1'] || b === net.pinNodes['r1:1']);
  const sign = net.edges[fromR1].a === net.pinNodes['r1:1'] ? 1 : -1;
  assert.ok(Math.abs(sign * currents[fromR1] - 0.03) < 1e-12);
  assert.deepEqual(edgeCurrents(net, {}), currents.map(() => 0), 'missing pin currents count as zero');
});

test('edgeCurrents signs follow each edge’s own a→b orientation', () => {
  // Pin p at node 0 pushes 5 mA into the net; pin q at node 3 draws it. Edges point every which way.
  const net = {
    nodes: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 80, y: 40 }],
    edges: [{ a: 0, b: 1 }, { a: 2, b: 1 }, { a: 2, b: 3 }],
    pinNodes: { 'p:0': 0, 'q:0': 3 },
  };
  assert.deepEqual(edgeCurrents(net, { 'p:0': -0.005, 'q:0': 0.005 }), [0.005, -0.005, 0.005]);
});

test('routing is deterministic', () => {
  const { components, wires } = randomCircuit(40, 5, 8);
  assert.deepEqual(routeSchematic(components, wires), routeSchematic(components, wires));
});

test('random dense circuits keep valid trees and avoid shorts and part bodies', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const { components, wires } = randomCircuit(40, seed, 8);
    const result = routeSchematic(components, wires);
    assertTrees(result, components);
    assert.deepEqual(conflicts(result, components), [], `seed ${seed}`);
  }
});

test('coincident pins and pins sitting on another wire still produce valid trees', () => {
  // r2 overlaps r1's right pin; r3's pin lies on the straight run between r1 and r4.
  const components = [part('r1', 'resistor', 100, 100), part('r2', 'resistor', 180, 100), part('r4', 'resistor', 500, 100), part('r3', 'resistor', 300, 140, 90)];
  const wires = [wire('r1:1', 'r2:0'), wire('r1:1', 'r4:0'), wire('r3:0', 'r4:0')];
  const result = routeSchematic(components, wires);
  assertTrees(result, components);
  const net = result.nets.find(n => n.pins.includes('r1:1'));
  assert.equal(net.pinNodes['r1:1'], net.pinNodes['r2:0']);
});

test('150 parts route well within a drag-frame budget', () => {
  const { components, wires } = randomCircuit(150, 7);
  routeSchematic(components, wires); // warm up
  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const result = routeSchematic(components, wires);
    times.push(performance.now() - start);
    if (i === 0) assertTrees(result, components);
  }
  times.sort((a, b) => a - b);
  assert.ok(times[2] < 150, `median ${times[2].toFixed(1)} ms`);
});
