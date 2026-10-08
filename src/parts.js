// Part registry. Pin and box geometry is relative to the part centre before
// rotation. `model` drives the realistic workbench view; `schematic` drives the
// diagram view, whose pins sit on a 20-unit grid. Pin order is significant: it
// is the pin index used in wire endpoints (`${id}:${pin}`).

const field = (label, min, max, step, presets = [], extra = {}) => ({ label, min, max, step, presets, ...extra });
const twoPin = [[-40, 0], [40, 0]];
const vertical = [[0, -40], [0, 40]];
const axial = [[-57, 0], [57, 0]];
const legacyBox = [-67, -57, 67, 50];

export const CATEGORIES = ['Power', 'Passive', 'Semiconductors', 'Switches', 'Output', 'Measure', 'Prototyping'];

export const PARTS = {
  battery: {
    name: 'Battery', description: '9 V battery with snap terminals', category: 'Power', value: 9, unit: 'V', prefix: 'BT',
    pins: ['+', '−'], source: { internal: 1 }, field: field('Voltage', 0.1, 48, 0.1, [1.5, 3, 4.5, 9, 12]),
    model: { pins: [[-37, -72], [38, -72]], box: [-63, -85, 65, 100], label: 111 },
    schematic: { pins: vertical, box: [-24, -40, 24, 40] },
  },
  cell: {
    name: 'Coin cell', description: '3 V lithium cell in a holder', category: 'Power', value: 3, unit: 'V', prefix: 'BT',
    pins: ['+', '−'], source: { internal: 10 }, field: field('Voltage', 0.1, 12, 0.1, [1.5, 3, 3.7]),
    model: { pins: [[-50, 0], [50, 0]], box: [-58, -42, 58, 42] },
    schematic: { pins: vertical, box: [-24, -40, 24, 40] },
  },
  supply: {
    name: 'DC power supply', description: 'Adjustable bench voltage source', category: 'Power', value: 5, unit: 'V', prefix: 'V',
    pins: ['+', '−'], source: { internal: 0.05 }, field: field('Voltage', 0, 30, 0.1, [3.3, 5, 12, 24]),
    model: { pins: [[-28, 48], [28, 48]], box: [-80, -58, 80, 56] },
    schematic: { pins: vertical, box: [-24, -40, 24, 40] },
  },
  ground: {
    name: 'Ground', description: 'Shared 0 V reference point', category: 'Power', value: 0, unit: '', prefix: 'GND',
    pins: ['GND'], field: null,
    model: { pins: [[0, -30]], box: [-28, -38, 28, 30] },
    schematic: { pins: [[0, -20]], box: [-20, -20, 20, 16] },
  },
  resistor: {
    name: 'Resistor', description: 'Limits the flow of current', category: 'Passive', value: 330, unit: 'Ω', prefix: 'R',
    pins: ['1', '2'], field: field('Resistance', 0.01, 10000000, 1, [100, 220, 330, 1000, 4700, 10000]),
    model: { pins: axial, box: [-67, -25, 67, 25], label: -42 },
    schematic: { pins: twoPin, box: [-40, -12, 40, 12] },
  },
  potentiometer: {
    name: 'Potentiometer', description: 'Adjustable divider with a wiper', category: 'Passive', value: 10000, unit: 'Ω', prefix: 'RV',
    pins: ['End A', 'End B', 'Wiper'], defaults: { position: 50 }, field: field('Resistance', 1, 10000000, 1, [1000, 10000, 100000]),
    model: { pins: [[-24, 42], [24, 42], [0, 42]], box: [-40, -48, 40, 50] },
    schematic: { pins: [[-40, 0], [40, 0], [0, -40]], box: [-40, -40, 40, 14] },
  },
  ldr: {
    name: 'Photoresistor', description: 'Resistance falls in bright light', category: 'Passive', value: 50, unit: '%', prefix: 'R',
    pins: ['1', '2'], field: field('Light level', 0, 100, 1, [], { slider: true }),
    model: { pins: [[-19, 34], [19, 34]], box: [-30, -36, 30, 40] },
    schematic: { pins: twoPin, box: [-40, -34, 40, 14] },
  },
  thermistor: {
    name: 'Thermistor', description: '10 kΩ NTC that changes with temperature', category: 'Passive', value: 25, unit: '°C', prefix: 'TH',
    pins: ['1', '2'], field: field('Temperature', -40, 150, 1, [], { slider: true }),
    model: { pins: [[-19, 34], [19, 34]], box: [-26, -36, 26, 40] },
    schematic: { pins: twoPin, box: [-40, -22, 40, 22] },
  },
  capacitor: {
    name: 'Capacitor', description: 'Store a little energy', category: 'Passive', value: 100, unit: 'μF', prefix: 'C',
    pins: ['1', '2'], field: field('Capacitance', 0.001, 100000, 1, [1, 10, 100, 1000]),
    model: { pins: [[-19, 32], [19, 32]], box: legacyBox, label: -70 },
    schematic: { pins: twoPin, box: [-40, -20, 40, 20] },
  },
  inductor: {
    name: 'Inductor', description: 'Coil that stores magnetic energy', category: 'Passive', value: 10, unit: 'mH', prefix: 'L',
    pins: ['1', '2'], field: field('Inductance', 0.001, 10000, 1, [1, 10, 100]),
    model: { pins: axial, box: [-64, -24, 64, 24] },
    schematic: { pins: twoPin, box: [-40, -14, 40, 6] },
  },
  fuse: {
    name: 'Fuse', description: 'Opens when current gets too high', category: 'Passive', value: 0.5, unit: 'A', prefix: 'F',
    pins: ['1', '2'], field: field('Rating', 0.05, 10, 0.05, [0.25, 0.5, 1, 2]),
    model: { pins: axial, box: [-64, -16, 64, 16] },
    schematic: { pins: twoPin, box: [-40, -10, 40, 10] },
  },
  diode: {
    name: 'Diode', description: 'Lets current flow one way', category: 'Semiconductors', value: 0.7, unit: 'V', prefix: 'D',
    pins: ['Anode', 'Cathode'], field: field('Forward voltage', 0.1, 1.5, 0.05, [0.3, 0.7]),
    model: { pins: axial, box: [-64, -14, 64, 14] },
    schematic: { pins: twoPin, box: [-40, -14, 40, 14] },
  },
  zener: {
    name: 'Zener diode', description: 'Holds a steady reverse voltage', category: 'Semiconductors', value: 5.1, unit: 'V', prefix: 'D',
    pins: ['Anode', 'Cathode'], field: field('Zener voltage', 1, 30, 0.1, [3.3, 5.1, 12]),
    model: { pins: axial, box: [-64, -14, 64, 14] },
    schematic: { pins: twoPin, box: [-40, -14, 40, 14] },
  },
  led: {
    name: 'LED', description: 'A little moment of light', category: 'Semiconductors', value: 2, unit: 'V', prefix: 'LED', color: '#e95f49',
    pins: ['Anode', 'Cathode'], field: field('Forward voltage', 1.5, 4, 0.1, [1.8, 2, 3.2]),
    model: { pins: [[-19, 32], [19, 32]], box: legacyBox, label: -67 },
    schematic: { pins: twoPin, box: [-40, -34, 40, 14] },
  },
  npn: {
    name: 'NPN transistor', description: 'A small base current switches a larger one', category: 'Semiconductors', value: 100, unit: '', prefix: 'Q',
    pins: ['Collector', 'Base', 'Emitter'], format: v => `hFE ${v}`, field: field('Gain (hFE)', 10, 1000, 10, [50, 100, 200]),
    model: { pins: [[20, 42], [0, 42], [-20, 42]], box: [-32, -40, 32, 48] },
    schematic: { pins: [[20, -40], [-40, 0], [20, 40]], box: [-40, -40, 32, 40] },
  },
  pnp: {
    name: 'PNP transistor', description: 'Turns on when its base is pulled low', category: 'Semiconductors', value: 100, unit: '', prefix: 'Q',
    pins: ['Collector', 'Base', 'Emitter'], format: v => `hFE ${v}`, field: field('Gain (hFE)', 10, 1000, 10, [50, 100, 200]),
    model: { pins: [[20, 42], [0, 42], [-20, 42]], box: [-32, -40, 32, 48] },
    schematic: { pins: [[20, -40], [-40, 0], [20, 40]], box: [-40, -40, 32, 40] },
  },
  switch: {
    name: 'Slide switch', description: 'Take control of the flow', category: 'Switches', value: 1, unit: '', prefix: 'SW',
    pins: ['1', '2'], field: null,
    model: { pins: [[-38, 0], [38, 0]], box: legacyBox, label: 43 },
    schematic: { pins: twoPin, box: [-40, -22, 40, 8] },
  },
  spdt: {
    name: 'Toggle switch', description: 'SPDT · sends current one of two ways', category: 'Switches', value: 0, unit: '', prefix: 'SW',
    pins: ['Common', 'A', 'B'], field: null,
    model: { pins: [[0, 32], [-30, 32], [30, 32]], box: [-44, -42, 44, 38] },
    schematic: { pins: [[-40, 0], [40, -20], [40, 20]], box: [-40, -26, 40, 26] },
  },
  pushbutton: {
    name: 'Push button', description: 'Connects only while pressed', category: 'Switches', value: 0, unit: '', prefix: 'SW',
    pins: ['1', '2'], field: null,
    model: { pins: [[-36, 0], [36, 0]], box: [-44, -32, 44, 32] },
    schematic: { pins: twoPin, box: [-40, -26, 40, 8] },
  },
  lamp: {
    name: 'Light bulb', description: 'Make something glow', category: 'Output', value: 100, unit: 'Ω', prefix: 'LP',
    pins: ['1', '2'], field: field('Resistance', 1, 100000, 1, [50, 100, 200]),
    model: { pins: [[-24, 40], [24, 40]], box: legacyBox, label: -70 },
    schematic: { pins: twoPin, box: [-40, -20, 40, 20] },
  },
  motor: {
    name: 'DC motor', description: 'Set things in motion', category: 'Output', value: 60, unit: 'Ω', prefix: 'M',
    pins: ['+', '−'], field: field('Resistance', 1, 100000, 1, [20, 60, 100]),
    model: { pins: [[-40, 20], [40, 20]], box: legacyBox, label: -70 },
    schematic: { pins: twoPin, box: [-40, -20, 40, 20] },
  },
  buzzer: {
    name: 'Buzzer', description: 'Bring your circuit to life', category: 'Output', value: 150, unit: 'Ω', prefix: 'BZ',
    pins: ['+', '−'], field: field('Resistance', 1, 100000, 1, [100, 150, 300]),
    model: { pins: [[-24, 28], [24, 28]], box: legacyBox, label: -70 },
    schematic: { pins: twoPin, box: [-40, -26, 40, 10] },
  },
  speaker: {
    name: 'Speaker', description: 'Turns current into sound', category: 'Output', value: 8, unit: 'Ω', prefix: 'LS',
    pins: ['+', '−'], field: field('Impedance', 1, 64, 1, [4, 8, 16]),
    model: { pins: [[-20, 46], [20, 46]], box: [-48, -48, 48, 52] },
    schematic: { pins: twoPin, box: [-40, -28, 40, 28] },
  },
  ammeter: {
    name: 'Ammeter', description: 'Measures current, wired in series', category: 'Measure', value: 0, unit: '', prefix: 'AM',
    pins: ['+', '−'], field: null,
    model: { pins: [[-24, 44], [24, 44]], box: [-50, -44, 50, 50] },
    schematic: { pins: twoPin, box: [-40, -20, 40, 20] },
  },
  voltmeter: {
    name: 'Voltmeter', description: 'Measures voltage, wired in parallel', category: 'Measure', value: 0, unit: '', prefix: 'VM',
    pins: ['+', '−'], field: null,
    model: { pins: [[-24, 44], [24, 44]], box: [-50, -44, 50, 50] },
    schematic: { pins: twoPin, box: [-40, -20, 40, 20] },
  },
  breadboard: {
    name: 'Breadboard', description: 'Solderless board with 30 columns', category: 'Prototyping', value: 30, unit: 'columns', prefix: 'BB',
    pins: [], field: null,
    model: { pins: [], box: [-335, -177, 335, 175], label: 196 },
    schematic: null,
  },
};

