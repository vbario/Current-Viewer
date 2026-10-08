// Schematic wiring derived from the netlist.
//
// The schematic view does not draw the breadboard or the stored wire routes.
// Each electrical net (part pins joined by wires and breadboard strips) is
// drawn as one tidy orthogonal tree, grown Steiner-style from its pins: start
// at one pin, then repeatedly attach the nearest remaining pin to the nearest
// point of the tree, choosing among many L/Z/U-shaped candidates the one that
// avoids part bodies, other nets, and other pins.

import { PARTS, pinPosition, pinDirection, partBox, SCHEMATIC_GRID } from './parts.js';

const G = SCHEMATIC_GRID;

// ---------------------------------------------------------------------------
// Netlist

const RAIL = /(Plus|Minus)$/;

/** Canonical union–find key for a wire endpoint, or null when it is invalid. */
function endpointKey(endpoint, byId) {
  if (typeof endpoint !== 'string') return null;
  const parts = endpoint.split(':'), c = byId.get(parts[0]);
  if (!c) return null;
  if (c.type === 'breadboard') {
    const [, row, col] = parts;
    if (parts.length !== 3 || !row || !/^\d+$/.test(col)) return null;
    if (RAIL.test(row)) return `${c.id}:${row}`;
    if (row.length === 1 && 'abcde'.includes(row)) return `${c.id}:upper:${Number(col)}`;
    if (row.length === 1 && 'fghij'.includes(row)) return `${c.id}:lower:${Number(col)}`;
    return null;
  }
  const part = PARTS[c.type];
  if (!part || parts.length !== 2 || !/^\d+$/.test(parts[1]) || Number(parts[1]) >= part.pins.length) return null;
  return `${c.id}:${Number(parts[1])}`;
}

/** Electrical nets: [{ key, pins }]. Ground parts are not joined to each other here. */
export function localNets(components, wires) {
  const byId = new Map();
  for (const c of components || []) if (c && typeof c.id === 'string' && !byId.has(c.id)) byId.set(c.id, c);
  const parent = new Map();
  const find = k => {
    if (!parent.has(k)) { parent.set(k, k); return k; }
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r);
    while (parent.get(k) !== r) { const next = parent.get(k); parent.set(k, r); k = next; }
    return r;
  };
  const pins = [];
  for (const c of byId.values()) {
    const part = PARTS[c.type];
    if (!part || c.type === 'breadboard') continue;
    for (let i = 0; i < part.pins.length; i++) { const pin = `${c.id}:${i}`; pins.push(pin); find(pin); }
  }
  for (const w of wires || []) {
    const a = w && endpointKey(w.from, byId), b = w && endpointKey(w.to, byId);
    if (!a || !b) continue;
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  }
  const groups = new Map();
  for (const pin of pins) {
    const r = find(pin);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(pin);
  }
  return [...groups.values()].map(list => ({ key: list[0], pins: list }));
}

// ---------------------------------------------------------------------------
// Geometry helpers. Directions: 0 right, 1 down, 2 left, 3 up.

const DIR_INDEX = { right: 0, down: 1, left: 2, up: 3 };
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const tidy = v => Math.round(v * 1000) / 1000;
const keyOf = (x, y) => `${x},${y}`;
const dirOf = (a, b) => (a.y === b.y ? (b.x > a.x ? 0 : 2) : (b.y > a.y ? 1 : 3));
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Scoring weights, in drawing units of wire length.
const W = {
  bend: 14,          // per corner
  body: 2000,        // segment through a part body
  graze: 40,         // segment running along a part outline
  overlap: 5000,     // collinear on another net's wire (looks like a short)
  overlapUnit: 20,   // … plus per unit of shared length
  touch: 3000,       // point contact with another net's wire or pin
  cross: 26,         // clean crossing of another net's wire
  ownPin: 120,       // passing over an unattached pin of the same net
  escape: 40,        // passing through the lead-out cell in front of another net's pin
  side: 50,          // leaving or joining a pin sideways
  back: 200,         // leaving or joining a pin from behind
  crowded: 40,       // joining at a node that already has three branches
};
const INSET = 3;                     // part bodies are shrunk so lead tips stay reachable
const OFFSETS = [0, -G, G, -2 * G, 2 * G, -3 * G, 3 * G];
const TARGETS = 4;                   // attach points tried per connection
const WIDE_TARGETS = 16, WIDE_REACH = 10; // second attempt when every candidate is blocked
const HEAVY = 1000;                  // penalty that marks a connection as blocked
const MAZE_MARGIN = 6, MAZE_CELLS = 40000, MAZE_STEPS = 60000; // bounds for the A* fallback
const CELL = 80;                     // body bucket size

