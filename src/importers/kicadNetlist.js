// KiCad netlist exports (.net, S-expression "(export (version …)" format).
// Components and nets only, so parts are laid out by autoLayout in index.js.

import { parseSexpr, find, findAll, value } from './sexpr.js';
import { classifyPart, mapPins, parseValue, sourceVoltage } from './build.js';
import { ImportError } from './errors.js';

export function parseKicadNetlist(text, fileName = '') {
  const root = parseSexpr(text);
  if (!root || root[0] !== 'export') throw new ImportError('This doesn’t look like a KiCad netlist export.');
  const libparts = new Map();
  for (const lp of findAll(find(root, 'libparts'), 'libpart')) {
    const pins = findAll(find(lp, 'pins'), 'pin').map(p => ({ number: String(value(p, 'num') ?? ''), name: String(value(p, 'name') ?? '') }));
    libparts.set(`${value(lp, 'lib')}:${value(lp, 'part')}`, { pins, description: value(lp, 'description') || '' });
  }
  // Pin → net, and how many pins each net touches.
  const pinNet = new Map(), pinName = new Map(), netSize = new Map();
  for (const net of findAll(find(root, 'nets'), 'net')) {
    const name = String(value(net, 'name') ?? value(net, 'code') ?? '');
    const nodes = findAll(net, 'node');
    netSize.set(name, nodes.length);
    for (const n of nodes) {
      const k = `${value(n, 'ref')}\u0000${value(n, 'pin')}`;
      pinNet.set(k, name);
      if (value(n, 'pinfunction')) pinName.set(k, value(n, 'pinfunction'));
    }
  }
  const parts = [], skipped = [], warnings = [];
  for (const comp of findAll(find(root, 'components'), 'comp')) {
    const ref = String(value(comp, 'ref') ?? '');
    const val = String(value(comp, 'value') ?? '');
    const src = find(comp, 'libsource');
    const libId = src ? `${value(src, 'lib')}:${value(src, 'part')}` : '';
    const props = {};
    for (const p of findAll(comp, 'property')) props[String(value(p, 'name'))] = String(value(p, 'value') ?? '');
    const lp = libparts.get(libId);
    // Pins from the library part, falling back to the nets that mention this ref.
    let pins = lp?.pins.map(p => ({ ...p })) || [];
    if (!pins.length) {
      for (const k of pinNet.keys()) { const [r, number] = k.split('\u0000'); if (r === ref) pins.push({ number, name: pinName.get(k) || '' }); }
    }
    for (const p of pins) {
      const k = `${ref}\u0000${p.number}`;
      const net = pinNet.get(k);
      p.net = net != null && netSize.get(net) > 1 ? net : null;
      if (!p.name || p.name === '~') p.name = pinName.get(k) || p.name;
    }
    const cls = classifyPart({ ref, lib: libId, value: val, footprint: value(comp, 'footprint') || '', description: (src && value(src, 'description')) || lp?.description || '', pinCount: pins.length });
    if (!cls.type) { skipped.push({ ref, value: val, reason: cls.reason }); continue; }
    const order = ['diode', 'led', 'zener'].includes(cls.type) ? ['2', '1'] : cls.type === 'potentiometer' ? ['1', '3', '2'] : undefined;
    const mapped = mapPins(cls.type, pins, { order });
    if (!mapped) { skipped.push({ ref, value: val, reason: `its ${pins.length} pins don’t match a ${cls.type}` }); continue; }
    const part = { ref, type: cls.type, text: val, lib: libId, pins: mapped.map(p => ({ net: p.net })) };
    if (['battery', 'cell', 'supply'].includes(cls.type)) {
      const s = sourceVoltage(val) || sourceVoltage(props['Sim.Params']) || sourceVoltage(props.Sim_Params) || sourceVoltage(props.Spice_Model);
      if (s) {
        part.value = s.voltage;
        if (s.varying) warnings.push(`${ref} is a time-varying source; it was imported as a steady ${+s.voltage.toPrecision(4)} V.`);
      }
    } else part.value = parseValue(val, { type: cls.type });
    parts.push(part);
  }
  const design = find(root, 'design');
  const source = design ? value(design, 'source') : '';
  const base = (source || fileName).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  return { name: base || 'KiCad netlist', parts, skipped, warnings, layout: 'auto' };
}
