// KiCad 6/7/8/9 schematics (.kicad_sch). Pin geometry comes from the embedded
// lib_symbols; connectivity from wires, junctions, labels and power symbols.

import { parseSexpr, find, findAll, value, num, flag } from './sexpr.js';
import { createNetGraph } from './netgraph.js';
import { classifyPart, mapPins, parseValue, sourceVoltage, isGroundName, railVoltage } from './build.js';
import { ImportError } from './errors.js';

// KiCad 7 (file version 20230121) made power symbols name their net by Value;
// older files used the name of the hidden power pin.
const VALUE_NAMES_POWER_NET = 20230121;

/**
 * Library pin positions are y-up; the sheet is y-down. A placed symbol is
 * rotated counter-clockwise on screen by its angle and then mirrored in sheet
 * space: (mirror x) flips vertically, (mirror y) horizontally. (Validated
 * against KiCad's demo projects: every pin lands on a wire, label, or
 * no-connect flag.)
 */
export function kicadPinPosition(px, py, at, mirror) {
  const x = px, y = -py;
  const angle = ((Math.round(at.angle) % 360) + 360) % 360;
  let rx = x, ry = y;
  if (angle === 90) { rx = y; ry = -x; }
  else if (angle === 180) { rx = -x; ry = -y; }
  else if (angle === 270) { rx = -y; ry = x; }
  else if (angle !== 0) {
    const t = angle * Math.PI / 180;
    rx = x * Math.cos(t) + y * Math.sin(t); ry = -x * Math.sin(t) + y * Math.cos(t);
  }
  if (mirror === 'x') ry = -ry;
  if (mirror === 'y') rx = -rx;
  return { x: at.x + rx, y: at.y + ry };
}

const atOf = node => {
  const at = find(node, 'at');
  return { x: num(at?.[1]), y: num(at?.[2]), angle: num(at?.[3]) };
};

function properties(node) {
  const props = {};
  for (const p of findAll(node, 'property')) if (typeof p[1] === 'string') props[p[1]] = typeof p[2] === 'string' ? p[2] : '';
  return props;
}

/** Resolve ${FIELD} text variables against a symbol's own fields. */
function resolveVars(text, props) {
  const lower = Object.fromEntries(Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]));
  return String(text ?? '').replace(/\$\{([^}]+)\}/g, (m, k) => lower[k.toLowerCase()] ?? m);
}

/** Collect a library symbol's pins for one unit / body style. */
function libraryPins(lib, libs, unit, bodyStyle) {
  let def = lib;
  const extendsName = value(lib, 'extends');
  if (extendsName && !findAll(lib, 'symbol').length) {
    const prefix = String(lib[1]).includes(':') ? String(lib[1]).split(':')[0] + ':' : '';
    def = libs.get(prefix + extendsName) || libs.get(extendsName) || lib;
  }
  const pins = [], units = new Set();
  const add = node => {
    for (const pin of findAll(node, 'pin')) {
      const at = find(pin, 'at');
      pins.push({
        x: num(at?.[1]), y: num(at?.[2]),
        number: String(value(pin, 'number') ?? ''), name: String(value(pin, 'name') ?? ''),
        electrical: typeof pin[1] === 'string' ? pin[1] : '', hidden: flag(pin, 'hide'),
      });
    }
  };
  add(def);
  for (const sub of findAll(def, 'symbol')) {
    const m = /_(\d+)_(\d+)$/.exec(String(sub[1]));
    const u = m ? Number(m[1]) : 0, c = m ? Number(m[2]) : 0;
    if (u > 0 && findAll(sub, 'pin').length) units.add(u);
    if ((u === 0 || u === unit) && (c === 0 || c === bodyStyle)) add(sub);
  }
  return { pins, unitCount: units.size, power: !!find(def, 'power') || !!find(lib, 'power') };
}

/**
 * Read a .kicad_sch into placed symbols with absolute pin positions and nets.
 * Returns { title, version, sheets, symbols: [{ ref, libId, value, props, inBom,
 * dnp, power, netName?, unitCount, pins: [{ number, name, x, y, lx, ly, net,
 * electrical, hidden }] }] }. `net` is a net name, or null for a pin that
 * touches nothing.
 */