const leavePenalty = (pinDir, dir) => (pinDir === dir ? 0 : (pinDir + 2) % 4 === dir ? W.back : W.side);

/** Segments of all nets, bucketed by the line they run along. */
class LineIndex {
  constructor() { this.lines = new Map(); this.keys = []; }
  add(line, lo, hi, net) {
    let list = this.lines.get(line);
    if (!list) {
      this.lines.set(line, list = []);
      const keys = this.keys;
      let i = keys.length;
      keys.push(line);
      while (i > 0 && keys[i - 1] > line) { keys[i] = keys[i - 1]; i--; }
      keys[i] = line;
    }
    list.push({ lo, hi, net });
  }
  /** Index of the first key ≥ value. */
  lower(value) {
    let lo = 0, hi = this.keys.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.keys[mid] < value) lo = mid + 1; else hi = mid; }
    return lo;
  }
}

class PointIndex {
  constructor() { this.byY = new Map(); this.byX = new Map(); }
  add(x, y, item) {
    if (!this.byY.has(y)) this.byY.set(y, []);
    if (!this.byX.has(x)) this.byX.set(x, []);
    this.byY.get(y).push({ at: x, ...item });
    this.byX.get(x).push({ at: y, ...item });
  }
}

class BoxIndex {
  constructor(boxes) {
    this.cells = new Map(); this.stamp = 0; this.grazes = 0;
    for (const box of boxes) {
      box.mark = 0;
      for (let cx = Math.floor(box.x1 / CELL); cx <= Math.floor(box.x2 / CELL); cx++)
        for (let cy = Math.floor(box.y1 / CELL); cy <= Math.floor(box.y2 / CELL); cy++) {
          const k = cx * 65536 + cy;
          if (!this.cells.has(k)) this.cells.set(k, []);
          this.cells.get(k).push(box);
        }
    }
  }
  /** Number of part bodies an axis-aligned segment passes through. Also sets
   * `grazes`: bodies whose outline the segment runs along. */
  hits(x1, y1, x2, y2) {
    const stamp = ++this.stamp, horizontal = y1 === y2;
    let count = 0, grazes = 0;
    for (let cx = Math.floor((x1 - 2 * INSET) / CELL); cx <= Math.floor((x2 + 2 * INSET) / CELL); cx++)
      for (let cy = Math.floor((y1 - 2 * INSET) / CELL); cy <= Math.floor((y2 + 2 * INSET) / CELL); cy++) {
        const list = this.cells.get(cx * 65536 + cy);
        if (list) for (const b of list) {
          if (b.mark === stamp) continue;
          b.mark = stamp;
          if (x2 >= b.x1 && x1 <= b.x2 && y2 >= b.y1 && y1 <= b.y2) count++;
          else if (horizontal
            ? Math.min(x2, b.x2) > Math.max(x1, b.x1) && y1 >= b.y1 - 2 * INSET && y1 <= b.y2 + 2 * INSET
            : Math.min(y2, b.y2) > Math.max(y1, b.y1) && x1 >= b.x1 - 2 * INSET && x1 <= b.x2 + 2 * INSET) grazes++;
        }
      }
    this.grazes = grazes;
    return count;
  }
}

class MinHeap {
  constructor() { this.keys = []; this.items = []; }
  get size() { return this.keys.length; }
  push(key, item) {
    const keys = this.keys, items = this.items;
    let i = keys.length;
    keys.push(key); items.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      keys[i] = keys[parent]; items[i] = items[parent]; i = parent;
    }
    keys[i] = key; items[i] = item;
  }
  pop() {
    const keys = this.keys, items = this.items, top = [keys[0], items[0]];
    const key = keys.pop(), item = items.pop(), n = keys.length;
    if (n) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && keys[child + 1] < keys[child]) child++;
        if (keys[child] >= key) break;
        keys[i] = keys[child]; items[i] = items[child]; i = child;
      }
      keys[i] = key; items[i] = item;
    }
    return top;
  }
}

