import { PARTS, pinPosition } from './parts.js';

export { PARTS } from './parts.js';

export const initialProject = () => ({
  name: 'My first circuit',
  components: [
    { id: 'board1', type: 'breadboard', x: 572, y: 335, rotation: 0, value: 30 },
    { id: 'bat1', type: 'battery', x: 155, y: 390, rotation: 0, value: 9, schematic: { x: 300, y: 380, rotation: 0 } },
    { id: 'r1', type: 'resistor', x: 507, y: 274, rotation: 0, value: 330, schematic: { x: 580, y: 260, rotation: 0 } },
    { id: 'led1', type: 'led', x: 678, y: 278, rotation: 0, value: 2, color: '#e95f49', schematic: { x: 740, y: 380, rotation: 90 } },
    { id: 'sw1', type: 'switch', x: 507, y: 406, rotation: 0, value: 1, schematic: { x: 420, y: 260, rotation: 0 } },
  ],
  wires: [
    { id: 'w1', from: 'bat1:0', to: 'sw1:0', color: '#dc6a52', via: [{ x: 118, y: 183 }, { x: 294, y: 183 }, { x: 294, y: 406 }] },
    { id: 'w2', from: 'sw1:1', to: 'r1:0', color: '#d5a143', via: [{ x: 564, y: 406 }, { x: 564, y: 333 }, { x: 450, y: 333 }, { x: 450, y: 274 }] },
    { id: 'w3', from: 'r1:1', to: 'led1:0', color: '#78977b', via: [{ x: 602, y: 274 }, { x: 602, y: 310 }] },
    { id: 'w4', from: 'led1:1', to: 'bat1:1', color: '#687b8d', via: [{ x: 811, y: 310 }, { x: 811, y: 487 }, { x: 193, y: 487 }] },
  ],
});

export function terminalPosition(component, pin) {
  return pinPosition(component, pin, 'model');
}

export function endpointPosition(endpoint, components) {
  const [id, pin, col] = endpoint.split(':');
  const c = components.find(c => c.id === id);
  if (!c) return { x: 0, y: 0 };
  if (c.type === 'breadboard') {
    const ys = { topPlus: -125, topMinus: -109, a: -93, b: -77, c: -61, d: -45, e: -29, f: 23, g: 39, h: 55, i: 71, j: 87, bottomPlus: 112, bottomMinus: 128 };
    return { x: c.x - 247 + Number(col) * 19, y: c.y + ys[pin] };
  }
  return terminalPosition(c, Number(pin));
}

export function canonical(endpoint) {
  const [id, row, col] = endpoint.split(':');
  if (col === undefined) return endpoint;
  if (row === 'upper' || row === 'lower') return endpoint;
  if (row.endsWith('Plus') || row.endsWith('Minus')) return `${id}:${row}`;
  return `${id}:${'abcde'.includes(row) ? 'upper' : 'lower'}:${col}`;
}

function gaussian(a, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    [a[i], a[pivot]] = [a[pivot], a[i]]; [b[i], b[pivot]] = [b[pivot], b[i]];
    if (Math.abs(a[i][i]) < 1e-14) return null;
    for (let j = i + 1; j < n; j++) {
      const f = a[j][i] / a[i][i];
      if (!f) continue;
      for (let k = i; k < n; k++) a[j][k] -= f * a[i][k];
      b[j] -= f * b[i];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) sum -= a[i][j] * x[j];
    x[i] = sum / a[i][i];
  }
  return x;
}

const OPEN = 1e12;
const BJT = { vbe: 0.7, rbe: 1, vceSat: 0.2, rce: 1 };
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const nameOf = c => c.label || c.ref || PARTS[c.type].name;

/** Equivalent resistance of simple two-terminal parts. */
function resistance(c) {
  switch (c.type) {
    case 'ldr': return 10 ** (6 - 3 * clamp(c.value, 0, 100) / 100);
    case 'thermistor': return 10000 * Math.exp(3950 * (1 / (c.value + 273.15) - 1 / 298.15));
    case 'capacitor': return OPEN;
    case 'inductor': return 0.5;
    case 'ammeter': return 0.01;
    case 'voltmeter': return 1e7;
    case 'switch': case 'pushbutton': return c.value ? 0.1 : OPEN;
    default: return Math.max(c.value, 0.01);
  }
}

/** Resistive branches as [fromPin, toPin, resistance, series drop]; piecewise
 * linear parts choose their branch from the current operating state. */
