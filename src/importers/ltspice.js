// LTspice schematics (.asc). Built-in symbols have fixed pin offsets; wires,
// flags (net labels, `0` = ground) and pins connect geometrically.

import { createNetGraph } from './netgraph.js';
import { parseValue, sourceVoltage, substituteParams, collectParams } from './build.js';

// Pin offsets before orientation, in registry pin order (from LTspice's lib/sym/*.asy).
const R_16_96 = [[16, 16], [16, 96]];
const R_16_64 = [[16, 0], [16, 64]];
const SOURCE = [[0, 16], [0, 96]];
const BJT = [[64, 0], [0, 48], [64, 96]]; // C, B, E
export const LTSPICE_SYMBOLS = {
  res: { type: 'resistor', pins: R_16_96 },
  res2: { type: 'resistor', pins: R_16_64 },
  europeanresistor: { type: 'resistor', pins: R_16_96 },
  cap: { type: 'capacitor', pins: R_16_64 },
  polcap: { type: 'capacitor', pins: R_16_64 },
  europeancap: { type: 'capacitor', pins: R_16_64 },
  ind: { type: 'inductor', pins: R_16_96 },
  ind2: { type: 'inductor', pins: R_16_96 },
  diode: { type: 'diode', pins: R_16_64 },
  schottky: { type: 'diode', pins: R_16_64, schottky: true },
  zener: { type: 'zener', pins: R_16_64 },
  led: { type: 'led', pins: R_16_64 },
  voltage: { type: 'supply', pins: SOURCE },
  signal: { type: 'supply', pins: SOURCE },
  battery: { type: 'battery', pins: SOURCE },
  cell: { type: 'cell', pins: [[0, 0], [0, 64]] },
  npn: { type: 'npn', pins: BJT },
  npn2: { type: 'npn', pins: BJT },
  npn3: { type: 'npn', pins: BJT },
  pnp: { type: 'pnp', pins: BJT },
  pnp2: { type: 'pnp', pins: BJT },
};
const UNSUPPORTED = {
  current: 'current sources aren’t supported',
  nmos: 'MOSFETs aren’t supported yet', pmos: 'MOSFETs aren’t supported yet', nmos4: 'MOSFETs aren’t supported yet', pmos4: 'MOSFETs aren’t supported yet',
  npn4: '4-terminal transistors aren’t supported yet', pnp4: '4-terminal transistors aren’t supported yet',
  njf: 'JFETs aren’t supported yet', pjf: 'JFETs aren’t supported yet',
  sw: 'voltage-controlled switches aren’t supported', csw: 'current-controlled switches aren’t supported',
  bv: 'behavioral sources aren’t supported', bi: 'behavioral sources aren’t supported',
  e: 'controlled sources aren’t supported', e2: 'controlled sources aren’t supported', f: 'controlled sources aren’t supported', g: 'controlled sources aren’t supported', g2: 'controlled sources aren’t supported', h: 'controlled sources aren’t supported',
};

/**
 * Orientation: R90 rotates clockwise on screen (y-down). M mirrors x *after*
 * that rotation (equivalently: mirror first, then rotate counter-clockwise).
 * Validated against LTspice-written netlists and M90/M270 parts in real files.
 */
export function ltspicePinPosition(px, py, x, y, orient) {
  const m = /^([RM])(\d+)$/i.exec(String(orient || 'R0').trim()) || ['', 'R', '0'];
  let ox = px, oy = py;
  const angle = ((Number(m[2]) % 360) + 360) % 360;
  if (angle === 90) [ox, oy] = [-oy, ox];
  else if (angle === 180) [ox, oy] = [-ox, -oy];
  else if (angle === 270) [ox, oy] = [oy, -ox];
  if (m[1].toUpperCase() === 'M') ox = -ox;
  return { x: x + ox, y: y + oy };
}

const symbolKey = name => String(name).replace(/^.*[\\/]/, '').toLowerCase();

/**
 * Read an .asc into symbols with absolute pin positions and nets.
 * Returns { symbols: [{ name, key, ref, value, value2, attrs, x, y, orient,
 * known, pins: [{ x, y, net }] }], flags: [{ x, y, name, net }], params }.
 */