/** Remove zero-length steps and merge straight runs; null when the path doubles back or crosses itself. */
function normalize(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], last = out[out.length - 1];
    if (p.x === last.x && p.y === last.y) continue;
    if (p.x !== last.x && p.y !== last.y) return null;
    if (out.length > 1) {
      const d1 = dirOf(out[out.length - 2], last), d2 = dirOf(last, p);
      if (d1 === d2) { out[out.length - 1] = p; continue; }
      if ((d1 + 2) % 4 === d2) return null;
    }
    out.push(p);
  }
  if (out.length > 3) {
    for (let i = 0; i < out.length - 1; i++) for (let j = i + 2; j < out.length - 1; j++)
      if (segmentsMeet(out[i], out[i + 1], out[j], out[j + 1])) return null;
  }
  return out;
}

function segmentsMeet(a, b, c, d) {
  return Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x))
    && Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <= Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y));
}

function pathLength(pts) {
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += manhattan(pts[i - 1], pts[i]);
  return length;
}

/** Candidate positions for the middle run of a Z between coordinates a and b. */
function spans(a, b, wide) {
  const lo = Math.min(a, b), hi = Math.max(a, b), mid = Math.round((a + b) / 2 / G) * G, out = [a, b];
  for (const o of OFFSETS) out.push(mid + o);
  for (let k = 1; k <= (wide ? WIDE_REACH : 3); k++) out.push(lo - k * G, hi + k * G);
  if (wide) for (let v = Math.ceil(lo / G) * G; v <= hi; v += G) out.push(v);
  return out.filter((v, i) => out.indexOf(v) === i);
}

// ---------------------------------------------------------------------------
// Router

