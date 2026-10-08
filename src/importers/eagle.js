// Eagle / Fusion Electronics schematics (.sch, XML). Connectivity is explicit
// (<net><segment><pinref>); geometry comes from library symbol pins placed by
// each <instance>. Eagle coordinates are millimetres, y-up.

import { parseXml, child, children } from './xml.js';
import { classifyPart, mapPins, parseValue, sourceVoltage, isGroundName, railVoltage } from './build.js';
import { ImportError } from './errors.js';

/**
 * Absolute pin position for an instance rotation like 'R90', 'MR180', 'SMR270'.
 * Eagle rotates counter-clockwise (y-up); M mirrors x after rotating (validated
 * against MR90/MR270 parts in real schematics). S (spin) only affects text.
 * Returns y-up millimetres.
 */
export function eaglePinPosition(px, py, x, y, rot) {
  const m = /^S?(M?)R(\d+(?:\.\d+)?)$/i.exec(String(rot || 'R0').trim()) || ['', '', '0'];
  const mirror = m[1] === 'M' || m[1] === 'm';
  const angle = ((Number(m[2]) % 360) + 360) % 360;
  let ox = px, oy = py;
  if (angle === 90) [ox, oy] = [-oy, ox];
  else if (angle === 180) [ox, oy] = [-ox, -oy];
  else if (angle === 270) [ox, oy] = [oy, -ox];
  else if (angle !== 0) {
    const t = angle * Math.PI / 180;
    [ox, oy] = [ox * Math.cos(t) - oy * Math.sin(t), ox * Math.sin(t) + oy * Math.cos(t)];
  }
  if (mirror) ox = -ox;
  return { x: x + ox, y: y + oy };
}

const key = (name, urn) => `${name}\u0000${urn || ''}`;

/**
 * Read an Eagle schematic into parts with gates, pins (absolute, y-up mm) and
 * net names. Returns { parts: [{ name, library, deviceset, device, value,
 * prefix, description, supply, pins: [{ name, gate, x, y, lx, ly, net, direction }] }],
 * wiresByNet, sheets }.
 */
export function readEagle(text, { pinPosition = eaglePinPosition } = {}) {
  const doc = parseXml(text);
  const eagle = child(doc, 'eagle');
  const drawing = child(eagle, 'drawing');
  if (!eagle || !drawing) throw new ImportError('This doesn’t look like an Eagle file.');
  const schematic = child(drawing, 'schematic');
  if (!schematic) {
    if (child(drawing, 'board')) throw new ImportError('This is an Eagle board layout (.brd). Please import the matching schematic (.sch) instead — it has the circuit’s parts and connections.');
    if (child(drawing, 'library')) throw new ImportError('This is an Eagle library (.lbr), not a schematic. Please import a schematic (.sch).');
    throw new ImportError('This Eagle file doesn’t contain a schematic.');
  }

  const libs = new Map();
  for (const lib of children(child(schematic, 'libraries'), 'library')) {
    const symbols = new Map(children(child(lib, 'symbols'), 'symbol').map(s => [s.attrs.name, children(s, 'pin').map(p => ({
      name: p.attrs.name, x: Number(p.attrs.x) || 0, y: Number(p.attrs.y) || 0, direction: p.attrs.direction || 'io',
    }))]));
    const devicesets = new Map(children(child(lib, 'devicesets'), 'deviceset').map(ds => [ds.attrs.name, {
      prefix: ds.attrs.prefix || '',
      description: child(ds, 'description')?.text || '',
      gates: new Map(children(child(ds, 'gates'), 'gate').map(g => [g.attrs.name, g.attrs.symbol])),
    }]));
    const entry = { symbols, devicesets };
    libs.set(key(lib.attrs.name, lib.attrs.urn), entry);
    if (!libs.has(key(lib.attrs.name))) libs.set(key(lib.attrs.name), entry);
  }

  const parts = new Map();
  for (const p of children(child(schematic, 'parts'), 'part')) {
    const a = p.attrs;
    const lib = libs.get(key(a.library, a.library_urn)) || libs.get(key(a.library));
    const ds = lib?.devicesets.get(a.deviceset);
    parts.set(a.name, {
      name: a.name, library: a.library || '', deviceset: a.deviceset || '', device: a.device || '', value: a.value ?? '',
      prefix: ds?.prefix || '', description: ds?.description || '', lib, ds, pins: [],
    });
  }

  // Net names across all sheets: same-named nets are one net.
  const pinNet = new Map(), wiresByNet = new Map();
  const sheets = children(child(schematic, 'sheets'), 'sheet');
  sheets.forEach((sheet, sheetIndex) => {
    for (const net of children(child(sheet, 'nets'), 'net')) {
      const name = net.attrs.name || '';
      for (const seg of children(net, 'segment')) {
        for (const pr of children(seg, 'pinref')) pinNet.set(`${pr.attrs.part}\u0000${pr.attrs.gate}\u0000${pr.attrs.pin}`, name);
        if (!wiresByNet.has(name)) wiresByNet.set(name, []);
        for (const w of children(seg, 'wire')) wiresByNet.get(name).push(['x1', 'y1', 'x2', 'y2'].map(k => Number(w.attrs[k])));
      }
    }
    for (const inst of children(child(sheet, 'instances'), 'instance')) {
      const part = parts.get(inst.attrs.part);
      const symbolName = part?.ds?.gates.get(inst.attrs.gate);
      const pins = symbolName ? part.lib.symbols.get(symbolName) : null;
      if (!pins) continue;
      const x = Number(inst.attrs.x) || 0, y = Number(inst.attrs.y) || 0;
      for (const pin of pins) {
        const at = pinPosition(pin.x, pin.y, x, y, inst.attrs.rot);
        part.pins.push({ ...pin, lx: pin.x, ly: pin.y, gate: inst.attrs.gate, sheet: sheetIndex, ...at, net: pinNet.get(`${part.name}\u0000${inst.attrs.gate}\u0000${pin.name}`) ?? null });
      }
    }
  });
  for (const part of parts.values()) {
    part.gates = new Set(part.pins.map(p => p.gate)).size;
    // supply1/supply2, any symbol made only of supply pins, or a lone-pin GND/VCC/+5V deviceset.
    part.supply = /^supply\d*$/i.test(part.library) || (part.pins.length > 0 && part.pins.every(p => p.direction === 'sup'))
      || (part.pins.length === 1 && !part.device && (isGroundName(part.deviceset) || !!railVoltage(part.deviceset)));
  }
  return { parts: [...parts.values()], wiresByNet, sheets: sheets.length };
}

