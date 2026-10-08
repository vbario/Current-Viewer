// Geometric connectivity for drawn schematics (KiCad, LTspice).
// Rules: anything sharing a point connects (wire endpoints, pins, labels,
// junctions); a connection point lying on a wire's interior connects to that
// wire (T-junctions, pins/labels on wires, junction dots on crossings); two
// wire interiors that merely cross do not connect. Named nodes join by name.

export function createNetGraph(precision = 1e4) {
  const parent = new Map();
  const wires = [], points = [];
  let solved = false;

  const find = id => {
    if (!parent.has(id)) parent.set(id, id);
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(id) !== root) { const next = parent.get(id); parent.set(id, root); id = next; }
    return root;
  };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  const q = v => Math.round(v * precision);
  const key = (x, y) => `${q(x)},${q(y)}`;

  return {
    /** Add a wire segment; returns its node id. */
    addWire(x1, y1, x2, y2) {
      const id = `w${wires.length}`;
      wires.push({ id, x1, y1, x2, y2 });
      find(id);
      return id;
    },
    /** Add a connection point (pin, label, flag, junction); returns its node id. */
    addPoint(x, y) {
      const id = `p${points.length}`;
      points.push({ id, x, y });
      find(id);
      return id;
    },
    /** Join a node to a named net (labels, power symbols, flags). */
    joinName(id, name) { union(`name:${name}`, id); },
    union,
    find,
    /** Apply the geometric rules. Call once, after adding everything. */
    solve() {
      if (solved) return;
      solved = true;
      const anchors = [];
      for (const w of wires) { anchors.push({ id: w.id, x: w.x1, y: w.y1 }, { id: w.id, x: w.x2, y: w.y2 }); }
      for (const p of points) anchors.push(p);
      const byKey = new Map();
      for (const a of anchors) {
        const k = key(a.x, a.y);
        const first = byKey.get(k);
        if (first === undefined) byKey.set(k, a.id); else union(first, a.id);
      }
      const horizontal = new Map(), vertical = new Map(), diagonal = [];
      for (const w of wires) {
        if (q(w.y1) === q(w.y2) && q(w.x1) !== q(w.x2)) {
          const k = q(w.y1);
          if (!horizontal.has(k)) horizontal.set(k, []);
          horizontal.get(k).push(w);
        } else if (q(w.x1) === q(w.x2) && q(w.y1) !== q(w.y2)) {
          const k = q(w.x1);
          if (!vertical.has(k)) vertical.set(k, []);
          vertical.get(k).push(w);
        } else if (q(w.x1) !== q(w.x2)) diagonal.push(w);
      }
      for (const a of anchors) {
        const ax = q(a.x), ay = q(a.y);
        for (const w of horizontal.get(ay) || []) {
          const lo = Math.min(q(w.x1), q(w.x2)), hi = Math.max(q(w.x1), q(w.x2));
          if (ax > lo && ax < hi) union(a.id, w.id);
        }
        for (const w of vertical.get(ax) || []) {
          const lo = Math.min(q(w.y1), q(w.y2)), hi = Math.max(q(w.y1), q(w.y2));
          if (ay > lo && ay < hi) union(a.id, w.id);
        }
        for (const w of diagonal) {
          const x1 = q(w.x1), y1 = q(w.y1), x2 = q(w.x2), y2 = q(w.y2);
          const cross = (x2 - x1) * (ay - y1) - (y2 - y1) * (ax - x1);
          const len = Math.hypot(x2 - x1, y2 - y1);
          if (Math.abs(cross) / len > 1) continue;
          const t = ((ax - x1) * (x2 - x1) + (ay - y1) * (y2 - y1)) / (len * len);
          if (t > 1e-9 && t < 1 - 1e-9) union(a.id, w.id);
        }
      }
    },
    /** Group sizes by root: how many wires/points/names each net contains. */
    sizes() {
      const counts = new Map();
      for (const id of parent.keys()) { const r = find(id); counts.set(r, (counts.get(r) || 0) + 1); }
      return counts;
    },
    /** Names joined to each root: Map root → [names]. */
    names() {
      const out = new Map();
      for (const id of parent.keys()) {
        if (!id.startsWith('name:')) continue;
        const r = find(id);
        if (!out.has(r)) out.set(r, []);
        out.get(r).push(id.slice(5));
      }
      return out;
    },
  };
}