/** Orthogonal schematic wiring for every net with two or more pins. */
export function routeSchematic(components, wires) {
  const list = localNets(components, wires);
  const byId = new Map();
  for (const c of components || []) if (c && typeof c.id === 'string' && !byId.has(c.id)) byId.set(c.id, c);

  // Pin geometry and static obstacles.
  const pinInfo = new Map(), pins = new PointIndex(), escapes = new PointIndex(), unconnected = [];
  list.forEach((net, n) => {
    for (const pin of net.pins) {
      const [id, index] = pin.split(':'), c = byId.get(id), p = pinPosition(c, Number(index), 'schematic');
      const info = { pin, x: tidy(p.x), y: tidy(p.y), dir: DIR_INDEX[pinDirection(c, Number(index), 'schematic')], net: n };
      pinInfo.set(pin, info);
      pins.add(info.x, info.y, { net: n, pin });
      if (net.pins.length > 1) escapes.add(info.x + DX[info.dir] * G, info.y + DY[info.dir] * G, { net: n });
    }
    if (net.pins.length === 1) unconnected.push(net.pins[0]);
  });
  const boxes = [];
  for (const c of byId.values()) {
    if (c.type === 'breadboard' || !PARTS[c.type]?.schematic) continue;
    const b = partBox(c, 'schematic');
    if (b.w > 2 * INSET && b.h > 2 * INSET) boxes.push({ x1: b.x + INSET, y1: b.y + INSET, x2: b.x + b.w - INSET, y2: b.y + b.h - INSET });
  }
  const bodies = new BoxIndex(boxes);
  let H, V; // wire segments of the nets routed so far

  /** Cost of one straight run a→b for net n: length, bodies, other nets, pins. */
  function segmentCost(a, b, st, srcPin) {
    const n = st.n;
    let cost = manhattan(a, b);
    if (a.y === b.y) {
      const y = a.y, lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
      cost += W.body * bodies.hits(lo, y, hi, y) + W.graze * bodies.grazes;
      const same = H.lines.get(y);
      if (same) for (const s of same) {
        if (s.net === n) continue;
        const overlap = Math.min(hi, s.hi) - Math.max(lo, s.lo);
        if (overlap > 0) cost += W.overlap + overlap * W.overlapUnit;
        else if (overlap === 0) cost += W.touch;
      }
      for (let i = V.lower(lo); i < V.keys.length && V.keys[i] <= hi; i++) {
        const x = V.keys[i];
        for (const s of V.lines.get(x)) {
          if (s.net === n || s.lo > y || s.hi < y) continue;
          cost += x > lo && x < hi && y > s.lo && y < s.hi ? W.cross : W.touch;
        }
      }
      const row = pins.byY.get(y);
      if (row) for (const p of row) if (p.at >= lo && p.at <= hi) cost += pinCost(p, st, srcPin);
      const esc = escapes.byY.get(y);
      if (esc) for (const p of esc) if (p.net !== n && p.at >= lo && p.at <= hi) cost += W.escape;
    } else {
      const x = a.x, lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
      cost += W.body * bodies.hits(x, lo, x, hi) + W.graze * bodies.grazes;
      const same = V.lines.get(x);
      if (same) for (const s of same) {
        if (s.net === n) continue;
        const overlap = Math.min(hi, s.hi) - Math.max(lo, s.lo);
        if (overlap > 0) cost += W.overlap + overlap * W.overlapUnit;
        else if (overlap === 0) cost += W.touch;
      }
      for (let i = H.lower(lo); i < H.keys.length && H.keys[i] <= hi; i++) {
        const y = H.keys[i];
        for (const s of H.lines.get(y)) {
          if (s.net === n || s.lo > x || s.hi < x) continue;
          cost += y > lo && y < hi && x > s.lo && x < s.hi ? W.cross : W.touch;
        }
      }
      const col = pins.byX.get(x);
      if (col) for (const p of col) if (p.at >= lo && p.at <= hi) cost += pinCost(p, st, srcPin);
      const esc = escapes.byX.get(x);
      if (esc) for (const p of esc) if (p.net !== n && p.at >= lo && p.at <= hi) cost += W.escape;
    }
    return cost;
  }

  function pinCost(p, st, srcPin) {
    if (p.net !== st.n) return W.touch;
    return p.pin === srcPin || st.attached.has(p.pin) ? 0 : W.ownPin;
  }

  /** Distance from a along a→b to the first point that touches the net's own tree (0 excluded). */
  function ownContact(st, a, b) {
    let best = Infinity;
    if (!st.segs.length) {
      const r = st.root;
      if (r.x >= Math.min(a.x, b.x) && r.x <= Math.max(a.x, b.x) && r.y >= Math.min(a.y, b.y) && r.y <= Math.max(a.y, b.y)) best = manhattan(a, r);
      return best > 0 ? best : Infinity;
    }
    const horizontal = a.y === b.y;
    const c = horizontal ? a.y : a.x, from = horizontal ? a.x : a.y, to = horizontal ? b.x : b.y;
    const lo = Math.min(from, to), hi = Math.max(from, to), forward = to > from;
    for (const s of st.segs) {
      let d;
      if (s.h === horizontal) {
        if (s.c !== c || s.hi < lo || s.lo > hi) continue;
        d = Math.abs((forward ? Math.max(lo, s.lo) : Math.min(hi, s.hi)) - from);
      } else {
        if (s.c < lo || s.c > hi || c < s.lo || c > s.hi) continue;
        d = Math.abs(s.c - from);
      }
      if (d > 0 && d < best) best = d;
    }
    return best;
  }

  /** Full score of a candidate path, truncated at its first contact with the own tree. */
  function evaluate(pts, st, src, best) {
    let cost = 0, reached = false;
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      let b = pts[i];
      const d = ownContact(st, a, b);
      if (d !== Infinity) {
        const dir = dirOf(a, b);
        b = { x: a.x + DX[dir] * d, y: a.y + DY[dir] * d };
        reached = true;
      }
      cost += segmentCost(a, b, st, src.pin);
      out.push(b);
      if (reached || cost >= best) break;
    }
    if (!reached) return null;
    cost += (out.length - 2) * W.bend + leavePenalty(src.dir, dirOf(out[0], out[1]));
    const end = out[out.length - 1], k = keyOf(end.x, end.y), node = st.nodeAt.get(k);
    if (node !== undefined) {
      const pinDir = st.pinDirAt.get(k);
      if (pinDir !== undefined) cost += leavePenalty(pinDir, dirOf(end, out[out.length - 2]));
      if (st.deg[node] >= 3) cost += W.crowded;
    }
    return { cost, pts: out };
  }

  /** Points on the tree worth attaching to, nearest first. */
  function targets(st, S, Sx, wide) {
    if (!st.segs.length) return [st.root];
    const found = [], seen = new Set();
    for (const s of st.segs) for (const q of [S, Sx]) {
      const along = Math.max(s.lo, Math.min(s.hi, s.h ? q.x : q.y));
      const p = s.h ? { x: along, y: s.c } : { x: s.c, y: along }, k = keyOf(p.x, p.y);
      if (seen.has(k)) continue;
      seen.add(k); p.d = manhattan(S, p); found.push(p);
    }
    found.sort((a, b) => a.d - b.d);
    return found.slice(0, wide ? WIDE_TARGETS : TARGETS);
  }

  /** Cheapest way to join pin `src` to the net's tree. Candidates are Z
   * shapes (L shapes and U detours included) between the pin or its lead-out
   * point and each target or its lead-in point. A few obvious shapes set the
   * bar; the rest are enumerated by a cheap length bound and only built and
   * scored while they can still beat it. */
  function connect(st, src, wide) {
    const S = { x: src.x, y: src.y }, Sx = { x: src.x + DX[src.dir] * G, y: src.y + DY[src.dir] * G };
    let best = null;
    const attempt = (end, family, m) => {
      const { starts, tail, A, B, T, pinDir } = end;
      const mid = family === 0 ? [{ x: m, y: A.y }, { x: m, y: B.y }] : [{ x: A.x, y: m }, { x: B.x, y: m }];
      const pts = normalize([...starts, ...mid, ...tail]);
      if (!pts) return;
      if (best) {
        let lb = pathLength(pts) + (pts.length - 2) * W.bend + leavePenalty(src.dir, dirOf(pts[0], pts[1]));
        if (pinDir !== undefined) lb += leavePenalty(pinDir, dirOf(T, pts[pts.length - 2]));
        if (lb >= best.cost) return;
      }
      const result = evaluate(pts, st, src, best ? best.cost : Infinity);
      if (result && (!best || result.cost < best.cost)) best = result;
    };
    const ends = [];
    for (const T of targets(st, S, Sx, wide)) {
      const pinDir = st.pinDirAt.get(keyOf(T.x, T.y)), tails = [[T]];
      if (pinDir !== undefined) tails.push([{ x: T.x + DX[pinDir] * G, y: T.y + DY[pinDir] * G }, T]);
      for (const starts of [[S], [S, Sx]]) for (const tail of tails) {
        const A = starts[starts.length - 1], B = tail[0];
        ends.push({ starts, tail, A, B, T, pinDir, fixed: (starts.length + tail.length - 2) * G });
      }
    }
    // Obvious shapes to the nearest target: both L shapes and both centred Zs.
    for (const end of ends) {
      if (end.T !== ends[0].T) break;
      const { A, B } = end;
      attempt(end, 0, B.x); attempt(end, 1, B.y);
      attempt(end, 0, Math.round((A.x + B.x) / 2 / G) * G); attempt(end, 1, Math.round((A.y + B.y) / 2 / G) * G);
    }
    const bounds = [], codes = [];
    for (let e = 0; e < ends.length; e++) {
      const { A, B, fixed } = ends[e], dx = Math.abs(A.x - B.x), dy = Math.abs(A.y - B.y);
      if (best && fixed + dx + dy >= best.cost) continue;
      for (const m of spans(A.x, B.x, wide)) {
        const bound = fixed + Math.abs(A.x - m) + Math.abs(m - B.x) + dy;
        if (!best || bound < best.cost) { bounds.push(bound); codes.push(e, 0, m); }
      }
      for (const m of spans(A.y, B.y, wide)) {
        const bound = fixed + Math.abs(A.y - m) + Math.abs(m - B.y) + dx;
        if (!best || bound < best.cost) { bounds.push(bound); codes.push(e, 1, m); }
      }
    }
    const order = Array.from(bounds.keys()).sort((a, b) => bounds[a] - bounds[b] || a - b);
    for (const i of order) {
      if (best && bounds[i] >= best.cost) break;
      attempt(ends[codes[3 * i]], codes[3 * i + 1], codes[3 * i + 2]);
    }
    // An L shape to the nearest target always builds and is scored in full, so `best` exists.
    best.penalty = best.cost - pathLength(best.pts) - (best.pts.length - 2) * W.bend;
    return best;
  }

  /** Grid A* from pin `src` to the nearest point of the tree, for when every
   * simple shape is blocked. Returns a scored path or null. */
  function maze(st, src) {
    const S = { x: src.x, y: src.y }, Sx = { x: S.x + DX[src.dir] * G, y: S.y + DY[src.dir] * G };
    const goals = targets(st, S, Sx, true);
    let x1 = S.x, x2 = S.x, y1 = S.y, y2 = S.y;
    for (const p of goals) { x1 = Math.min(x1, p.x); x2 = Math.max(x2, p.x); y1 = Math.min(y1, p.y); y2 = Math.max(y2, p.y); }
    const margin = MAZE_MARGIN * G;
    x1 = S.x - Math.ceil((S.x - x1 + margin) / G) * G; y1 = S.y - Math.ceil((S.y - y1 + margin) / G) * G;
    const nx = Math.ceil((x2 + margin - x1) / G) + 1, ny = Math.ceil((y2 + margin - y1) / G) + 1;
    if (nx * ny > MAZE_CELLS) return null;
    const size = nx * ny * 4, cost = new Float64Array(size).fill(Infinity), from = new Int32Array(size).fill(-1);
    const heap = new MinHeap(), goalCache = new Map();
    const h = (x, y) => { let d = Infinity; for (const p of goals) d = Math.min(d, Math.abs(p.x - x) + Math.abs(p.y - y)); return d; };
    const isGoal = (x, y) => {
      const k = keyOf(x, y);
      if (!goalCache.has(k)) goalCache.set(k, onTree(st, { x, y }));
      return goalCache.get(k);
    };
    const push = (ix, iy, d, g, prev) => {
      const id = (iy * nx + ix) * 4 + d;
      if (g >= cost[id]) return;
      cost[id] = g; from[id] = prev;
      heap.push(g + h(x1 + ix * G, y1 + iy * G), id);
    };
    const sx = (S.x - x1) / G, sy = (S.y - y1) / G;
    const step = (ix, iy, d, g, prev) => {
      const jx = ix + DX[d], jy = iy + DY[d];
      if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) return;
      const a = { x: x1 + ix * G, y: y1 + iy * G }, b = { x: x1 + jx * G, y: y1 + jy * G };
      push(jx, jy, d, g + stepCost(a, b, d, st, src.pin), prev);
    };
    for (let d = 0; d < 4; d++) step(sx, sy, d, leavePenalty(src.dir, d), -2 - d);
    let found = -1, expanded = 0;
    while (heap.size && expanded++ < MAZE_STEPS) {
      const [f, id] = heap.pop();
      const d = id & 3, cell = id >> 2, ix = cell % nx, iy = (cell - ix) / nx, g = cost[id];
      if (f - h(x1 + ix * G, y1 + iy * G) > g + 1e-9) continue; // stale entry
      if (isGoal(x1 + ix * G, y1 + iy * G)) { found = id; break; }
      for (const turn of [0, 1, 3]) step(ix, iy, (d + turn) % 4, g + (turn ? W.bend : 0), id);
    }
    if (found < 0) return null;
    const pts = [];
    for (let id = found; id >= 0; id = from[id]) { const cell = id >> 2; pts.push({ x: x1 + (cell % nx) * G, y: y1 + Math.floor(cell / nx) * G }); }
    pts.push(S);
    const path = normalize(pts.reverse());
    const result = path && evaluate(path, st, src, Infinity);
    if (result) result.penalty = result.cost - pathLength(result.pts) - (result.pts.length - 2) * W.bend;
    return result;
  }

  /** Cost of one grid step a→b in direction `dir`; contacts are charged at b only. */
  function stepCost(a, b, dir, st, srcPin) {
    const horizontal = dir % 2 === 0, line = horizontal ? a.y : a.x;
    const from = horizontal ? a.x : a.y, to = horizontal ? b.x : b.y, lo = Math.min(from, to), hi = Math.max(from, to);
    let cost = G + W.body * bodies.hits(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)) + W.graze * bodies.grazes;
    const same = (horizontal ? H : V).lines.get(line);
    if (same) for (const s of same) {
      if (s.net === st.n) continue;
      const overlap = Math.min(hi, s.hi) - Math.max(lo, s.lo);
      if (overlap > 0) cost += W.overlap + overlap * W.overlapUnit;
      else if (overlap === 0 && (s.lo === to || s.hi === to)) cost += W.touch;
    }
    const across = (horizontal ? V : H).lines.get(to);
    if (across) for (const s of across) if (s.net !== st.n && s.lo <= line && line <= s.hi) cost += s.lo < line && line < s.hi ? W.cross : W.touch;
    const row = (horizontal ? pins.byY : pins.byX).get(line);
    if (row) for (const q of row) if (q.at === to) cost += pinCost(q, st, srcPin);
    const esc = (horizontal ? escapes.byY : escapes.byX).get(line);
    if (esc) for (const q of esc) if (q.net !== st.n && q.at === to) cost += W.escape;
    return cost;
  }

  // Per-net tree state.
  function addNode(st, p) {
    const k = keyOf(p.x, p.y);
    let i = st.nodeAt.get(k);
    if (i === undefined) { i = st.nodes.length; st.nodes.push({ x: p.x, y: p.y }); st.nodeAt.set(k, i); st.deg.push(0); }
    return i;
  }

  /** Node index at p, splitting the tree edge that passes through p if needed. */
  function nodeOnTree(st, p) {
    const existing = st.nodeAt.get(keyOf(p.x, p.y));
    if (existing !== undefined) return existing;
    for (let e = 0; e < st.edges.length; e++) {
      const { a, b } = st.edges[e], A = st.nodes[a], B = st.nodes[b];
      const inside = A.y === B.y
        ? p.y === A.y && p.x > Math.min(A.x, B.x) && p.x < Math.max(A.x, B.x)
        : p.x === A.x && p.y > Math.min(A.y, B.y) && p.y < Math.max(A.y, B.y);
      if (!inside) continue;
      const m = addNode(st, p);
      st.edges[e] = { a, b: m };
      st.edges.push({ a: m, b });
      st.deg[m] = 2;
      return m;
    }
    return undefined;
  }

  function onTree(st, p) {
    if (!st.segs.length) return st.root.x === p.x && st.root.y === p.y;
    return st.segs.some(s => (s.h ? s.c === p.y && p.x >= s.lo && p.x <= s.hi : s.c === p.x && p.y >= s.lo && p.y <= s.hi));
  }

  /** Add a path from pin `src` (pts[0]) to a point on the tree (last point). */
  function commit(st, src, pts) {
    st.attached.add(src.pin);
    if (pts.length < 2) { // the pin already lies on the tree
      const node = nodeOnTree(st, pts[0]);
      st.pinNodes[src.pin] = node; st.deg[node]++;
      return;
    }
    const end = nodeOnTree(st, pts[pts.length - 1]);
    let prev = addNode(st, pts[0]);
    st.pinNodes[src.pin] = prev; st.deg[prev]++;
    st.pinDirAt.set(keyOf(pts[0].x, pts[0].y), src.dir);
    for (let i = 1; i < pts.length; i++) {
      const node = i === pts.length - 1 ? end : addNode(st, pts[i]);
      st.edges.push({ a: prev, b: node }); st.deg[prev]++; st.deg[node]++;
      const a = pts[i - 1], b = pts[i], h = a.y === b.y;
      const seg = h ? { h, c: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) } : { h, c: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) };
      st.segs.push(seg);
      (h ? H : V).add(seg.c, seg.lo, seg.hi, st.n);
      prev = node;
    }
  }

  const segDistance = (s, p) => (s.h
    ? Math.abs(p.y - s.c) + Math.max(0, s.lo - p.x, p.x - s.hi)
    : Math.abs(p.x - s.c) + Math.max(0, s.lo - p.y, p.y - s.hi));

  function routeNet(n) {
    const members = list[n].pins.map(pin => pinInfo.get(pin));
    const root = members[0];
    const st = {
      n, root: { x: root.x, y: root.y }, nodes: [], nodeAt: new Map(), deg: [], edges: [], segs: [],
      pinNodes: {}, pinDirAt: new Map(), attached: new Set([root.pin]), penalty: 0, blocked: false,
    };
    const r = addNode(st, root);
    st.pinNodes[root.pin] = r; st.deg[r] = 1; st.pinDirAt.set(keyOf(root.x, root.y), root.dir);
    const rest = members.slice(1), dist = rest.map(p => manhattan(p, root));
    let seen = 0;
    while (rest.length) {
      let pick = 0;
      for (let i = 1; i < rest.length; i++) if (dist[i] < dist[pick]) pick = i;
      const src = rest[pick];
      rest.splice(pick, 1); dist.splice(pick, 1);
      const S = { x: src.x, y: src.y };
      if (onTree(st, S)) commit(st, src, [S]);
      else {
        let best = connect(st, src, false);
        if (best.penalty >= HEAVY) {
          const wider = connect(st, src, true);
          if (wider.cost < best.cost) best = wider;
        }
        if (best.penalty >= HEAVY) {
          const routed = maze(st, src);
          if (routed && routed.cost < best.cost) best = routed;
        }
        st.penalty += best.penalty;
        if (best.penalty >= HEAVY) st.blocked = true;
        commit(st, src, best.pts);
      }
      for (let s = seen; s < st.segs.length; s++) for (let i = 0; i < rest.length; i++) dist[i] = Math.min(dist[i], segDistance(st.segs[s], rest[i]));
      seen = st.segs.length;
    }
    return st;
  }

  // Short, local nets first; sprawling ones find their way around them.
  const order = list.map((net, n) => n).filter(n => list[n].pins.length > 1);
  const spread = order.map(n => {
    const ps = list[n].pins.map(pin => pinInfo.get(pin));
    const xs = ps.map(p => p.x), ys = ps.map(p => p.y);
    return Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys);
  });
  const rank = new Map(order.map((n, i) => [n, spread[i]]));
  order.sort((a, b) => rank.get(a) - rank.get(b) || a - b);
  const routeAll = sequence => {
    H = new LineIndex(); V = new LineIndex();
    const routed = new Map();
    let penalty = 0;
    for (const n of sequence) { const st = routeNet(n); routed.set(n, st); penalty += st.penalty; }
    return { routed, penalty, blocked: sequence.filter(n => routed.get(n).blocked) };
  };
  let attempt = routeAll(order);
  if (attempt.blocked.length) {
    // Rip up and retry once with the blocked nets routed first.
    const first = new Set(attempt.blocked), retry = routeAll([...attempt.blocked, ...order.filter(n => !first.has(n))]);
    if (retry.penalty < attempt.penalty) attempt = retry;
  }
  const { routed } = attempt;

  const nets = [];
  for (const n of order.slice().sort((a, b) => a - b)) nets.push(finish(list[n], routed.get(n)));
  return { nets, unconnected };
}