const trim = n => String(Number(n.toPrecision(3)));

/** Human-readable value with SI prefixes for resistances, e.g. 4700 → "4.7 kΩ". */
export function formatValue(value, unit) {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'Ω') {
    const [divisor, prefix] = Math.abs(value) >= 1e6 ? [1e6, 'M'] : Math.abs(value) >= 1e3 ? [1e3, 'k'] : [1, ''];
    return `${trim(value / divisor)} ${prefix}Ω`;
  }
  if (unit === '%') return `${trim(value)}%`;
  return unit ? `${trim(value)} ${unit}` : trim(value);
}

/** The value as shown on labels, or '' when a part has no meaningful value. */
export function partValueLabel(c) {
  const part = PARTS[c.type];
  if (c.type === 'switch') return c.value ? 'ON' : 'OFF';
  if (c.type === 'spdt') return c.value ? 'B' : 'A';
  if (c.type === 'pushbutton') return 'NO';
  if (c.type === 'led') return LED_COLORS[c.color] || 'Red';
  if (c.type === 'potentiometer') return `${formatValue(c.value, 'Ω')} · ${Math.round(c.position ?? 50)}%`;
  if (!part.field) return '';
  return part.format ? part.format(c.value) : formatValue(c.value, part.unit);
}

export const LED_COLORS = { '#e95f49': 'Red', '#dbaa36': 'Amber', '#82b94d': 'Green', '#5c94c5': 'Blue', '#b17aca': 'Violet' };

