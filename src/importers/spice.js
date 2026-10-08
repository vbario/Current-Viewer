// SPICE netlists (.cir, .sp, .spice, .ckt, .net, .txt), including those
// exported by LTspice and KiCad. There is no geometry: parts are laid out by
// autoLayout in index.js.

import { parseValue, sourceVoltage, zenerVoltage, isSchottky, ledStyle, substituteParams, collectParams } from './build.js';

const GROUND_NODES = /^(0|gnd|gnd!)$/i;
const SKIP_REASONS = {
  I: 'current sources aren’t supported',
  B: 'behavioral sources aren’t supported',
  E: 'voltage-controlled sources aren’t supported', F: 'current-controlled sources aren’t supported',
  G: 'voltage-controlled sources aren’t supported', H: 'current-controlled sources aren’t supported',
  S: 'voltage-controlled switches aren’t supported', W: 'current-controlled switches aren’t supported',
  X: 'subcircuits (X…) aren’t supported yet', K: 'coupled inductors aren’t supported',
  M: 'MOSFETs aren’t supported yet', J: 'JFETs aren’t supported yet', Z: 'MESFETs aren’t supported',
  T: 'transmission lines aren’t supported', O: 'transmission lines aren’t supported', U: 'distributed lines aren’t supported',
  A: 'digital (XSPICE) models aren’t supported', Y: 'this element isn’t supported', P: 'this element isn’t supported', N: 'this element isn’t supported',
};

/** Split a netlist into logical lines: comments removed, '+' continuations joined. */
export function spiceLines(text) {
  const out = [];
  const raw = String(text).split(/\r?\n/);
  raw.forEach((line, i) => {
    let l = line.replace(/\t/g, ' ');
    if (i > 0) l = l.replace(/\s;.*$|^;.*$/, '').replace(/\s\$\s.*$/, '');
    if (/^\s*\+/.test(l) && out.length) { out[out.length - 1].text += ' ' + l.replace(/^\s*\+/, '').trim(); return; }
    out.push({ text: l.trim(), line: i + 1 });
  });
  return out;
}

const looksLikeElement = l => /^[RCL]\S*\s+\S+\s+\S+\s+[-+.\d]/i.test(l) && Number.isFinite(parseValue(l.split(/\s+/)[3], { spice: true }));