function branches(c, state) {
  switch (c.type) {
    case 'potentiometer': {
      const r = Math.max(c.value, 0.02), t = clamp(c.position ?? 50, 0, 100) / 100;
      return [[0, 2, Math.max(r * t, 0.01), 0], [2, 1, Math.max(r * (1 - t), 0.01), 0]];
    }
    case 'spdt': return [[0, 1, c.value ? OPEN : 0.1, 0], [0, 2, c.value ? 0.1 : OPEN, 0]];
    case 'led': return [[0, 1, state ? 10 : OPEN, state ? c.value : 0]];
    case 'diode': return [[0, 1, state ? 0.5 : OPEN, state ? c.value : 0]];
    case 'zener': return [[0, 1, state === 'forward' ? 0.5 : state === 'reverse' ? 2 : OPEN, state === 'forward' ? 0.7 : state === 'reverse' ? -c.value : 0]];
    case 'fuse': return [[0, 1, state ? OPEN : 0.05, 0]];
    default: return [[0, 1, resistance(c), 0]];
  }
}

const initialState = c => c.type === 'zener' ? 'off' : c.type === 'npn' || c.type === 'pnp' ? 'cutoff' : false;

/** Steady-state DC modified nodal analysis. Sources include internal
 * resistance; diodes, LEDs, zeners, and transistors use piecewise-linear
 * models whose operating states are found iteratively. Ground parts share one
 * node, which becomes the 0 V reference; otherwise the first source's negative
 * terminal is the reference. */