/** Reference designators (R1, D2, …). Explicit `ref`s win; others are numbered per prefix. */
export function referenceDesignators(components) {
  const refs = {}, used = new Set(components.map(c => c.ref).filter(Boolean)), counters = {};
  for (const c of components) {
    if (c.ref) { refs[c.id] = c.ref; continue; }
    const prefix = PARTS[c.type]?.prefix || 'U';
    let ref;
    do ref = `${prefix}${counters[prefix] = (counters[prefix] || 0) + 1}`; while (used.has(ref));
    used.add(ref); refs[c.id] = ref;
  }
  return refs;
}

export const SCHEMATIC_GRID = 20;
const snap = (v, grid) => Math.round(v / grid) * grid;

/** Where a component sits in a view. Without an explicit schematic placement,
 * the diagram follows the workbench position, snapped to the schematic grid. */
export function placement(c, view = 'model') {
  if (view !== 'schematic') return { x: c.x, y: c.y, rotation: c.rotation || 0 };
  if (c.schematic) return { x: c.schematic.x, y: c.schematic.y, rotation: c.schematic.rotation || 0 };
  return { x: snap(c.x, SCHEMATIC_GRID), y: snap(c.y, SCHEMATIC_GRID), rotation: c.rotation || 0 };
}

function rotate([x, y], degrees) {
  const angle = degrees * Math.PI / 180, cos = Math.round(Math.cos(angle) * 1e9) / 1e9, sin = Math.round(Math.sin(angle) * 1e9) / 1e9;
  return [x * cos - y * sin, x * sin + y * cos];
}