/** Parse a SPICE netlist into parts (no geometry) for autoLayout + buildProject. */
export function parseSpice(text, fileName = '') {
  const lines = spiceLines(text);
  const skipped = [], warnings = [], parts = [];
  const models = new Map(), directives = [];
  let title = '';
  // The first line is the title — unless it's clearly a circuit element.
  if (lines.length) {
    const first = lines[0].text;
    if (/^\.title\s+/i.test(first)) { title = first.replace(/^\.title\s+/i, ''); lines.shift(); }
    else if (!looksLikeElement(first)) { title = first.replace(/^\*+\s*/, ''); lines.shift(); }
  }
  // First pass: models and parameters (outside subcircuit definitions).
  let depth = 0;
  const body = [];
  for (const { text: l, line } of lines) {
    if (!l || l.startsWith('*')) continue;
    if (/^\.subckt\b/i.test(l)) { depth++; continue; }
    if (/^\.ends\b/i.test(l)) { depth = Math.max(0, depth - 1); continue; }
    if (depth) continue;
    if (/^\.end\b/i.test(l)) break;
    const model = /^\.model\s+(\S+)\s+([A-Za-z]+)\s*\(?(.*?)\)?\s*$/i.exec(l);
    if (model) {
      const ps = {};
      for (const [, k, v] of model[3].matchAll(/([A-Za-z_]\w*)\s*=\s*([^\s,)]+)/g)) ps[k.toLowerCase()] = v;
      models.set(model[1].toLowerCase(), { name: model[1], kind: model[2].toUpperCase(), params: ps, text: model[3] });
      continue;
    }
    if (/^\.(params?|step)\b/i.test(l)) { directives.push(l); continue; }
    if (l.startsWith('.')) continue;
    body.push({ l, line });
  }
  const params = collectParams(directives);
  const node = n => GROUND_NODES.test(n) ? '0' : n;
  const subst = v => String(v ?? '').replace(/^\{\s*([A-Za-z_]\w*)\s*\}$/, (m, k) => params[k.toLowerCase()] ?? m)
    .replace(/^([A-Za-z_]\w*)$/, (m, k) => params[k.toLowerCase()] ?? m);
  const numberOf = (v, type) => parseValue(subst(v), { type, spice: true });

  for (const { l: raw } of body) {
    const l = substituteParams(raw, params);
    const t = l.split(/\s+/);
    const name = t[0], letter = name[0].toUpperCase();
    switch (letter) {
      case 'R': case 'C': case 'L': {
        if (t.length < 3) { skipped.push({ ref: name, reason: 'incomplete line' }); break; }
        const type = letter === 'R' ? 'resistor' : letter === 'C' ? 'capacitor' : 'inductor';
        const raw = t.slice(3).find(x => !/^(tc\d?|m|temp|dtemp|tol|pwr|ic|rser|rpar|cpar|lser|ipk|ser|par)=/i.test(x) || /^[rcl]=/i.test(x));
        const value = numberOf(raw, type);
        parts.push({ ref: name, type, text: raw, value, pins: [{ net: node(t[1]) }, { net: node(t[2]) }] });
        break;
      }
      case 'V': {
        if (t.length < 3) { skipped.push({ ref: name, reason: 'incomplete line' }); break; }
        const spec = t.slice(3).join(' ');
        const src = sourceVoltage(subst(spec)) || sourceVoltage(spec);
        const type = /bat/i.test(name) ? 'battery' : 'supply';
        const part = { ref: name, type, text: spec, pins: [{ net: node(t[1]) }, { net: node(t[2]) }] };
        if (src) {
          part.value = src.voltage;
          if (src.varying) warnings.push(`${name} is a time-varying source; it was imported as a steady ${+src.voltage.toPrecision(4)} V.`);
        } else part.value = 0;
        parts.push(part);
        break;
      }
      case 'D': {
        if (t.length < 4) { skipped.push({ ref: name, reason: 'incomplete line' }); break; }
        const modelName = t[3];
        const model = models.get(modelName.toLowerCase());
        const hint = `${name} ${modelName} ${model?.text || ''}`;
        const part = { ref: name, text: modelName, model: `${modelName} ${model?.text || ''}`, pins: [{ net: node(t[1]) }, { net: node(t[2]) }] };
        const bv = model ? parseValue(model.params.bv, { spice: true }) : NaN;
        if (/\bled\b|type\s*=\s*led|^led|led$/i.test(hint) || /led/i.test(modelName)) {
          part.type = 'led';
          part.color = ledStyle(hint).color;
        } else if (Number.isFinite(bv) && bv > 0 && bv <= 100) {
          part.type = 'zener'; part.registryValue = bv;
        } else if (zenerVoltage(modelName) && /zener|^bz|1n47|1n52|mmsz|dz|zd/i.test(hint)) {
          part.type = 'zener';
        } else {
          part.type = 'diode';
          if (isSchottky(hint)) part.registryValue = 0.3;
        }
        parts.push(part);
        break;
      }
      case 'Q': {
        if (t.length < 5) { skipped.push({ ref: name, reason: 'incomplete line' }); break; }
        // Q c b e [substrate] model …
        let mi = 4;
        if (!models.has(t[4]?.toLowerCase()) && models.has(t[5]?.toLowerCase())) mi = 5;
        const modelName = t[mi] || '';
        const model = models.get(modelName.toLowerCase());
        let type = model?.kind === 'PNP' ? 'pnp' : model?.kind === 'NPN' ? 'npn' : null;
        if (!type) type = /pnp|2n3906|2n2907|bc55[6-9]|bc32[78]|bc85[6-9]|bc80[78]|tip3[02]\b|tip4[25]|tip12[5-7]|2sa/i.test(modelName) ? 'pnp' : 'npn';
        const bf = model ? parseValue(model.params.bf, { spice: true }) : NaN;
        const part = { ref: name, type, text: modelName, pins: [{ net: node(t[1]) }, { net: node(t[2]) }, { net: node(t[3]) }] };
        if (Number.isFinite(bf) && bf > 0) part.registryValue = Math.round(bf);
        parts.push(part);
        break;
      }
      default:
        skipped.push({ ref: name, reason: SKIP_REASONS[letter] || 'this element isn’t supported' });
    }
  }
  const name = (title && !/^[A-Za-z]:\\|^\//.test(title) ? title : '') || fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') || 'SPICE netlist';
  return { name, parts, groundNets: ['0'], skipped, warnings, layout: 'auto' };
}
