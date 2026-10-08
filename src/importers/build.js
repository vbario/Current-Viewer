// Shared import pipeline: value parsing, part classification, pin mapping,
// automatic layout for geometry-free formats, and `buildProject`, which turns
// parsed parts + nets into a valid Current project (schematic and model views,
// explicit wires, grounds, and power rails).

import { PARTS, SCHEMATIC_GRID, LED_COLORS, partBox, pinPosition, createComponent } from '../parts.js';
import { validProject, MAX_COMPONENTS, MAX_WIRES } from '../project.js';
import { ImportError } from './errors.js';

export const CENTER = { x: 525, y: 355 };
const MODEL_SPREAD = 1.7;
export const SOURCE_TYPES = new Set(['battery', 'cell', 'supply']);
const RESISTIVE = new Set(['resistor', 'potentiometer', 'lamp', 'motor', 'buzzer', 'speaker']);
const GROUND_COLOR = '#424b43', POWER_COLOR = '#dc6a52';
const PALETTE = ['#d5a143', '#78977b', '#687b8d', '#9f85b6'];
const LED_HEX = Object.fromEntries(Object.entries(LED_COLORS).map(([hex, name]) => [name, hex]));

const snap = (v, grid) => Math.round(v / grid) * grid;
const finite = Number.isFinite;

// ---------------------------------------------------------------------------
// Values

const MULTIPLIERS = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, g: 1e9, t: 1e12 };

/**
 * Parse an engineering value into an SI number, e.g. '4k7' → 4700, '10uF' → 1e-5,
 * '2R2' → 2.2, '5V1' → 5.1, '1Meg' → 1e6, '330Ω' → 330. Returns NaN when the text
 * isn’t a value (e.g. '1N4148', 'LED', '{res}').
 * `type` is the registry type (an 'M' suffix on resistive parts means mega);
 * `spice` applies SPICE rules (case-insensitive suffixes, M = milli, F = femto).
 */
export function parseValue(text, { type, spice = false } = {}) {
  if (typeof text === 'number') return finite(text) ? text : NaN;
  if (typeof text !== 'string') return NaN;
  let s = text.trim().replace(/^[a-z_][\w.]*\s*=\s*/i, '');
  const tokens = s.split(/\s+/);
  // '10 k', '330 Ω', '4.7 uF' — but not '10k LIN' or '100n X7R'.
  s = tokens.length > 1 && /^(?:[kKMmunpµμ]|meg)?(?:Ω|Ω|ohms?|F|H|V|A)?$/i.test(tokens[1]) && tokens[1] ? tokens[0] + tokens[1] : tokens[0];
  // Notes after the value: '470uF/16V', '2200uF;63V', '10k,1%'. A comma between digits is a decimal point.
  s = s.split(/[/;]|,(?!\d)|(?<!\d),/)[0].replace(/(\d),(\d)/g, '$1.$2');
  if (!s) return NaN;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(.*)$/.exec(s);
  if (!m) {
    const r = /^[rR](\d+)(?:Ω|Ω|ohms?)?$/.exec(s);
    return r ? Number(`0.${r[1]}`) : NaN;
  }
  let value = Number(m[1]), rest = m[2];
  // Embedded decimal point: 4k7, 2R2, 5V1, 4u7, 1M5, 4n7.
  if (/^\d+$/.test(m[1])) {
    const e = /^([pnuPNUµμmkKMgGrRvV])(\d{1,3})([a-zA-ZΩΩ]*)$/.exec(rest);
    if (e) {
      value = Number(`${m[1]}.${e[2]}`);
      rest = /[rRvV]/.test(e[1]) ? e[3] : e[1] + e[3];
    }
  }
  let mult = 1;
  if (/^meg/i.test(rest)) { mult = 1e6; rest = rest.slice(3); }
  else if (rest) {
    const c = rest[0];
    if (c === 'M') { mult = RESISTIVE.has(type) || !spice ? 1e6 : 1e-3; rest = rest.slice(1); }
    else if (c === 'f' || c === 'F') {
      if (spice || rest[1] === 'F' || rest[1] === 'f') { mult = 1e-15; rest = rest.slice(1); }
    } else if (c === 'm') { mult = 1e-3; rest = rest.slice(1); }
    else if (MULTIPLIERS[c.toLowerCase()] && c !== 'T' || c === 'T' && spice) {
      // Uppercase T without SPICE rules is more likely a stray letter than tera.
      mult = MULTIPLIERS[c.toLowerCase()]; rest = rest.slice(1);
    }
  }
  // Whatever is left must be a unit, never more digits or a part number.
  if (rest && !/^(Ω|Ω|ohms?|r|f|farads?|h|henr(?:y|ies)|v|volts?|vdc|vac|a|amps?|hz|w|watts?|%|°c|c)$/i.test(rest)) return NaN;
  const result = Number((value * mult).toPrecision(12));
  return finite(result) ? result : NaN;
}

/**
 * Evaluate a SPICE/LTspice parameter expression — '{2*R}', 'R1', '(1k+500)/2' —
 * against .param values (lower-case keys). Numbers take SPICE suffixes.
 * Returns NaN for anything else (functions, time, unknown names).
 */
export function evaluateExpression(text, params = {}, depth = 0) {
  const src = String(text ?? '').trim().replace(/^\{([\s\S]*)\}$/, '$1').replace(/^'([\s\S]*)'$/, '$1');
  const tokens = src.match(/(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?[a-zA-Zµμ]*|[A-Za-z_]\w*|[-+*/()]|\S/gi) || [];
  let i = 0;
  const lookup = name => {
    const v = params[name.toLowerCase()];
    return v === undefined || depth > 8 ? NaN : evaluateExpression(v, params, depth + 1);
  };
  const factor = () => {
    const t = tokens[i++];
    if (t === '-') return -factor();
    if (t === '+') return factor();
    if (t === '(') { const v = expr(); return tokens[i++] === ')' ? v : NaN; }
    if (t === undefined) return NaN;
    if (/^[\d.]/.test(t)) return parseValue(t, { spice: true });
    if (/^[A-Za-z_]/.test(t) && tokens[i] !== '(') return lookup(t);
    return NaN;
  };
  const term = () => {
    let v = factor();
    while (tokens[i] === '*' || tokens[i] === '/') { const op = tokens[i++], r = factor(); v = op === '*' ? v * r : v / r; }
    return v;
  };
  const expr = () => {
    let v = term();
    while (tokens[i] === '+' || tokens[i] === '-') { const op = tokens[i++], r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  };
  const v = tokens.length ? expr() : NaN;
  return i === tokens.length && finite(v) ? Number(v.toPrecision(12)) : NaN;
}

/**
 * Collect parameters from SPICE directives: `.param`/`.params name=value …`,
 * falling back to the first value of `.step param name …` sweeps.
 * Mutates and returns `params` (lower-case keys).
 */
export function collectParams(directives, params = {}) {
  const steps = {};
  for (const line of directives) {
    const p = /^\s*\.params?\s+(.*)$/i.exec(line);
    if (p) for (const [, k, v] of p[1].matchAll(/([A-Za-z_]\w*)\s*=\s*([^\s=]+)/g)) params[k.toLowerCase()] = v;
    const st = /^\s*\.step\s+(?:(?:oct|dec|lin)\s+)?param\s+([A-Za-z_]\w*)\s+(?:list\s+)?(\S+)/i.exec(line);
    if (st) steps[st[1].toLowerCase()] ??= st[2];
  }
  for (const [k, v] of Object.entries(steps)) params[k] ??= v;
  return params;
}

/** Replace {expression} groups with their values wherever they can be evaluated. */
export function substituteParams(text, params = {}) {
  return String(text ?? '').replace(/\{([^{}]*)\}/g, (m, e) => {
    const v = evaluateExpression(e, params);
    return finite(v) ? String(v) : m;
  });
}

/**
 * DC level of a voltage source description: '9', 'DC 9', 'dc=5', '9V',
 * 'PULSE(0 5 1m …)' (the pulsed level), 'SINE(2 1 1k)' (the offset), KiCad
 * Sim.Params like 'dc=0 ampl=1 f=1k' or 'y1=0 y2=5 …'. Returns
 * { voltage, varying } or null. `varying` flags time-varying sources.
 */
export function sourceVoltage(text) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  const num = t => parseValue(String(t ?? '').replace(/^\{|\}$/g, ''), { spice: true, type: 'supply' });
  const wave = /\b(pulse|sine?|exp|pwl|sffm|am|trnoise|trrandom)\b(?:\s+[a-z]+)*\s*\(([^)]*)\)?/i.exec(s);
  let m = /(?:^|\s)dc\s*=\s*([^\s,]+)/i.exec(s) || /(?:^|\s)dc\s+([^\s(,]+)/i.exec(s);
  const dc = m ? num(m[1]) : NaN;
  const kv = k => { const r = new RegExp(`(?:^|\\s)${k}\\s*=\\s*([^\\s,]+)`, 'i').exec(s); return r ? num(r[1]) : NaN; };
  if (finite(dc) && (dc !== 0 || !wave)) {
    const varying = !!wave || finite(kv('ampl')) || finite(kv('y2'));
    if (dc !== 0 || !varying) return { voltage: dc, varying };
  }
  if (wave) {
    const args = wave[2].trim().split(/[\s,]+/).filter(Boolean).map(num);
    const kind = wave[1].toLowerCase();
    let v = NaN;
    if (kind === 'pulse' || kind === 'exp') v = finite(args[1]) && args[1] !== 0 ? args[1] : args[0];
    else if (kind === 'pwl') { const vals = args.filter((_, i) => i % 2 === 1 && finite(args[i])); v = vals.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0); }
    else v = args[0];
    return { voltage: finite(v) ? v : 0, varying: true };
  }
  // KiCad simulation model parameters.
  if (finite(kv('y2'))) return { voltage: kv('y2') || kv('y1') || 0, varying: true };
  if (finite(kv('ampl')) || finite(kv('va')) || finite(kv('vo'))) return { voltage: finite(dc) ? dc : finite(kv('vo')) ? kv('vo') : 0, varying: true };
  if (finite(dc)) return { voltage: dc, varying: false };
  const first = s.replace(/^dc\s*/i, '').split(/[\s,]+/)[0];
  const v = num(first);
  if (finite(v)) return { voltage: v, varying: false };
  if (/^ac\b/i.test(s)) return { voltage: 0, varying: true };
  return null;
}