export function readAsc(text, { pinPosition = ltspicePinPosition } = {}) {
  const graph = createNetGraph(1);
  const symbols = [], flags = [], directives = [];
  let current = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const kw = line.split(/\s+/, 1)[0].toUpperCase();
    if (kw === 'WIRE') {
      const [x1, y1, x2, y2] = line.split(/\s+/).slice(1, 5).map(Number);
      if ([x1, y1, x2, y2].every(Number.isFinite)) graph.addWire(x1, y1, x2, y2);
    } else if (kw === 'FLAG') {
      const t = line.split(/\s+/);
      const flag = { x: Number(t[1]), y: Number(t[2]), name: t.slice(3).join(' ') };
      if (Number.isFinite(flag.x) && Number.isFinite(flag.y)) {
        flag.id = graph.addPoint(flag.x, flag.y);
        graph.joinName(flag.id, flag.name.toLowerCase());
        flags.push(flag);
      }
      current = null;
    } else if (kw === 'SYMBOL') {
      const t = line.split(/\s+/);
      const orient = t.at(-1), y = Number(t.at(-2)), x = Number(t.at(-3));
      const name = t.slice(1, -3).join(' ');
      current = { name, key: symbolKey(name), x, y, orient, attrs: {} };
      symbols.push(current);
    } else if (kw === 'SYMATTR' && current) {
      const m = /^SYMATTR\s+(\S+)\s?(.*)$/i.exec(line);
      if (m) current.attrs[m[1]] = m[2];
    } else if (kw === 'TEXT') {
      const m = /^TEXT\s+\S+\s+\S+\s+\S+\s+\S+\s+!(.*)$/i.exec(line);
      if (m) directives.push(...m[1].split(/\\n/));
      current = null;
    } else if (!['WINDOW', 'SYMATTR', 'IOPIN'].includes(kw)) current = null;
  }
  for (const s of symbols) {
    const def = LTSPICE_SYMBOLS[s.key];
    s.ref = s.attrs.InstName || '';
    s.value = s.attrs.Value ?? '';
    s.value2 = s.attrs.Value2 ?? '';
    s.known = !!def;
    s.pins = (def?.pins || []).map(([px, py]) => {
      const at = pinPosition(px, py, s.x, s.y, s.orient);
      return { ...at, id: graph.addPoint(at.x, at.y) };
    });
  }
  const params = collectParams(directives);
  graph.solve();
  const names = graph.names(), sizes = graph.sizes(), netNames = new Map();
  let unnamed = 0;
  const netOf = id => {
    const r = graph.find(id);
    if (!netNames.has(r)) {
      const list = names.get(r) || [];
      const display = list.includes('0') ? '0' : flags.find(f => list.includes(f.name.toLowerCase()))?.name;
      netNames.set(r, display ?? `N${String(++unnamed).padStart(3, '0')}`);
    }
    return netNames.get(r);
  };
  for (const s of symbols) for (const pin of s.pins) pin.net = sizes.get(graph.find(pin.id)) > 1 ? netOf(pin.id) : null;
  for (const f of flags) f.net = netOf(f.id);
  return { symbols, flags, params };
}

/** Parse an LTspice schematic into parts for buildProject. */
export function parseAsc(text, fileName = '') {
  const asc = readAsc(text);
  const parts = [], skipped = [], warnings = [];
  for (const f of asc.flags) if (f.name === '0') parts.push({ ref: '', type: 'ground', pins: [{ net: f.net, x: f.x, y: f.y }] });
  for (const s of asc.symbols) {
    const ref = s.ref || s.key;
    const def = LTSPICE_SYMBOLS[s.key];
    if (!def) {
      const reason = UNSUPPORTED[s.key] || (/opamp|op-?amp|^lt\d|^ad\d|^ltc\d|^lm\d/i.test(s.key) ? 'integrated circuits aren’t supported yet' : `the LTspice symbol “${s.name.replace(/^.*[\\/]/, '')}” isn’t supported yet`);
      skipped.push({ ref, value: s.value, reason });
      continue;
    }
    const value = substituteParams(s.value, asc.params);
    const part = { ref, type: def.type, text: value, model: value, pins: s.pins.map(p => ({ net: p.net, x: p.x, y: p.y })) };
    if (def.type === 'supply' || def.type === 'battery') {
      const src = sourceVoltage(value) || sourceVoltage(substituteParams(s.value2, asc.params));
      if (src) {
        part.value = src.voltage;
        if (src.varying) warnings.push(`${ref} is a time-varying source; it was imported as a steady ${+src.voltage.toPrecision(4)} V.`);
      }
    } else if (def.type === 'diode') {
      if (def.schottky) part.registryValue = 0.3;
      else if (/led/i.test(value)) part.type = 'led';
    } else if (!['npn', 'pnp', 'led', 'zener'].includes(def.type)) {
      part.value = parseValue(value, { type: def.type, spice: true });
    }
    parts.push(part);
  }
  const name = fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') || 'LTspice schematic';
  return { name, parts, skipped, warnings };
}