/** Absolute position of a pin in the given view. */
export function pinPosition(c, pin, view = 'model') {
  const geometry = PARTS[c.type]?.[view === 'schematic' ? 'schematic' : 'model'];
  const offset = geometry?.pins[Number(pin)] || [0, 0];
  const at = placement(c, view), [x, y] = rotate(offset, at.rotation);
  return { x: at.x + x, y: at.y + y };
}

/** Outward direction of a schematic pin lead after rotation: 'left' | 'right' | 'up' | 'down'. */
export function pinDirection(c, pin, view = 'schematic') {
  const geometry = PARTS[c.type]?.[view === 'schematic' ? 'schematic' : 'model'];
  const [x, y] = rotate(geometry?.pins[Number(pin)] || [1, 0], placement(c, view).rotation);
  return Math.abs(x) >= Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
}

/** Axis-aligned bounding box of a placed part in the given view: { x, y, w, h }. */
export function partBox(c, view = 'model') {
  const geometry = PARTS[c.type]?.[view === 'schematic' ? 'schematic' : 'model'];
  const [x1, y1, x2, y2] = geometry?.box || [-40, -40, 40, 40];
  const at = placement(c, view);
  const corners = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(p => rotate(p, at.rotation));
  const xs = corners.map(p => p[0] + at.x), ys = corners.map(p => p[1] + at.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** A new component of the given type with registry defaults. */
export function createComponent(type, id, x, y) {
  const part = PARTS[type];
  return { id, type, x, y, rotation: 0, value: part.value, ...(part.color ? { color: part.color } : {}), ...(part.defaults || {}) };
}