export function simulate(components, wires) {
  const parts = components.filter(c => c.type !== 'breadboard' && PARTS[c.type]);
  const parent = {};
  function root(k) { k = canonical(k); if (!parent[k]) parent[k] = k; if (parent[k] !== k) parent[k] = root(parent[k]); return parent[k]; }
  const join = (a, b) => { const ra = root(a), rb = root(b); if (ra !== rb) parent[rb] = ra; };
  const pinsOf = c => PARTS[c.type].pins.map((_, pin) => `${c.id}:${pin}`);
  for (const c of parts) pinsOf(c).forEach(root);
  for (const w of wires) join(w.from, w.to);
  const grounds = parts.filter(c => c.type === 'ground');
  for (const g of grounds.slice(1)) join(`${grounds[0].id}:0`, `${g.id}:0`);
  const sources = parts.filter(c => PARTS[c.type].source);
  const empty = { readings: {}, pinCurrents: {}, pinVoltages: {}, wireCurrents: {}, wireVoltages: {}, voltageReference: null, current: 0, voltage: 0, power: 0, warnings: [], closed: false };
  if (!sources.length) return { ...empty, warnings: ['Add a battery or power supply to power your circuit.'] };

  const reference = grounds.length ? `${grounds[0].id}:0` : `${sources[0].id}:1`;
  const ground = root(reference);
  const nodes = [...new Set(Object.keys(parent).map(root))].filter(n => n !== ground);
  const nodeMap = new Map(nodes.map((n, i) => [n, i]));
  const index = ep => nodeMap.get(root(ep));
  const transistors = parts.filter(c => c.type === 'npn' || c.type === 'pnp');
  const passives = parts.filter(c => !PARTS[c.type].source && c.type !== 'ground' && !transistors.includes(c));
  const sourceVar = c => nodes.length + sources.indexOf(c);
  const baseVar = c => nodes.length + sources.length + 2 * transistors.indexOf(c);
  const state = Object.fromEntries(parts.map(c => [c.id, initialState(c)]));
  const size = nodes.length + sources.length + 2 * transistors.length;
  const transistorNodes = c => {
    const [C, B, E] = [0, 1, 2].map(pin => index(`${c.id}:${pin}`));
    // Forward base junction and conventional collector current directions.
    return c.type === 'npn' ? { bp: B, bn: E, cp: C, cn: E } : { bp: E, bn: B, cp: E, cn: C };
  };
  let solution;

  for (let iteration = 0; iteration < 80; iteration++) {
    const a = Array.from({ length: size }, () => Array(size).fill(0));
    const b = Array(size).fill(0);
    const add = (row, col, value) => { if (row !== undefined && col !== undefined) a[row][col] += value; };
    for (let i = 0; i < nodes.length; i++) a[i][i] = 1e-10;
    for (const c of sources) {
      const s = sourceVar(c), i = index(`${c.id}:0`), j = index(`${c.id}:1`);
      add(i, s, 1); add(s, i, 1); add(j, s, -1); add(s, j, -1);
      a[s][s] = -PARTS[c.type].source.internal; b[s] = c.value;
    }
    for (const c of passives) for (const [from, to, r, drop] of branches(c, state[c.id])) {
      const i = index(`${c.id}:${from}`), j = index(`${c.id}:${to}`), g = 1 / r;
      if (i !== undefined) { a[i][i] += g; b[i] += drop * g; }
      if (j !== undefined) { a[j][j] += g; b[j] -= drop * g; }
      add(i, j, -g); add(j, i, -g);
    }
    for (const c of transistors) {
      const { bp, bn, cp, cn } = transistorNodes(c), ib = baseVar(c), ic = ib + 1, mode = state[c.id];
      add(bp, ib, 1); add(bn, ib, -1); add(cp, ic, 1); add(cn, ic, -1);
      if (mode === 'cutoff') a[ib][ib] = 1;
      else { add(ib, bp, 1); add(ib, bn, -1); a[ib][ib] = -BJT.rbe; b[ib] = BJT.vbe; }
      if (mode === 'active') { a[ic][ic] = 1; a[ic][ib] = -c.value; }
      else if (mode === 'saturation') { add(ic, cp, 1); add(ic, cn, -1); a[ic][ic] = -BJT.rce; b[ic] = BJT.vceSat; }
      else a[ic][ic] = 1;
    }
    solution = gaussian(a, b);
    if (!solution) return { ...empty, warnings: ['This circuit could not be solved. Check the power connections.'] };
    const v = ep => solution[index(ep)] || 0;
    let changed = false;
    const set = (c, next) => { if (next !== state[c.id]) { state[c.id] = next; changed = true; } };
    for (const c of passives) {
      const drop = v(`${c.id}:0`) - v(`${c.id}:1`);
      if (c.type === 'led' || c.type === 'diode') set(c, drop > c.value + 1e-8);
      if (c.type === 'zener') set(c, drop > 0.7 + 1e-8 ? 'forward' : -drop > c.value + 1e-8 ? 'reverse' : 'off');
    }
    for (const c of transistors) {
      const { bp, bn, cp, cn } = transistorNodes(c), at = i => solution[i] || 0;
      const vbe = at(bp) - at(bn), vce = at(cp) - at(cn), ib = solution[baseVar(c)], ic = solution[baseVar(c) + 1];
      const mode = state[c.id];
      if (mode === 'cutoff') { if (vbe > BJT.vbe + 1e-9) set(c, 'active'); }
      else if (ib < -1e-12) set(c, 'cutoff');
      else if (mode === 'active' && vce < BJT.vceSat - 1e-9) set(c, 'saturation');
      else if (mode === 'saturation' && ic > c.value * ib + 1e-12) set(c, 'active');
    }
    // Fuses only blow once every other device has settled, so transient
    // operating-point guesses can't trip them.
    if (!changed) for (const c of passives.filter(c => c.type === 'fuse' && !state[c.id])) {
      if (Math.abs((v(`${c.id}:0`) - v(`${c.id}:1`)) / 0.05) > c.value) set(c, true);
    }
    if (!changed) break;
  }

  const v = ep => solution[index(ep)] || 0;
  const readings = {}, pinCurrents = {}, pinVoltages = {}, warnings = [];
  for (const c of parts) for (const pin of pinsOf(c)) { pinCurrents[pin] = 0; pinVoltages[pin] = v(pin); }
  for (const c of sources) {
    const s = solution[sourceVar(c)];
    pinCurrents[`${c.id}:0`] = s; pinCurrents[`${c.id}:1`] = -s;
    const voltage = v(`${c.id}:0`) - v(`${c.id}:1`);
    readings[c.id] = { voltage, current: -s, power: Math.abs(voltage * s), temperature: 22, active: Math.abs(s) > 0.00001 };
  }
  for (const c of passives) {
    let power = 0;
    for (const [from, to, r, drop] of branches(c, state[c.id])) {
      const across = v(`${c.id}:${from}`) - v(`${c.id}:${to}`), current = (across - drop) / r;
      pinCurrents[`${c.id}:${from}`] += current; pinCurrents[`${c.id}:${to}`] -= current;
      power += Math.abs(across * current);
    }
    const throwPin = c.type === 'spdt' ? (c.value ? 2 : 1) : 1;
    const voltage = v(`${c.id}:0`) - v(`${c.id}:${throwPin}`), current = pinCurrents[`${c.id}:0`];
    readings[c.id] = { voltage, current, power, temperature: 22 + power * (c.type === 'resistor' ? 100 : 30), active: Math.abs(current) > 0.00001, state: state[c.id] };
  }
  for (const c of transistors) {
    const ib = solution[baseVar(c)], ic = solution[baseVar(c) + 1], npn = c.type === 'npn';
    const { bp, bn, cp, cn } = transistorNodes(c), at = i => solution[i] || 0;
    pinCurrents[`${c.id}:0`] = npn ? ic : -ic;
    pinCurrents[`${c.id}:1`] = npn ? ib : -ib;
    pinCurrents[`${c.id}:2`] = npn ? -(ib + ic) : ib + ic;
    const power = Math.abs((at(cp) - at(cn)) * ic) + Math.abs((at(bp) - at(bn)) * ib);
    readings[c.id] = { voltage: v(`${c.id}:0`) - v(`${c.id}:2`), current: ic, baseCurrent: ib, power, temperature: 22 + power * 60, active: Math.abs(ic) > 0.00001, state: state[c.id] };
  }

  // Resolve currents through ideal wires with an incidence matrix. The
  // minimum-norm solution divides current evenly between redundant wires.
  // Ground parts are joined by hidden links standing in for the shared node.
  const wireCurrents = {};
  const wireNodes = [...new Set([...wires.flatMap(w => [canonical(w.from), canonical(w.to)]), ...grounds.map(g => `${g.id}:0`)])];
  const wi = new Map(wireNodes.map((n, i) => [n, i]));
  const hidden = grounds.slice(1).map(g => [wi.get(`${grounds[0].id}:0`), wi.get(`${g.id}:0`), g]);
  if (wireNodes.length) {
    const n = wireNodes.length, matrix = Array.from({ length: n }, () => Array(n).fill(0)), demand = Array(n).fill(0);
    for (let i = 0; i < n; i++) matrix[i][i] = 1e-9;
    for (const c of parts) if (c.type !== 'ground') for (const pin of pinsOf(c)) {
      const i = wi.get(canonical(pin));
      if (i !== undefined) demand[i] -= pinCurrents[pin];
    }
    const edges = [...wires.map(w => [wi.get(canonical(w.from)), wi.get(canonical(w.to))]), ...hidden];
    for (const [i, j] of edges) { matrix[i][i]++; matrix[j][j]++; matrix[i][j]--; matrix[j][i]--; }
    const potentials = gaussian(matrix, demand);
    const flow = (i, j) => potentials ? potentials[i] - potentials[j] : 0;
    for (const w of wires) wireCurrents[w.id] = flow(wi.get(canonical(w.from)), wi.get(canonical(w.to)));
    for (const [i, j, g] of hidden) { pinCurrents[`${grounds[0].id}:0`] += flow(i, j); pinCurrents[`${g.id}:0`] -= flow(i, j); }
  }
  for (const g of grounds) readings[g.id] = { voltage: 0, current: pinCurrents[`${g.id}:0`], power: 0, temperature: 22, active: false };

  const limits = { battery: 1, cell: 0.2, supply: 3 };
  for (const c of parts) {
    const { voltage, current, power } = readings[c.id], name = nameOf(c);
    if (c.type === 'led' && current > 0.03) warnings.push(`${name} is over its 30 mA limit. Increase resistance.`);
    if (c.type === 'led' && voltage < -5) warnings.push(`${name} reverse voltage is too high. Reverse its connections.`);
    if (c.type === 'resistor' && power > 0.25) warnings.push(`${name} exceeds its ¼ W rating and is overheating.`);
    if (c.type === 'potentiometer' && power > 0.5) warnings.push(`${name} exceeds its ½ W rating.`);
    if (PARTS[c.type].source && current > limits[c.type]) warnings.push(`${name} current is very high. Check for a short circuit.`);
    if (c.type === 'diode' && Math.abs(current) > 1) warnings.push(`${name} exceeds its 1 A rating.`);
    if (c.type === 'zener' && power > 0.5) warnings.push(`${name} is dissipating ${power.toFixed(2)} W, above its ½ W rating.`);
    if ((c.type === 'npn' || c.type === 'pnp') && Math.abs(current) > 0.6) warnings.push(`${name} collector current exceeds 600 mA.`);
    if ((c.type === 'npn' || c.type === 'pnp') && power > 0.625) warnings.push(`${name} is dissipating ${power.toFixed(2)} W and overheating.`);
    if (c.type === 'fuse' && state[c.id]) warnings.push(`${name} blew: current exceeded its ${c.value} A rating.`);
  }
  const current = sources.reduce((s, c) => s + Math.max(0, readings[c.id].current), 0);
  const power = parts.filter(c => !PARTS[c.type].source).reduce((s, c) => s + readings[c.id].power, 0);
  // Ideal wires share one node potential. Report that potential relative to the
  // reference node, rather than the zero drop along a wire.
  const wireVoltages = Object.fromEntries(wires.map(w => [w.id, v(w.from)]));
  return { readings, pinCurrents, pinVoltages, wireCurrents, wireVoltages, voltageReference: reference, current, voltage: sources[0].value, power, warnings, closed: current > 0.00001 };
}