export function readKicadSchematic(text, { pinPosition = kicadPinPosition } = {}) {
  const root = parseSexpr(text);
  if (!root || root[0] !== 'kicad_sch') throw new ImportError('This doesn’t look like a KiCad schematic (.kicad_sch).');
  const version = num(value(root, 'version'), 0);
  const libs = new Map();
  for (const s of findAll(find(root, 'lib_symbols'), 'symbol')) libs.set(String(s[1]), s);
  const graph = createNetGraph(1e4);

  for (const w of findAll(root, 'wire')) {
    const pts = findAll(find(w, 'pts'), 'xy').map(p => [num(p[1]), num(p[2])]);
    for (let i = 0; i + 1 < pts.length; i++) graph.addWire(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  }
  for (const j of findAll(root, 'junction')) { const at = atOf(j); graph.addPoint(at.x, at.y); }
  // Labels join by name: global labels (and power symbols) everywhere; local and
  // hierarchical labels within the sheet, which is all we import.
  for (const kind of ['label', 'global_label', 'hierarchical_label']) {
    for (const l of findAll(root, kind)) {
      const at = atOf(l);
      const id = graph.addPoint(at.x, at.y);
      graph.joinName(id, `${kind === 'global_label' ? 'global' : 'local'}:${l[1]}`);
    }
  }

  // Annotation lives in per-symbol (instances …) in KiCad 7+, and in a root
  // (symbol_instances …) table in KiCad 6; both win over the Reference field.
  const rootUuid = value(root, 'uuid');
  const legacyInstances = new Map();
  for (const p of findAll(find(root, 'symbol_instances'), 'path')) {
    legacyInstances.set(String(p[1]).split('/').pop(), { reference: value(p, 'reference'), unit: value(p, 'unit'), value: value(p, 'value') });
  }
  const instanceOf = s => {
    const paths = findAll(find(s, 'instances'), 'project').flatMap(pr => findAll(pr, 'path'));
    const p = paths.find(p => String(p[1]) === `/${rootUuid}`) || paths[0];
    if (p) return { reference: value(p, 'reference'), unit: value(p, 'unit') };
    return legacyInstances.get(String(value(s, 'uuid') ?? '')) || {};
  };

  const symbols = [];
  for (const s of findAll(root, 'symbol')) {
    const libId = String(value(s, 'lib_id') ?? '');
    const lib = libs.get(String(value(s, 'lib_name') ?? libId)) || libs.get(libId);
    const props = properties(s);
    const inst = instanceOf(s);
    if (inst.reference) props.Reference = inst.reference;
    if (inst.value && !props.Value) props.Value = inst.value;
    const at = atOf(s);
    const mirror = value(s, 'mirror');
    const unit = num(inst.unit ?? value(s, 'unit'), 1);
    const bodyStyle = num(value(s, 'convert') ?? value(s, 'body_style'), 1);
    const info = lib ? libraryPins(lib, libs, unit, bodyStyle) : { pins: [], unitCount: 0, power: false };
    const power = info.power || /^power:/i.test(libId);
    const ref = props.Reference ?? '';
    const val = resolveVars(props.Value ?? '', props).replace(/^~$/, ''); // '~' is KiCad's empty value
    const sym = {
      ref, libId, value: val, props, unit, unitCount: info.unitCount, power,
      inBom: value(s, 'in_bom') !== 'no', dnp: value(s, 'dnp') === 'yes',
      pins: info.pins.map(p => ({ ...p, lx: p.x, ly: p.y, ...pinPosition(p.x, p.y, at, mirror) })),
      at,
    };
    for (const pin of sym.pins) {
      pin.id = graph.addPoint(pin.x, pin.y);
      // Power symbols are global labels named by their value (KiCad 7+) or
      // their hidden power pin's name (older files).
      if (power && pin.electrical === 'power_in') {
        const pinName = pin.name && pin.name !== '~' ? pin.name : '';
        const name = version >= VALUE_NAMES_POWER_NET ? (val || pinName) : (pinName || val);
        if (!name) continue;
        sym.netName = name;
        graph.joinName(pin.id, `global:${name}`);
      } else if (!power && pin.hidden && pin.electrical === 'power_in' && pin.name) {
        // Hidden power pins on ordinary symbols join the net of the same name.
        graph.joinName(pin.id, `global:${pin.name}`);
      }
    }
    symbols.push(sym);
  }
  graph.solve();

  // Net names: global names win over local ones; unnamed nets get N1, N2 ….
  const names = graph.names(), sizes = graph.sizes(), netNames = new Map();
  let unnamed = 0;
  const netOf = id => {
    const r = graph.find(id);
    if (!netNames.has(r)) {
      const list = names.get(r) || [];
      const global = list.find(n => n.startsWith('global:')), local = list.find(n => n.startsWith('local:'));
      netNames.set(r, global ? global.slice(7) : local ? local.slice(6) : `N${++unnamed}`);
    }
    return netNames.get(r);
  };
  for (const sym of symbols) {
    for (const pin of sym.pins) {
      const r = graph.find(pin.id);
      // A pin alone in its group touches nothing: leave it unconnected.
      pin.net = sizes.get(r) > 1 ? netOf(pin.id) : null;
    }
  }
  const tb = find(root, 'title_block');
  return { title: tb ? value(tb, 'title') : undefined, version, symbols, sheets: findAll(root, 'sheet').length };
}

const transistorOrder = libId => {
  const m = /_([BCE]{3})(?:_|$)/i.exec(libId);
  if (!m) return undefined;
  const letters = m[1].toUpperCase().split('');
  return ['C', 'B', 'E'].map(l => String(letters.indexOf(l) + 1));
};

/** Parse a KiCad schematic into parts for buildProject. */
export function parseKicadSch(text, fileName = '') {
  const sch = readKicadSchematic(text);
  const parts = [], skipped = [], warnings = [], rails = [];
  for (const sym of sch.symbols) {
    if (sym.power) {
      const pin = sym.pins.find(p => p.electrical === 'power_in') || sym.pins[0];
      if (!pin || !sym.netName) continue; // PWR_FLAG and friends
      if (isGroundName(sym.netName)) parts.push({ ref: '', type: 'ground', pins: [{ net: pin.net ?? sym.netName, x: pin.x, y: pin.y }] });
      else if (railVoltage(sym.netName)) rails.push({ net: pin.net ?? sym.netName, x: pin.x, y: pin.y });
      continue;
    }
    if (!sym.pins.length) continue; // logos, frames, graphics
    const ref = sym.ref.replace(/\?$/, '') || sym.ref;
    const visible = sym.pins.filter(p => !p.hidden || p.net);
    const cls = classifyPart({ ref, lib: sym.libId, value: sym.value, footprint: sym.props.Footprint, description: sym.props.Description ?? sym.props.ki_description, pinCount: visible.length });
    if (!cls.type) { skipped.push({ ref, value: sym.value, reason: cls.reason }); continue; }
    if (!sym.inBom && cls.type !== 'supply' && cls.type !== 'battery') { skipped.push({ ref, value: sym.value, reason: 'it’s marked as not part of the board (virtual)' }); continue; }
    if (sym.unitCount > 1) { skipped.push({ ref, value: sym.value, reason: 'multi-unit parts aren’t supported yet' }); continue; }
    const order = ['diode', 'led', 'zener'].includes(cls.type) ? ['2', '1'] : ['npn', 'pnp'].includes(cls.type) ? transistorOrder(sym.libId) : cls.type === 'potentiometer' ? ['1', '3', '2'] : undefined;
    const pins = mapPins(cls.type, visible, { order });
    if (!pins) { skipped.push({ ref, value: sym.value, reason: `its ${visible.length} pins don’t match a ${cls.type}` }); continue; }
    const part = { ref, type: cls.type, text: sym.value, lib: sym.libId, pins: pins.map(p => ({ net: p.net, x: p.x, y: p.y })) };
    if (['battery', 'cell', 'supply'].includes(cls.type)) {
      const src = sourceVoltage(sym.value) || sourceVoltage(sym.props['Sim.Params']) || sourceVoltage(sym.props.Spice_Model) || sourceVoltage(sym.props['Sim_Params']);
      if (src) {
        part.value = src.voltage;
        if (src.varying) warnings.push(`${ref} is a time-varying source; it was imported as a steady ${+src.voltage.toPrecision(4)} V.`);
      } else part.text = sym.value;
    } else part.value = parseValue(sym.value, { type: cls.type });
    parts.push(part);
  }
  if (sch.sheets) warnings.push(`This schematic has ${sch.sheets} sub-sheet${sch.sheets > 1 ? 's' : ''}; only the top-level sheet was imported.`);
  const name = sch.title || fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') || 'KiCad schematic';
  return { name, parts, rails, skipped, warnings };
}