/** Parse an Eagle schematic into parts for buildProject. */
export function parseEagleSch(text, fileName = '') {
  const sch = readEagle(text);
  // Sheets share one coordinate space: lay them out side by side.
  if (sch.sheets > 1) {
    const extent = new Map();
    for (const p of sch.parts) for (const pin of p.pins) {
      const e = extent.get(pin.sheet) || { min: Infinity, max: -Infinity };
      e.min = Math.min(e.min, pin.x); e.max = Math.max(e.max, pin.x);
      extent.set(pin.sheet, e);
    }
    let offset = 0;
    const shift = new Map();
    for (const sheet of [...extent.keys()].sort((a, b) => a - b)) {
      const e = extent.get(sheet);
      shift.set(sheet, offset - e.min);
      offset += e.max - e.min + 50;
    }
    for (const p of sch.parts) for (const pin of p.pins) pin.x += shift.get(pin.sheet) || 0;
  }
  // Nets that only touch a single pin are effectively unconnected.
  const netSize = new Map();
  for (const p of sch.parts) for (const pin of p.pins) if (pin.net != null) netSize.set(pin.net, (netSize.get(pin.net) || 0) + 1);
  const connectedNet = pin => pin.net != null && netSize.get(pin.net) > 1 ? pin.net : null;
  const parts = [], skipped = [], warnings = [], rails = [];
  for (const p of sch.parts) {
    if (!p.pins.length) continue; // frames, logos, mechanical parts
    if (p.supply) {
      for (const pin of p.pins) {
        const net = pin.net ?? pin.name;
        const rail = railVoltage(net) || railVoltage(p.deviceset);
        if (isGroundName(net) || isGroundName(p.deviceset)) parts.push({ ref: '', type: 'ground', pins: [{ net, x: pin.x, y: -pin.y }] });
        else if (rail) rails.push({ net, x: pin.x, y: -pin.y, voltage: rail.negative ? -rail.voltage : rail.voltage });
      }
      continue;
    }
    const ref = p.name;
    const value = p.value || '';
    const lib = `${p.library}:${p.deviceset}${p.device}`;
    // Eagle names unprefixed parts 'U$1'; use the deviceset's prefix when it has one.
    const refForType = /^U\$/.test(ref) && p.prefix ? p.prefix + ref.replace(/^\D+/, '') : ref;
    const cls = classifyPart({ ref: refForType, lib, value, description: p.description, pinCount: p.pins.length });
    if (!cls.type) { skipped.push({ ref, value, reason: cls.reason }); continue; }
    if (p.gates > 1) { skipped.push({ ref, value, reason: 'multi-gate parts aren’t supported yet' }); continue; }
    const pins = mapPins(cls.type, p.pins.map(pin => ({ ...pin, number: pin.name, net: connectedNet(pin) })));
    if (!pins) { skipped.push({ ref, value, reason: `its ${p.pins.length} pins don’t match a ${cls.type}` }); continue; }
    const part = { ref, type: cls.type, text: value, lib, pins: pins.map(pin => ({ net: pin.net, x: pin.x, y: -pin.y })) };
    if (['battery', 'cell', 'supply'].includes(cls.type)) {
      const src = sourceVoltage(value);
      if (src) part.value = src.voltage;
    } else part.value = parseValue(value, { type: cls.type });
    parts.push(part);
  }
  if (sch.sheets > 1) warnings.push(`This schematic has ${sch.sheets} sheets; they were imported side by side.`);
  const name = fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') || 'Eagle schematic';
  return { name, parts, rails, skipped, warnings };
}