const ZENER_1N47 = { 28: 3.3, 29: 3.6, 30: 3.9, 31: 4.3, 32: 4.7, 33: 5.1, 34: 5.6, 35: 6.2, 36: 6.8, 37: 7.5, 38: 8.2, 39: 9.1, 40: 10, 41: 11, 42: 12, 43: 13, 44: 15, 45: 16, 46: 18, 47: 20, 48: 22, 49: 24, 50: 27, 51: 30, 52: 33, 53: 36, 54: 39, 55: 43, 56: 47, 57: 51, 58: 56, 59: 62, 60: 68, 61: 75, 62: 82, 63: 91, 64: 100 };
const ZENER_1N52 = [2.4, 2.5, 2.7, 2.8, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.0, 6.2, 6.8, 7.5, 8.2, 8.7, 9.1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 25, 27, 28, 30];

/** Zener voltage from a part number or value: 'BZX79C5V1' → 5.1, '5V1' → 5.1,
 * '1N4733A' → 5.1, '1N5231B' → 5.1, '12V' → 12. Returns undefined when unknown. */
export function zenerVoltage(text) {
  if (!text) return undefined;
  const s = String(text).toUpperCase();
  let m = /1N47(2[89]|[3-5]\d|6[0-4])/.exec(s);
  if (m) return ZENER_1N47[Number(m[1])];
  m = /(?:1N|MMSZ|MMBZ)52(2[1-9]|[34]\d|5[0-6])/.exec(s);
  if (m) return ZENER_1N52[Number(m[1]) - 21];
  m = /BZ[A-Z]\d*-?[A-D]?(\d+)V(\d+)/.exec(s) || /(?<![0-9])(\d{1,2})V(\d)(?![0-9])/.exec(s);
  if (m) return Number(`${m[1]}.${m[2]}`);
  m = /BZ[A-Z]\d+-?[A-D](\d{1,2})(?![0-9V])/.exec(s);
  if (m) return Number(m[1]);
  m = /(?:^|[^A-Z0-9.])(\d{1,2}(?:\.\d+)?)\s*V(?![A-Z0-9])/.exec(s);
  if (m) return Number(m[1]);
  const v = parseValue(text);
  return finite(v) && v >= 1 && v <= 100 ? v : undefined;
}

/** Schottky or germanium diodes get a 0.3 V forward drop. */
export const isSchottky = text => /schottky|sbd|\bbat\s?\d|\bbat[0-9]|1n58[1-2]\d|\bss[1-3][0-9]|\bmbr|\bsb\d|\bsr\d{3}|1n6263|1n34|1n60|\boa9\d/i.test(String(text || ''));

/** LED colour and forward voltage from free text (value, library, part number). */
export function ledStyle(text) {
  const s = ` ${String(text || '').toLowerCase().replace(/[_\-:/\\]/g, ' ')} `;
  const pick = (name, vf) => ({ color: LED_HEX[name], vf, name });
  if (/blue|blau|bleu|\bblu\b|\bbl\b|nspb|\bb\b/.test(s)) return pick('Blue', 3.2);
  if (/white|weiss|weiß|blanc|\bwht?\b|nspw|\bcw\b|\bww\b/.test(s)) return pick('Blue', 3.2);
  if (/violet|purple|\buv\b|ultraviolet/.test(s)) return pick('Violet', 3.2);
  if (/green|grün|gruen|\bvert\b|\bgrn\b|\bgn\b|\bg\b|nspg/.test(s)) return pick('Green', 2.2);
  if (/yellow|gelb|jaune|\byel\b|\bye\b|\by\b|amber|orange|\bor\b|\bam\b/.test(s)) return pick('Amber', 2.0);
  return pick('Red', 2.0);
}

/** Supply voltage implied by a power-rail net name, e.g. '+5V' → { voltage: 5 },
 * '+3V3' → 3.3, '-12V' → { voltage: 12, negative: true }, 'VCC' → 5. */