function finish(net, st) {
  // st.deg counts each node's wires plus the leads of pins that end there.
  const junctions = st.nodes.filter((p, i) => st.deg[i] >= 3).map(p => ({ x: p.x, y: p.y }));
  return {
    key: net.key, pins: net.pins.slice(),
    nodes: st.nodes, edges: st.edges, pinNodes: st.pinNodes, junctions,
    label: labelSpot(st),
  };
}

function labelSpot(st) {
  let best = null, bestLength = -1;
  for (const { a, b } of st.edges) {
    const A = st.nodes[a], B = st.nodes[b], length = manhattan(A, B) * (A.y === B.y ? 1.25 : 1);
    if (length > bestLength) { best = [A, B]; bestLength = length; }
  }
  if (!best) return { x: st.nodes[0].x + 8, y: st.nodes[0].y - 8, horizontal: true };
  const [A, B] = best, horizontal = A.y === B.y, x = (A.x + B.x) / 2, y = (A.y + B.y) / 2;
  return horizontal ? { x, y: y - 8, horizontal } : { x: x + 8, y, horizontal };
}

// ---------------------------------------------------------------------------
// Currents

/** Signed current (A) along each edge of a net tree, from node `a` to node `b`. */
export function edgeCurrents(net, pinCurrents) {
  const count = net.nodes.length, inject = new Array(count).fill(0);
  for (const [pin, node] of Object.entries(net.pinNodes)) inject[node] -= Number(pinCurrents?.[pin]) || 0;
  const adjacent = Array.from({ length: count }, () => []);
  net.edges.forEach(({ a, b }, e) => { adjacent[a].push([b, e]); adjacent[b].push([a, e]); });
  const parent = new Array(count).fill(-1), parentEdge = new Array(count).fill(-1), order = [], visited = new Array(count).fill(false);
  for (let start = 0; start < count; start++) {
    if (visited[start]) continue;
    visited[start] = true;
    const stack = [start];
    while (stack.length) {
      const v = stack.pop();
      order.push(v);
      for (const [w, e] of adjacent[v]) if (!visited[w]) { visited[w] = true; parent[w] = v; parentEdge[w] = e; stack.push(w); }
    }
  }
  const subtree = inject.slice(), currents = new Array(net.edges.length).fill(0);
  for (let i = order.length - 1; i >= 0; i--) {
    const v = order[i], e = parentEdge[v];
    if (e < 0) continue;
    subtree[parent[v]] += subtree[v];
    // Current leaving v's subtree toward its parent equals the subtree's injection.
    currents[e] = net.edges[e].a === v ? subtree[v] : -subtree[v];
  }
  return currents;
}