export function railVoltage(name) {
  const n = String(name || '').replace(/^.*\//, '').trim();
  let m = /^([+-]?)(\d+(?:[.,]\d+)?)V(\d*)(?:[AD]|_?\w{0,3})?$/i.exec(n);
  if (m && (m[1] || /V/i.test(n))) {
    const voltage = Number(m[2].replace(',', '.') + (m[3] ? `.${m[3]}` : ''));
    if (voltage > 0 && voltage <= 48) return { voltage, negative: m[1] === '-' };
  }
  m = /^([+-])(\d+(?:\.\d+)?)$/.exec(n);
  if (m) return { voltage: Number(m[2]), negative: m[1] === '-' };
  if (/^(VCC|VDD|VBUS|V\+|VPP|AVCC|AVDD|DVCC|DVDD|VDDA|VCCA)$/i.test(n)) return { voltage: 5, negative: false };
  return null;
}

const GROUND_RE = /^(?:[adps]?gnd\w{0,4}|gndref|vss|vssa|0|0v|earth|chassis|gnd_\w+)$/i;
/** True for ground-like net names: GND, GNDA, GNDD, GNDREF, AGND, VSS, 0, Earth … */
export const isGroundName = name => GROUND_RE.test(String(name ?? '').replace(/^.*\//, '').trim());

// ---------------------------------------------------------------------------
// Classification

const PNP_PARTS = /(2n3906|2n2907|2n4403|2n5401|2n4126|bc55[6-9]|bc32[78]|bc85[6-9]|bc80[78]|bc636|bc640|tip3[02]\b|tip3[02][a-c]|tip4[25]|tip12[5-7]|tip14[5-7]|tip2955|mje350|mje2955|s8550|s901[25]|2sa\d|a1015|mmbt3906|mmbt2907|pn2907|bd13[68]|bd140|bd244|mpsa56|mpsa92)/i;
const NPN_PARTS = /(2n2222|2n3904|2n4401|2n5551|2n3055|2n4124|2n2219|bc54[6-9]|bc550|bc33[78]|bc84[6-9]|bc850|bc81[78]|bc635|bc639|bd13[579]|bd243|tip31|tip4[01]|tip12[0-2]|tip14[0-2]|tip3055|mje340|mje3055|s8050|s901[348]|2sc\d|c1815|mmbt3904|mmbt2222|pn2222|mpsa0[56]|mpsa4[23]|mpsa1[34])/i;
const FET_RE = /mosfet|\bfet\b|_fet|fet_|jfet|igbt|q_[np](mos|jfet|igbt)|[np]mos|transistor_fet|\birf|\birl|\bbss\d|2n700[02]|\bbs1[67]0|\bbs250|\bao3\d|\bsi23\d|2n545\d|\bj1\d\d\b/i;

const PREFIXES = {
  potentiometer: ['RV', 'VR', 'POT', 'TRIM', 'RPOT', 'PT'],
  ldr: ['LDR', 'PR', 'PHR', 'RLDR'],
  thermistor: ['TH', 'NTC', 'PTC', 'RT', 'RTH', 'THM'],
  led: ['LED', 'LD', 'DL', 'LEDS'],
  zener: ['DZ', 'ZD', 'Z'],
  resistor: ['R', 'RES'],
  capacitor: ['C', 'CP', 'CE', 'CAP', 'EC'],
  inductor: ['L', 'IND'],
  fuse: ['F', 'FU', 'FUSE'],
  diode: ['D', 'DS', 'CR'],
  transistor: ['Q', 'T', 'TR', 'VT', 'TRS'],
  switch: ['SW', 'S', 'BTN', 'PB', 'KEY', 'SB', 'BUTTON'],
  battery: ['BT', 'B', 'BAT', 'BATT', 'GB'],
  supply: ['V', 'VS', 'VSRC', 'PS'],
  motor: ['M', 'MOT', 'MG', 'MOTOR'],
  speaker: ['LS', 'SPK', 'SP', 'SPEAKER'],
  buzzer: ['BZ', 'BUZ', 'BUZZER', 'PZ'],
  lamp: ['LP', 'LA', 'LAMP', 'BULB'],
};
const PREFIX_TYPE = Object.fromEntries(Object.entries(PREFIXES).flatMap(([type, list]) => list.map(p => [p, type])));

const SKIPS = [
  [/^(U|IC|AR|OA|N)$/, /\b(ic|mcu|opamp|op-amp|amplifier|regulator|timer|ne555|lm\d{3}|74[a-z]*\d+|atmega|attiny|esp32|esp8266|stm32)/, "integrated circuits aren’t supported yet"],
  [/^(J|P|CN|CON|XS|XP|JACK|PL|SK|USB|X)$/, /\b(conn|connector|header|jack|socket|terminal|usb|pin_?header|screw_?terminal)/, 'connectors are left out'],
  [/^TP$/, /test.?point/, 'test points are left out'],
  [/^(H|MH|HOLE)$/, /mounting.?hole|mountinghole/, 'mounting holes are left out'],
  [/^(Y|XTAL|OSC|XT)$/, /crystal|xtal|oscillator|resonator|\d\s*[mk]hz\b/, "crystals and oscillators aren’t supported"],
  [/^(K|RLY|RELAY)$/, /relay/, "relays aren’t supported yet"],
  [/^(RN|RA|RR|RM)$/, /resistor.?(network|array)|r_pack|rpack/, 'resistor networks aren’t supported yet'],
  [/^(JP|SJ)$/, /jumper|solder_?jumper/, 'jumpers are left out'],
  [/^(FB|FL)$/, /ferrite|bead/, 'ferrite beads and filters are left out'],
  [/^(NT)$/, /net_?tie/, 'net ties are left out'],
  [/^(MIC|MK)$/, /microphone|electret/, 'microphones aren’t supported yet'],
  [/^(BUS|CONN|PWR|LCD|DISP|DS?PL|ANT|AE)$/, /\bbus\b|display|antenna/, 'connectors, displays and antennas are left out'],
  [/^(REG|VREG|VR?EG)$/, /regulator|ldo/, 'voltage regulators aren’t supported yet'],
  [/^(FID|LOGO|G|REF)$/, /fiducial|logo|graphic|frame/, 'drawing items are left out'],
];

const hasHint = (re, ...texts) => texts.some(t => re.test(t));

/**
 * Classify a source part. Returns { type } with a registry type, or
 * { type: null, reason } explaining why it's left out.
 */
export function classifyPart({ ref = '', lib = '', value = '', footprint = '', description = '', pinCount } = {}) {
  const letters = (String(ref).replace(/^#/, '').match(/^[A-Za-z]+/)?.[0] || '').toUpperCase();
  const l = String(lib).toLowerCase(), v = String(value).toLowerCase(), d = String(description).toLowerCase(), f = String(footprint).toLowerCase();
  const hint = re => hasHint(re, l, v, d);
  // Designator prefix: the letters as written ('LED1' → LED, 'SW1' → SW). User
  // names like 'VIN1', 'RLOAD', 'COUT' fall back to their first letter, but only
  // for R, C, V and Q, where that's unambiguous.
  let base, prefix = letters;
  const eagleDefault = /^U\$/.test(ref);
  const skipFor = p => SKIPS.find(([prefixRe]) => prefixRe.test(p));
  if (!eagleDefault && letters) {
    if (PREFIX_TYPE[letters]) base = PREFIX_TYPE[letters];
    else if (letters === 'G' && hint(/battery|\bcell\b|akku/)) base = 'battery'; // IEC battery designator
    else if (skipFor(letters)) {
      // X is ambiguous (connector or crystal): let the library/value decide.
      const byHint = letters === 'X' && SKIPS.find(([, hintRe]) => hint(hintRe));
      return { type: null, reason: (byHint || skipFor(letters))[2] };
    }
    else if (/^[RCVQ]/.test(letters) && letters.length <= 6) { prefix = letters[0]; base = PREFIX_TYPE[prefix]; }
  }
  if (!base) {
    if (hint(/battery|accumulator|akku/)) base = 'battery';
    else if (hint(/buzzer|piezo|beeper|summer/)) base = 'buzzer';
    else if (hint(/speaker|loudspeaker|lautsprecher/)) base = 'speaker';
    else if (hint(/\bmotor|motor_|dc_?motor/)) base = 'motor';
    else if (hint(/\blamp|bulb|incandescent|lampe/)) base = 'lamp';
    else if (hint(/(^|[^a-z])led([^a-z]|$)/)) base = 'led';
    else if (hint(/\bfuse|polyfuse/)) base = 'fuse';
    else if (hint(/potentiometer|trimmer|\bpot\b|trim_?pot/)) base = 'potentiometer';
    else if (hint(/thermistor|\bntc\b|\bptc\b/)) base = 'thermistor';
    else if (hint(/photo.?resist|\bldr\b|photocell/)) base = 'ldr';
    else if (hint(/resistor|^r-(us|eu)|^r_/)) base = 'resistor';
    else if (hint(/capacitor|^c-(us|eu)|^cpol|^c_/)) base = 'capacitor';
    else if (hint(/inductor|choke/)) base = 'inductor';
    else if (hint(/zener/)) base = 'zener';
    else if (hint(/diode|rectifier/)) base = 'diode';
    else if (hint(/\bnpn\b|\bpnp\b|transistor_bjt|q_npn|q_pnp/)) base = 'transistor';
    else if (hint(/ammeter/)) base = 'ammeter';
    else if (hint(/voltmeter/)) base = 'voltmeter';
    else if (hint(/push.?button|tact|switch|taster/)) base = 'switch';
    if (!base) {
      for (const [, hintRe, reason] of SKIPS) if (hint(hintRe) || hintRe.test(f)) return { type: null, reason };
      return { type: null, reason: "this kind of part isn’t supported yet" };
    }
  }
  switch (base) {
    case 'resistor':
      if (hint(/potentiometer|trimmer|r_pot|\bpot\b|trim/)) return { type: 'potentiometer' };
      if (hint(/photo|\bldr\b|r_photo|light.?dependent/)) return { type: 'ldr' };
      if (hint(/thermistor|\bntc\b|\bptc\b|r_thermistor/)) return { type: 'thermistor' };
      if (hint(/network|array|r_pack|rpack/)) return { type: null, reason: 'resistor networks aren’t supported yet' };
      return { type: 'resistor' };
    case 'diode':
    case 'zener':
    case 'led':
      if (hint(/(^|[^a-z])led([^a-z]|$)|_led|led_/) || base === 'led') {
        if (hint(/rgb|bicolou?r|dual/) || pinCount > 2) return { type: null, reason: 'multi-colour LEDs aren’t supported yet' };
        return { type: 'led' };
      }
      if (base === 'zener' || hint(/zener|d_zener|\bbz[xtv]|1n47[2-6]\d|1n52[2-5]\d|mmsz|\bzd\b|\bdz\b|\btvs\b/)) return { type: 'zener' };
      if (hint(/bridge|\bdb\d|\bgbu|kbp/) || pinCount > 2) return { type: null, reason: 'bridge rectifiers and multi-diode packages aren’t supported yet' };
      return { type: 'diode' };
    case 'transistor':
      if (hint(FET_RE)) return { type: null, reason: 'MOSFETs and other FETs aren’t supported yet' };
      if (hint(/transformer|trafo/)) return { type: null, reason: 'transformers aren’t supported yet' };
      if (hint(/pnp/)) return { type: 'pnp' };
      if (hint(/npn/)) return { type: 'npn' };
      if (hint(PNP_PARTS)) return { type: 'pnp' };
      if (prefix === 'T' && !hint(NPN_PARTS) && !hint(/transistor|bjt/) && pinCount !== 3) return { type: null, reason: 'transformers aren’t supported yet' };
      return { type: 'npn' };
    case 'switch':
      if (hint(/dip|rotary|dpdt|dp3t|sp3t|4pdt|encoder|reed/)) return { type: null, reason: 'this kind of switch isn’t supported yet' };
      if (hint(/spdt|changeover|on-on|umschalter|toggle_?3|slide_?spdt/) || pinCount === 3) return { type: 'spdt' };
      if (hint(/push|button|tact|momentary|taster|\bkey|10-xx|b3f|tl11\d\d|kmr2|pts\d/) || ['BTN', 'PB', 'KEY', 'SB', 'BUTTON'].includes(prefix)) return { type: 'pushbutton' };
      return { type: 'switch' };
    case 'battery':
      // Only the library id and value: descriptions say things like 'Multiple-cell battery'.
      if ([l, v].some(t => /battery_cell|\bcoin|cr\d{4}|lir\d{4}|(^|[:_\s\\])cell\b/.test(t))) return { type: 'cell' };
      return { type: 'battery' };
    case 'lamp':
      return { type: 'lamp' };
    default:
      if (base === 'speaker' && hint(/buzzer|piezo|beeper/)) return { type: 'buzzer' };
      if (base === 'motor' && hint(FET_RE)) return { type: null, reason: 'MOSFETs and other FETs aren’t supported yet' };
      if (base === 'motor' && pinCount > 2) return { type: null, reason: "this kind of part isn’t supported yet" };
      return { type: base };
  }
}

/** The registry type for a source part, or null. See classifyPart for the reason. */
export const inferType = info => classifyPart(info).type;

// ---------------------------------------------------------------------------
// Pin mapping

const normName = s => String(s ?? '').replace(/~\{([^}]*)\}/g, '$1').replace(/[~{}\s]/g, '').replace(/−/g, '-').toLowerCase();
const ROLE_PATTERNS = {
  diode: [/^(a|an|anode|\+|p|anod)$/, /^(k|c|ca|cathode|kathode|kat|-|n)$/],
  bjt: [/^(c|collector|kollektor|col)$/, /^(b|base|basis)$/, /^(e|emitter|emit)$/],
  polar: [/^(\+|pos|positive|plus|p|v\+|vcc|vin|1\+)$/, /^(-|neg|negative|minus|n|v-|gnd|vss|2-)$/],
  potentiometer: [/^(a|e1|enda|ccw|l|1)$/, /^(e|b|e2|endb|cw|r|3)$/, /^(w|wiper|s|sl|slider|wip|2)$/],
};
const ROLE_OF = { diode: 'diode', led: 'diode', zener: 'diode', npn: 'bjt', pnp: 'bjt', battery: 'polar', cell: 'polar', supply: 'polar', motor: 'polar', buzzer: 'polar', ammeter: 'polar', voltmeter: 'polar', potentiometer: 'potentiometer' };
const byNumber = (a, b) => String(a.number ?? '').localeCompare(String(b.number ?? ''), undefined, { numeric: true });

/**
 * Map source pins onto the registry pin order for `type`. Source pins look like
 * { number, name, x?, y?, lx?, ly?, net } where lx/ly are optional symbol-local
 * coordinates used for SPDT common detection. `order` optionally lists source pin
 * numbers in registry order (e.g. KiCad diodes: ['2', '1'], since pin 1 is K).
 * Returns the reordered pins, or null when they can’t be mapped.
 */
export function mapPins(type, pins, { order } = {}) {
  const want = PARTS[type]?.pins.length ?? 0;
  let list = pins.slice();
  if (list.length > want) {
    const connected = list.filter(p => p.net != null);
    if (connected.length >= want) list = connected;
  }
  const roles = ROLE_PATTERNS[ROLE_OF[type]];
  if (roles) {
    // Names identify every role (A/K, B/C/E, +/−, wiper …) with distinct pins.
    const chosen = roles.map(re => list.filter(p => re.test(normName(p.name))).sort(byNumber)[0]);
    if (chosen.every(Boolean) && new Set(chosen).size === roles.length) return chosen;
  }
  if (type === 'spdt' && list.length === 3) {
    const common = spdtCommon(list);
    if (common) return [common, ...list.filter(p => p !== common).sort(byNumber)];
  }
  if (order && order.length === want) {
    const chosen = order.map(n => list.find(p => String(p.number) === String(n)));
    if (chosen.every(Boolean)) return chosen;
  }
  if (list.length === want) return list.slice().sort(byNumber);
  if (want === 2 && list.length > 2) {
    const groups = new Map();
    for (const p of list.slice().sort(byNumber)) {
      const key = p.net ?? `__solo${p.number}`;
      if (!groups.has(key)) groups.set(key, p);
    }
    if (groups.size === 2) return [...groups.values()];
  }
  return null;
}

function spdtCommon(list) {
  const coords = list.map(p => [p.lx ?? p.x, p.ly ?? p.y]);
  if (coords.some(c => !finite(c[0]) || !finite(c[1]))) return null;
  for (const axis of [0, 1]) {
    for (let i = 0; i < 3; i++) {
      const others = [0, 1, 2].filter(j => j !== i);
      const [a, b] = others.map(j => coords[j][axis]);
      if (Math.abs(a - b) < 1e-6 && Math.abs(coords[i][axis] - a) > 1e-6) return list[i];
    }
  }
  const named = list.find(p => /^(com|common|c|0|cm|p)$/.test(normName(p.name)));
  return named || null;
}

// ---------------------------------------------------------------------------
// Geometry helpers

function rotate([x, y], degrees) {
  switch (((degrees % 360) + 360) % 360) {
    case 90: return [-y, x];
    case 180: return [-x, -y];
    case 270: return [y, -x];
    default: return [x, y];
  }
}

const centroid = pts => {
  const n = pts.length || 1;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
};

/** The schematic rotation (0/90/180/270) and centre that best map the registry's
 * schematic pins onto the given (already scaled) source pin positions. */
export function fitPlacement(type, points) {
  const reg = PARTS[type].schematic.pins;
  if (type === 'ground' || reg.length < 2 || points.length < 2) {
    const [px, py] = points[0] || [0, 0];
    const [ox, oy] = reg[0] || [0, 0];
    return { rotation: 0, x: px - ox, y: py - oy };
  }
  const rc = centroid(reg), sc = centroid(points);
  let best = null;
  for (const rotation of [0, 90, 180, 270]) {
    let err = 0;
    reg.forEach((p, i) => {
      const [x, y] = rotate([p[0] - rc[0], p[1] - rc[1]], rotation);
      err += (x - (points[i][0] - sc[0])) ** 2 + (y - (points[i][1] - sc[1])) ** 2;
    });
    if (!best || err < best.err - 1e-9) best = { err, rotation };
  }
  const [ox, oy] = rotate(rc, best.rotation);
  return { rotation: best.rotation, x: sc[0] - ox, y: sc[1] - oy };
}

const overlaps = (a, b, margin = 0) => a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;

/**
 * Resolve overlapping boxes greedily: heavier items nearest the drawing's centre
 * keep their place; each further item, if it overlaps something already placed,
 * moves away from it along the axis needing the smaller push and keeps moving in
 * that one direction until it's clear. Monotonic, so it always terminates.
 * `items` are { c, weight }; positions go through get/set; boxes come from box(c).
 */
function separate(items, { get, set, box, grid, margin }) {
  if (items.length < 2) return;
  const step = v => Math.max(grid, Math.ceil((v - 1e-9) / grid) * grid);
  const pos = items.map(it => get(it.c));
  const cx = pos.reduce((a, p) => a + p.x, 0) / pos.length, cy = pos.reduce((a, p) => a + p.y, 0) / pos.length;
  const order = items.map((it, i) => ({ it, i, d: Math.hypot(pos[i].x - cx, pos[i].y - cy) }))
    .sort((a, b) => b.it.weight - a.it.weight || a.d - b.d || a.i - b.i);
  const placed = [];
  for (const { it } of order) {
    let dir = null;
    for (let guard = 0; guard < 2000; guard++) {
      const b = box(it.c);
      const hit = placed.find(p => overlaps(b, p.box, margin));
      if (!hit) break;
      const o = hit.box;
      const ox = Math.min(b.x + b.w, o.x + o.w) - Math.max(b.x, o.x) + margin;
      const oy = Math.min(b.y + b.h, o.y + o.h) - Math.max(b.y, o.y) + margin;
      if (!dir) {
        const bx = b.x + b.w / 2 - (o.x + o.w / 2), by = b.y + b.h / 2 - (o.y + o.h / 2);
        const sx = bx || (b.x + b.w / 2 - cx) || 1, sy = by || (b.y + b.h / 2 - cy) || 1;
        dir = ox <= oy ? { x: Math.sign(sx), y: 0 } : { x: 0, y: Math.sign(sy) };
      }
      // Distance to clear the hit box in the chosen direction.
      const need = dir.x > 0 ? o.x + o.w + margin - b.x : dir.x < 0 ? b.x + b.w + margin - o.x : dir.y > 0 ? o.y + o.h + margin - b.y : b.y + b.h + margin - o.y;
      const p = get(it.c);
      set(it.c, { x: p.x + dir.x * step(need), y: p.y + dir.y * step(need) });
    }
    placed.push({ it, box: box(it.c) });
  }
}

// ---------------------------------------------------------------------------
// Automatic layout for formats without geometry (SPICE, KiCad netlists)

const ROW = 80; // one vertical part (two-pin pitch)
const GROUND_CLUSTER = 80; // ground pins within this horizontal distance share a ground symbol
const GAP = 60; // between neighbouring columns

/**
 * Give parts readable schematic pin positions using the usual conventions: the
 * supply rail along the top, ground at the bottom, signal flowing left → right.
 *  - Sources stand vertically on the left, + up.
 *  - Series parts lie horizontally on their net's row, ordered by distance from the rail.
 *  - Shunts (one end on ground) hang vertically; ground goes at the bottom.
 *  - Chains feeding a transistor's collector or emitter stack vertically in its column.
 *  - Parts driving a transistor base lie horizontally into the base.
 *  - Transistors: base on the left, collector up, emitter down (PNPs with the
 *    emitter on the rail side are turned over).
 * Returns new parts with pin x/y in schematic units (buildProject infers scale 1).
 */
export function autoLayout(parts, { groundNets = [] } = {}) {
  const groundSet = new Set(groundNets.map(String));
  const isGround = net => net != null && (groundSet.has(String(net)) || isGroundName(net));
  const live = net => net != null && !isGround(net);
  const comps = parts.filter(p => p.type !== 'ground' && PARTS[p.type]?.schematic);
  if (!comps.length) return parts;
  const isSource = p => SOURCE_TYPES.has(p.type);
  const isBjt = p => p.type === 'npn' || p.type === 'pnp';
  const netsOf = p => p.pins.map(pin => pin.net);
  const netParts = new Map();
  for (const p of comps) for (const net of netsOf(p)) {
    if (!live(net)) continue;
    if (!netParts.has(net)) netParts.set(net, []);
    if (!netParts.get(net).includes(p)) netParts.get(net).push(p);
  }

  // Distances (in parts) from the supply rail(s) and from ground.
  let rails = [...new Set(comps.filter(isSource).map(s => s.pins[0]?.net).filter(live))];
  if (!rails.length) rails = [...netParts.keys()].filter(n => railVoltage(n));
  if (!rails.length && netParts.size) rails = [[...netParts.keys()][0]];
  const bfs = start => {
    const dist = new Map(start.map(n => [n, 0]));
    let frontier = [...start];
    while (frontier.length) {
      const next = [];
      for (const net of frontier) for (const p of netParts.get(net) || []) for (const n of netsOf(p)) {
        if (live(n) && !dist.has(n)) { dist.set(n, dist.get(net) + 1); next.push(n); }
      }
      frontier = next;
    }
    return dist;
  };
  const dTop = bfs(rails);
  const dBot = bfs([...new Set(comps.filter(p => !isSource(p) && netsOf(p).some(isGround)).flatMap(p => netsOf(p).filter(live)))]);
  const top = net => dTop.get(net) ?? 99;
  const rank = net => isGround(net) ? Infinity : top(net) - (dBot.get(net) ?? 50);
  const baseOf = new Map(); // base net → transistor
  for (const q of comps.filter(isBjt)) if (live(q.pins[1].net) && !baseOf.has(q.pins[1].net)) baseOf.set(q.pins[1].net, q);

  // Roles and orientation.
  const role = new Map();
  for (const p of comps) {
    const [n0, n1, n2] = netsOf(p);
    if (isSource(p)) role.set(p, { kind: 'vertical', rotation: 0, top: n0, bottom: n1 });
    else if (isBjt(p)) {
      const flip = p.type === 'pnp' && rank(n2) < rank(n0); // emitter nearer the rail
      role.set(p, flip ? { kind: 'bjt', rotation: 180, top: n2, bottom: n0, axis: -20 } : { kind: 'bjt', rotation: 0, top: n0, bottom: n2, axis: 20 });
    } else if (p.type === 'potentiometer') {
      const up = rank(n0) <= rank(n1);
      role.set(p, { kind: 'vertical', rotation: up ? 90 : 270, top: up ? n0 : n1, bottom: up ? n1 : n0 });
    } else if (p.pins.length === 2) {
      const g0 = isGround(n0), g1 = isGround(n1);
      if (g0 !== g1) {
        role.set(p, { kind: 'vertical', rotation: g1 ? 90 : 270, top: g1 ? n0 : n1, bottom: g1 ? n1 : n0 });
      } else if (!g0 && baseOf.has(n0) !== baseOf.has(n1)) {
        const onBase = baseOf.has(n1) ? 1 : 0;
        role.set(p, { kind: 'drive', base: onBase ? n1 : n0, onBase });
      } else {
        role.set(p, { kind: 'horizontal', rotation: top(n0) <= top(n1) ? 0 : 180 });
      }
    } else role.set(p, { kind: 'horizontal', rotation: 0 });
  }
  // Series chains that feed a transistor's collector or emitter become a vertical
  // load stack in the transistor's column.
  for (const q of comps.filter(isBjt)) {
    for (const [start, up] of [[role.get(q).top, true], [role.get(q).bottom, false]]) {
      let net = start, prev = q;
      for (let guard = 0; live(net) && !rails.includes(net) && guard < comps.length; guard++) {
        const others = (netParts.get(net) || []).filter(o => o !== prev && !isSource(o));
        const o = others[0];
        if (others.length !== 1 || o.pins.length !== 2 || role.get(o).kind === 'drive' || isBjt(o)) break;
        const [a, b] = netsOf(o);
        const far = a === net ? b : a;
        const nearIs0 = a === net;
        // Going up from the collector, the far end is on top; going down, it's below.
        const pin0Top = up ? !nearIs0 : nearIs0;
        role.set(o, { kind: 'vertical', rotation: pin0Top ? 90 : 270, top: up ? far : net, bottom: up ? net : far });
        if (isGround(far)) break;
        prev = o; net = far;
      }
    }
  }

  // Rows: the rail is row 0; vertical parts drop one row; horizontal parts stay on
  // their row; a transistor's base sits half a row below its collector.
  const level = new Map(rails.map(n => [n, 0]));
  const setLevel = (net, v) => {
    if (!live(net) || !Number.isFinite(v) || level.get(net) === v) return false;
    level.set(net, v);
    return true;
  };
  for (let pass = 0; pass < comps.length * 2 + 4; pass++) {
    let changed = false;
    for (const p of comps) {
      const r = role.get(p), [n0, n1] = netsOf(p);
      if (r.kind === 'vertical' || r.kind === 'bjt') {
        const want = level.has(r.top) ? level.get(r.top) + 1 : undefined;
        if (want !== undefined && live(r.bottom) && !(level.get(r.bottom) >= want) && pass < comps.length * 2) changed = setLevel(r.bottom, want) || changed;
        if (!level.has(r.top) && level.has(r.bottom)) changed = setLevel(r.top, level.get(r.bottom) - 1) || changed;
        if (r.kind === 'bjt' && level.has(r.top) && live(p.pins[1].net) && baseOf.get(p.pins[1].net) === p) changed = setLevel(p.pins[1].net, level.get(r.top) + 0.5) || changed;
      } else if (r.kind === 'horizontal' && p.pins.length === 2) {
        if (level.has(n0) && !level.has(n1)) changed = setLevel(n1, level.get(n0)) || changed;
        if (level.has(n1) && !level.has(n0)) changed = setLevel(n0, level.get(n1)) || changed;
      } else if (r.kind === 'drive') {
        const other = r.onBase ? n0 : n1;
        if (level.has(r.base) && !level.has(other)) changed = setLevel(other, level.get(r.base)) || changed;
      }
    }
    if (!changed) break;
  }
  const yOf = net => (level.get(net) ?? 0) * ROW;

  // Columns: vertical chains share a column; every other part gets its own.
  const group = new Map(comps.map(p => [p, p]));
  const findGroup = p => { while (group.get(p) !== p) p = group.get(p); return p; };
  const stackable = p => !isSource(p) && ['vertical', 'bjt'].includes(role.get(p).kind);
  for (const [net, members] of netParts) {
    const above = members.filter(p => stackable(p) && role.get(p).bottom === net);
    const below = members.filter(p => stackable(p) && role.get(p).top === net);
    if (above.length && below.length) group.set(findGroup(below[0]), findGroup(above[0]));
  }
  const drives = comps.filter(p => role.get(p).kind === 'drive');
  const groups = new Map();
  for (const p of comps) {
    if (role.get(p).kind === 'drive') continue;
    const g = findGroup(p);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  const keyOf = members => {
    if (members.some(isSource)) return -1;
    const own = members.flatMap(p => { const r = role.get(p); return r.kind === 'horizontal' ? netsOf(p) : [r.top]; }).filter(live);
    return Math.min(99, ...own.map(top));
  };
  const ordered = [...groups.values()].sort((a, b) => keyOf(a) - keyOf(b) || comps.indexOf(a[0]) - comps.indexOf(b[0]));

  // Place each column: centres from the axis (the shared pin line) and rows.
  const placed = new Map();
  const centreOf = p => {
    const r = role.get(p);
    if (r.kind === 'bjt') return { x: -r.axis, y: (level.has(r.top) ? yOf(r.top) : level.has(r.bottom) ? yOf(r.bottom) - ROW : 0) + ROW / 2 };
    if (r.kind === 'vertical') return { x: 0, y: (level.has(r.top) ? yOf(r.top) : level.has(r.bottom) ? yOf(r.bottom) - ROW : 0) + ROW / 2 };
    const ys = netsOf(p).filter(live).map(yOf);
    return { x: 0, y: ys.length ? Math.min(...ys) : 0 };
  };
  const boxAt = (p, x, y, rotation) => partBox({ type: p.type, x: 0, y: 0, schematic: { x, y, rotation } }, 'schematic');
  let right = -Infinity;
  for (const members of ordered) {
    const local = members.map(p => ({ p, ...centreOf(p), rotation: role.get(p).rotation ?? 0 }));
    // Room on the left of a transistor for the parts driving its base.
    const feeding = members.filter(isBjt).flatMap(q => drives.filter(d => baseOf.get(role.get(d).base) === q).map(d => ({ d, q })));
    let left = Math.min(...local.map(e => boxAt(e.p, e.x, e.y, e.rotation).x));
    let extra = Math.max(...local.map(e => { const b = boxAt(e.p, e.x, e.y, e.rotation); return b.x + b.w; }));
    for (const { q } of feeding) {
      const e = local.find(l => l.p === q);
      if (role.get(q).rotation === 0) left = Math.min(left, e.x - 40 - 140);
      else extra = Math.max(extra, e.x + 40 + 140);
    }
    const axis = Number.isFinite(right) ? Math.ceil((right + GAP - left) / SCHEMATIC_GRID) * SCHEMATIC_GRID : 0;
    for (const e of local) placed.set(e.p, { x: axis + e.x, y: e.y, rotation: e.rotation });
    right = axis + extra;
    // Base drivers: horizontal, ending 40 units short of the base pin.
    for (const { d, q } of feeding) {
      const at = placed.get(q), r = role.get(d), k = feeding.filter(f => f.q === q).findIndex(f => f.d === d);
      const leftSide = role.get(q).rotation === 0;
      const baseX = at.x + (leftSide ? -40 : 40);
      placed.set(d, {
        x: baseX + (leftSide ? -80 : 80), y: at.y + k * 60,
        rotation: leftSide === (r.onBase === 1) ? 0 : 180,
      });
    }
  }
  return parts.map(p => {
    const at = placed.get(p);
    if (!at) return p;
    const reg = PARTS[p.type].schematic.pins;
    const pins = p.pins.map((pin, i) => {
      const [dx, dy] = rotate(reg[i] || [0, 0], at.rotation);
      return { ...pin, x: at.x + dx, y: at.y + dy };
    });
    return { ...p, pins, center: { x: at.x, y: at.y } };
  });
}

// ---------------------------------------------------------------------------
// Values in registry units

const SI_PREFIXES = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
const TO_SI = { 'μF': [1e-6, 'F'], mH: [1e-3, 'H'], 'Ω': [1, 'Ω'], V: [1, 'V'], A: [1, 'A'] };
/** Friendly engineering notation for a registry value, e.g. 4.7e-5 μF → '47 pF'. */
export function formatQuantity(value, unit) {
  const [k, base] = TO_SI[unit] || [1, unit];
  const si = value * k;
  if (!finite(si)) return String(value);
  const [div, prefix] = SI_PREFIXES.find(([d]) => Math.abs(si) >= d * 0.9995) || SI_PREFIXES.at(-1);
  return `${Number((si / div).toPrecision(3))} ${prefix}${base}`.trim();
}

function clampToField(type, raw, ref, notes) {
  const field = PARTS[type].field;
  const value = finite(raw) ? Number(raw.toPrecision(12)) : raw;
  if (!field || !finite(value)) return value;
  if (value < field.min || value > field.max) {
    const clamped = Math.min(field.max, Math.max(field.min, value));
    notes.clamped.push(`${ref} ${formatQuantity(value, PARTS[type].unit)} → ${formatQuantity(clamped, PARTS[type].unit)}`);
    return clamped;
  }
  return value;
}

const formatNumber = v => String(Number(Number(v).toPrecision(4)));

function registryValue(part, notes) {
  const { type, ref } = part;
  const def = PARTS[type].value;
  if (finite(part.registryValue)) return clampToField(type, part.registryValue, ref, notes);
  const si = finite(part.value) ? part.value : NaN;
  const textHint = [part.text, part.lib, part.model].filter(Boolean).join(' ');
  const unreadable = () => {
    if (part.text && String(part.text).trim()) notes.unreadable.push(`${ref} (“${part.text}” → ${formatQuantity(def, PARTS[type].unit)})`);
    return def;
  };
  switch (type) {
    case 'resistor': case 'potentiometer': case 'lamp': case 'motor': case 'buzzer': case 'speaker': {
      // Potentiometer tapers: 'B10K', '10k LIN', '10kB'.
      const pot = type === 'potentiometer' && !finite(si) ? parseValue(String(part.text ?? '').replace(/^[ABC](?=\d)|\s*(lin|log|lin\.|log\.)$|(?<=[kKM])[ABC]$/i, ''), { type }) : NaN;
      const ohms = finite(si) ? si : pot;
      if (ohms === 0) return PARTS[type].field.min; // 0 Ω links behave like wires
      if (finite(ohms) && ohms > 0) return clampToField(type, ohms, ref, notes);
      return type === 'resistor' || type === 'potentiometer' ? unreadable() : def;
    }
    case 'capacitor':
      return finite(si) && si >= 0 ? clampToField(type, si * 1e6, ref, notes) : unreadable();
    case 'inductor':
      return finite(si) && si > 0 ? clampToField(type, si * 1e3, ref, notes) : unreadable();
    case 'fuse':
      return finite(si) && si > 0 ? clampToField(type, si, ref, notes) : def;
    case 'battery': case 'cell':
      return finite(si) ? clampToField(type, si, ref, notes) : def;
    case 'supply':
      return finite(si) ? clampToField(type, si, ref, notes) : unreadable();
    case 'diode':
      return isSchottky(textHint) ? 0.3 : 0.7;
    case 'led':
      return ledStyle(textHint).vf;
    case 'zener': {
      const vz = zenerVoltage(part.text) ?? zenerVoltage(part.model) ?? zenerVoltage(part.lib);
      return clampToField(type, vz ?? def, ref, notes);
    }
    default:
      return def;
  }
}

// ---------------------------------------------------------------------------
// buildProject

const idFrom = ref => String(ref || '').toLowerCase().replace(/[:\s]+/g, '-').replace(/[^\w.#$+-]/g, '') || 'part';

/**
 * Build a Current project from parsed parts.
 *
 * parts: [{
 *   ref,                     // original designator ('R1'); generated if missing
 *   type,                    // registry type, or 'ground' for ground symbols
 *   value?,                  // SI number (Ω, F, H, V, A) — converted to registry units
 *   registryValue?,          // already in registry units (wins over `value`)
 *   text?, lib?, model?,     // free text hints (LED colour, zener voltage, schottky)
 *   color?, position?,       // LED colour hex, potentiometer wiper %
 *   pins: [{ net, x, y }],   // registry pin order; SOURCE coordinates, y-down; net null = unconnected
 * }]
 * groundNets: net keys that are ground even without a ground symbol (SPICE node 0)
 * rails: [{ net, x, y }] positions of power-rail symbols (optional, for placement)
 * scale: fallback source→schematic scale when it can’t be inferred from pin pitch
 *
 * Returns { project, nets, warnings }.
 */
export function buildProject({ name = 'Imported circuit', parts = [], groundNets = [], rails = [], scale, warnings: inheritedWarnings = [] } = {}) {
  const warnings = [...inheritedWarnings];
  let solo = 0;
  const input = parts.filter(p => PARTS[p.type] && p.type !== 'breadboard').map(p => ({
    ...p,
    pins: p.pins.map(pin => ({ ...pin, net: pin.net == null ? `__nc${solo++}` : String(pin.net) })),
  }));

  // Negative sources: swap terminals so values stay positive.
  for (const p of input) {
    if (!SOURCE_TYPES.has(p.type)) continue;
    const v = finite(p.registryValue) ? p.registryValue : p.value;
    if (finite(v) && v < 0) {
      p.pins = [p.pins[1], p.pins[0]];
      if (finite(p.registryValue)) p.registryValue = -p.registryValue; else p.value = -p.value;
    }
  }
  for (const p of input) if (p.type === 'cell' && (p.registryValue ?? p.value) > 12) p.type = 'battery';

  // --- Ground nets ---------------------------------------------------------
  const ground = new Set(groundNets.map(String));
  for (const p of input) if (p.type === 'ground') ground.add(p.pins[0].net);
  const allNets = new Set(input.flatMap(p => p.pins.map(pin => pin.net)));
  for (const net of allNets) if (isGroundName(net)) ground.add(net);
  // A source between two "ground" nets (e.g. a VSS rail driven from GND) means
  // the weaker name isn’t really ground.
  const strength = net => /^(0|gnd)$/i.test(String(net).replace(/^.*\//, '')) ? 3 : /gnd|earth|chassis/i.test(net) ? 2 : 1;
  for (const p of input) {
    if (!SOURCE_TYPES.has(p.type)) continue;
    const [a, b] = p.pins.map(pin => pin.net);
    if (a !== b && ground.has(a) && ground.has(b)) ground.delete(strength(a) < strength(b) ? a : b);
  }

  const components = input.filter(p => p.type !== 'ground');
  const groundSymbols = input.filter(p => p.type === 'ground' && ground.has(p.pins[0].net));
  const netMembers = net => components.filter(c => c.pins.some(pin => pin.net === net));
  // Drop ground symbols on nets with no real parts.
  const usefulGround = groundSymbols.filter(g => netMembers(g.pins[0].net).length);

  // --- Scale and fitted schematic placement -----------------------------------
  const pitches = components.filter(c => c.pins.length === 2 && c.pins.every(p => finite(p.x) && finite(p.y)))
    .map(c => Math.hypot(c.pins[0].x - c.pins[1].x, c.pins[0].y - c.pins[1].y)).filter(d => d > 1e-6).sort((a, b) => a - b);
  const k = pitches.length ? 80 / pitches[Math.floor((pitches.length - 1) / 2)] : (scale || 1);

  const sourced = [...components, ...usefulGround];
  const placed = sourced.map(p => {
    const pts = p.pins.map(pin => [finite(pin.x) ? pin.x * k : NaN, finite(pin.y) ? pin.y * k : NaN]);
    const valid = pts.every(([x, y]) => finite(x) && finite(y));
    return { p, at: valid ? fitPlacement(p.type, pts) : null };
  });
  // Parts without geometry (shouldn't happen after autoLayout) go in a row below.
  const located = placed.filter(e => e.at);
  if (!located.length && placed.length) throw new ImportError('We couldn’t work out where the parts in this file go.');
  const xs = located.map(e => e.at.x), ys = located.map(e => e.at.y);
  const shift = { x: CENTER.x - (Math.min(...xs) + Math.max(...xs)) / 2, y: CENTER.y - (Math.min(...ys) + Math.max(...ys)) / 2 };
  let fallbackX = Math.min(...xs) + shift.x;
  const fallbackY = Math.max(...ys) + shift.y + 160;
  for (const e of placed) {
    if (e.at) e.at = { x: snap(e.at.x + shift.x, SCHEMATIC_GRID), y: snap(e.at.y + shift.y, SCHEMATIC_GRID), rotation: e.at.rotation };
    else { e.at = { x: snap(fallbackX, SCHEMATIC_GRID), y: snap(fallbackY, SCHEMATIC_GRID), rotation: 0 }; fallbackX += 140; }
  }

  // --- Generated parts: grounds for symbol-less ground nets, rail supplies ----
  let entries = placed.map(e => ({ ...e, generated: false }));
  const schematicPin = (e, i) => {
    const [dx, dy] = rotate(PARTS[e.p.type].schematic.pins[i], e.at.rotation);
    return { x: e.at.x + dx, y: e.at.y + dy };
  };
  // Ground nets without symbols (SPICE node 0, a bare GND label) get a ground
  // symbol per cluster of ground pins, under a source's − terminal when the
  // cluster has one, else under its lowest pin.
  const groundedNets = new Set(usefulGround.map(g => g.pins[0].net));
  for (const net of [...ground].sort()) {
    if (groundedNets.has(net)) continue;
    const pins = [];
    for (const e of entries) {
      if (e.p.type === 'ground') continue;
      e.p.pins.forEach((pin, i) => { if (pin.net === net) pins.push({ ...schematicPin(e, i), source: SOURCE_TYPES.has(e.p.type) && i === 1 }); });
    }
    if (!pins.length) continue;
    pins.sort((a, b) => a.x - b.x || a.y - b.y);
    const clusters = [];
    for (const pt of pins) {
      const last = clusters.at(-1);
      if (last && pt.x - last.at(-1).x <= GROUND_CLUSTER) last.push(pt); else clusters.push([pt]);
    }
    for (const cluster of clusters) {
      const anchor = cluster.find(pt => pt.source) || cluster.reduce((a, b) => (b.y > a.y ? b : a));
      entries.push({ p: { type: 'ground', pins: [{ net }] }, at: { x: snap(anchor.x, SCHEMATIC_GRID), y: snap(anchor.y + 60, SCHEMATIC_GRID), rotation: 0 }, generated: true });
    }
    groundedNets.add(net);
  }

  const hasSource = components.some(c => SOURCE_TYPES.has(c.type));
  if (!hasSource) {
    // Rails come from the format (power symbols) or from rail-like net names.
    const railInfo = new Map();
    for (const r of rails) {
      const v = finite(r.voltage) ? { voltage: Math.abs(r.voltage), negative: r.voltage < 0 } : railVoltage(r.net);
      if (v && r.net != null) railInfo.set(String(r.net), v);
    }
    for (const net of allNets) if (!railInfo.has(net) && railVoltage(net)) railInfo.set(net, railVoltage(net));
    const railNets = [...railInfo.keys()].filter(net => !ground.has(net) && netMembers(net).length)
      .sort((a, b) => railInfo.get(b).voltage - railInfo.get(a).voltage);
    if (railNets.length) {
      const boxes = entries.map(e => partBox({ type: e.p.type, x: 0, y: 0, schematic: e.at }, 'schematic'));
      const left = Math.min(...boxes.map(b => b.x)), top = Math.min(...boxes.map(b => b.y));
      const added = [];
      railNets.forEach((net, i) => {
        const { voltage, negative } = railInfo.get(net);
        const gnet = `__railgnd${i}`;
        ground.add(gnet);
        const x = snap(left - 80, SCHEMATIC_GRID), y = snap(top + 40 + i * 180, SCHEMATIC_GRID);
        entries.push({ p: { type: 'supply', registryValue: voltage, pins: negative ? [{ net: gnet }, { net }] : [{ net }, { net: gnet }] }, at: { x, y, rotation: 0 }, generated: true });
        entries.push({ p: { type: 'ground', pins: [{ net: gnet }] }, at: { x, y: y + 80, rotation: 0 }, generated: true });
        added.push(`${formatNumber(voltage)} V for ${net.replace(/^.*\//, '')}`);
      });
      warnings.push(`No battery or power supply was found, so ${added.length === 1 ? 'a supply was' : 'supplies were'} added between each power rail and ground: ${added.join(', ')}.`);
    }
  }

  // --- Limits ----------------------------------------------------------------
  if (entries.length > MAX_COMPONENTS) {
    // Big drawings often repeat the ground symbol: keep one per ground net.
    const seen = new Set(), before = entries.length;
    entries = entries.filter(e => {
      if (e.p.type !== 'ground') return true;
      const net = e.p.pins[0].net;
      if (seen.has(net)) return false;
      seen.add(net);
      return true;
    });
    if (entries.length < before && entries.length <= MAX_COMPONENTS) warnings.push(`${before - entries.length} repeated ground symbols were merged to stay within Current’s ${MAX_COMPONENTS}-part limit.`);
  }
  if (entries.length > MAX_COMPONENTS) throw new ImportError(`This diagram has ${entries.length} parts, but Current supports up to ${MAX_COMPONENTS}. Try importing a smaller section of the circuit.`);

  // --- Ground clusters --------------------------------------------------------
  // The simulator joins ground parts implicitly, so a ground net with several
  // ground symbols isn't wired as one tree: each pin is wired to its nearest
  // ground symbol instead. Symbols that end up with no pins are dropped.
  const nearestGround = new Map(); // entry → [ground entry per pin]
  const multiGround = new Set();
  for (const net of ground) {
    const gs = entries.filter(e => e.p.type === 'ground' && e.p.pins[0].net === net);
    if (gs.length < 2) continue;
    multiGround.add(net);
    const gpos = gs.map(g => schematicPin(g, 0));
    for (const e of entries) {
      if (e.p.type === 'ground') continue;
      e.p.pins.forEach((pin, i) => {
        if (pin.net !== net) return;
        const pt = schematicPin(e, i);
        let best = 0;
        gpos.forEach((q, k) => { if (Math.hypot(q.x - pt.x, q.y - pt.y) < Math.hypot(gpos[best].x - pt.x, gpos[best].y - pt.y)) best = k; });
        if (!nearestGround.has(e)) nearestGround.set(e, []);
        nearestGround.get(e)[i] = gs[best];
      });
    }
  }
  const usedGrounds = new Set([...nearestGround.values()].flat().filter(Boolean));
  entries = entries.filter(e => e.p.type !== 'ground' || !multiGround.has(e.p.pins[0].net) || usedGrounds.has(e));

  // --- Components, ids and refs ---------------------------------------------
  const usedIds = new Set();
  const usedRefs = new Set(entries.filter(e => e.p.type !== 'ground' && !e.generated && e.p.ref && !/^#/.test(e.p.ref)).map(e => e.p.ref));
  const uniqueId = base => {
    let id = base, n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    return id;
  };
  const counters = {};
  const nextRef = prefix => {
    let ref;
    do ref = `${prefix}${counters[prefix] = (counters[prefix] || 0) + 1}`; while (usedRefs.has(ref));
    usedRefs.add(ref);
    return ref;
  };
  // Keep source refs for real parts first so generated refs don’t collide.
  for (const e of entries) {
    if (e.p.type === 'ground' || e.generated || !e.p.ref || /^#/.test(e.p.ref)) continue;
    e.ref = e.p.ref;
  }
  for (const e of entries) {
    if (!e.ref) e.ref = nextRef(e.p.type === 'ground' ? 'GND' : PARTS[e.p.type].prefix);
    e.id = uniqueId(idFrom(e.ref));
  }

  const notes = { warnings, clamped: [], unreadable: [] };
  const comps = entries.map(e => {
    const c = createComponent(e.p.type, e.id, 0, 0);
    c.ref = e.ref;
    c.value = registryValue({ ...e.p, ref: e.ref }, notes);
    if (e.p.type === 'led') c.color = e.p.color && LED_COLORS[e.p.color] ? e.p.color : ledStyle([e.p.text, e.p.lib, e.p.model].filter(Boolean).join(' ')).color;
    if (e.p.type === 'potentiometer' && finite(e.p.position)) c.position = Math.min(100, Math.max(0, e.p.position));
    c.schematic = { x: e.at.x, y: e.at.y, rotation: e.at.rotation };
    return c;
  });
  if (notes.unreadable.length) warnings.push(`Couldn’t read ${notes.unreadable.length === 1 ? 'a value' : `${notes.unreadable.length} values`}, so defaults were used: ${notes.unreadable.join(', ')}.`);
  if (notes.clamped.length) warnings.push(`${notes.clamped.length === 1 ? 'A value was' : `${notes.clamped.length} values were`} outside the range Current can simulate and ${notes.clamped.length === 1 ? 'was' : 'were'} adjusted: ${notes.clamped.join(', ')}.`);
  const items = comps.map((c, i) => ({ c, weight: entries[i].generated ? 0 : c.type === 'ground' ? 1 : 2 }));

  // --- Separate overlapping schematic parts ----------------------------------
  separate(items, {
    get: c => c.schematic, set: (c, p) => { c.schematic = { ...c.schematic, x: p.x, y: p.y }; },
    box: c => partBox(c, 'schematic'), grid: SCHEMATIC_GRID, margin: 0,
  });

  // --- Realistic model layout -------------------------------------------------
  for (const c of comps) {
    c.x = snap(CENTER.x + (c.schematic.x - CENTER.x) * MODEL_SPREAD, 4);
    c.y = snap(CENTER.y + (c.schematic.y - CENTER.y) * MODEL_SPREAD, 4);
    c.rotation = 0;
  }
  separate(items, {
    get: c => ({ x: c.x, y: c.y }), set: (c, p) => { c.x = p.x; c.y = p.y; },
    box: c => partBox(c, 'model'), grid: 4, margin: 12,
  });

  // --- Wires: a minimum spanning tree per net over model pin positions --------
  // (on ground nets with several ground symbols: one tree per ground symbol).
  const netOrder = [], members = new Map();
  const compOf = new Map(entries.map((e, i) => [e, comps[i]]));
  entries.forEach((e, i) => e.p.pins.forEach((pin, j) => {
    if (!members.has(pin.net)) { members.set(pin.net, []); netOrder.push(pin.net); }
    members.get(pin.net).push({ c: comps[i], pin: j, ground: e.p.type === 'ground' ? comps[i] : compOf.get(nearestGround.get(e)?.[j]) });
  }));
  const wires = [];
  let paletteIndex = 0, netCount = 0;
  for (const net of netOrder) {
    const all = members.get(net);
    if (all.length < 2) continue;
    netCount++;
    const isGroundNet = ground.has(net) || all.some(e => e.c.type === 'ground');
    const isPower = all.some(e => SOURCE_TYPES.has(e.c.type) && e.pin === 0);
    const color = isGroundNet ? GROUND_COLOR : isPower ? POWER_COLOR : PALETTE[paletteIndex++ % PALETTE.length];
    const partitions = multiGround.has(net)
      ? [...new Set(all.map(e => e.ground))].map(g => all.filter(e => e.ground === g))
      : [all];
    for (const ends of partitions) addTree(ends, color);
  }
  function addTree(ends, color) {
    if (ends.length < 2) return;
    const pos = ends.map(e => pinPosition(e.c, e.pin, 'model'));
    const inTree = new Array(ends.length).fill(false), best = new Array(ends.length).fill(Infinity), parent = new Array(ends.length).fill(-1);
    best[0] = 0;
    for (let n = 0; n < ends.length; n++) {
      let u = -1;
      for (let i = 0; i < ends.length; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i;
      inTree[u] = true;
      if (parent[u] >= 0) {
        const a = ends[parent[u]], b = ends[u];
        wires.push({ id: `w${wires.length + 1}`, from: `${a.c.id}:${a.pin}`, to: `${b.c.id}:${b.pin}`, color });
      }
      for (let i = 0; i < ends.length; i++) {
        if (inTree[i]) continue;
        const d = Math.hypot(pos[i].x - pos[u].x, pos[i].y - pos[u].y);
        if (d < best[i]) { best[i] = d; parent[i] = u; }
      }
    }
  }

  if (wires.length > MAX_WIRES) throw new ImportError(`This diagram needs ${wires.length} wires, but Current supports up to ${MAX_WIRES}. Try importing a smaller section of the circuit.`);
  const project = { name: String(name || 'Imported circuit').slice(0, 120), components: comps, wires };
  if (!validProject(project)) throw new Error('Importer produced an invalid project');
  return { project, nets: netCount, warnings };
}
