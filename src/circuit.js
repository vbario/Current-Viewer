export const PARTS = {
  breadboard: { name: 'Breadboard', description: 'Your circuit’s home base', category: 'Basics', value: 30, unit: 'columns' },
  battery: { name: 'Battery', description: 'Give your ideas power', category: 'Power', value: 9, unit: 'V' },
  resistor: { name: 'Resistor', description: 'Keep current in check', category: 'Basics', value: 330, unit: 'Ω' },
  led: { name: 'LED', description: 'A little moment of light', category: 'Output', value: 2, unit: 'V', color: '#e95f49' },
  switch: { name: 'Slide switch', description: 'Take control of the flow', category: 'Basics', value: 1, unit: '' },
  capacitor: { name: 'Capacitor', description: 'Store a little energy', category: 'Basics', value: 100, unit: 'μF' },
  lamp: { name: 'Light bulb', description: 'Make something glow', category: 'Output', value: 100, unit: 'Ω' },
  motor: { name: 'DC motor', description: 'Set things in motion', category: 'Output', value: 60, unit: 'Ω' },
  buzzer: { name: 'Buzzer', description: 'Bring your circuit to life', category: 'Output', value: 150, unit: 'Ω' },
};

export const initialProject = () => ({
  name: 'My first circuit',
  components: [
    { id: 'board1', type: 'breadboard', x: 572, y: 335, rotation: 0, value: 30 },
    { id: 'bat1', type: 'battery', x: 155, y: 390, rotation: 0, value: 9 },
    { id: 'r1', type: 'resistor', x: 507, y: 274, rotation: 0, value: 330 },
    { id: 'led1', type: 'led', x: 678, y: 278, rotation: 0, value: 2, color: '#e95f49' },
    { id: 'sw1', type: 'switch', x: 507, y: 406, rotation: 0, value: 1 },
  ],
  wires: [
    { id: 'w1', from: 'bat1:0', to: 'sw1:0', color: '#dc6a52', via: [{ x: 118, y: 183 }, { x: 294, y: 183 }, { x: 294, y: 406 }] },
    { id: 'w2', from: 'sw1:1', to: 'r1:0', color: '#d5a143', via: [{ x: 564, y: 406 }, { x: 564, y: 333 }, { x: 450, y: 333 }, { x: 450, y: 274 }] },
    { id: 'w3', from: 'r1:1', to: 'led1:0', color: '#78977b', via: [{ x: 602, y: 274 }, { x: 602, y: 310 }] },
    { id: 'w4', from: 'led1:1', to: 'bat1:1', color: '#687b8d', via: [{ x: 811, y: 310 }, { x: 811, y: 487 }, { x: 193, y: 487 }] },
  ],
});

export function terminalPosition(component, pin) {
  const offsets = { battery: [[-37, -72], [38, -72]], resistor: [[-57, 0], [57, 0]], led: [[-19, 32], [19, 32]], switch: [[-38, 0], [38, 0]], capacitor: [[-19, 32], [19, 32]], lamp: [[-24, 40], [24, 40]], motor: [[-40, 20], [40, 20]], buzzer: [[-24, 28], [24, 28]] };
  const [x, y] = offsets[component.type]?.[pin] || [0, 0];
  const angle = (component.rotation || 0) * Math.PI / 180;
  return { x: component.x + x * Math.cos(angle) - y * Math.sin(angle), y: component.y + x * Math.sin(angle) + y * Math.cos(angle) };
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

function canonical(endpoint) {
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

/** Steady-state DC modified nodal analysis. Sources include 1 Ω internal
 * resistance; LEDs use a piecewise linear forward-voltage model. */
export function simulate(components, wires) {
  const parts = components.filter(c => c.type !== 'breadboard');
  const parent = {};
  function root(k) { k = canonical(k); if (!parent[k]) parent[k] = k; if (parent[k] !== k) parent[k] = root(parent[k]); return parent[k]; }
  for (const c of parts) { root(`${c.id}:0`); root(`${c.id}:1`); }
  for (const w of wires) parent[root(w.to)] = root(w.from);
  const sources = parts.filter(c => c.type === 'battery');
  const empty = { readings: {}, wireCurrents: {}, wireVoltages: {}, voltageReference: null, current: 0, voltage: 0, power: 0, warnings: [], closed: false };
  if (!sources.length) return { ...empty, warnings: ['Add a battery to power your circuit.'] };
  const ground = root(`${sources[0].id}:1`);
  const nodes = [...new Set(Object.keys(parent).map(root))].filter(n => n !== ground);
  const nodeMap = new Map(nodes.map((n, i) => [n, i]));
  const index = ep => nodeMap.get(root(ep));
  const diodeState = Object.fromEntries(parts.filter(c => c.type === 'led').map(c => [c.id, false]));
  let solution, models;
  for (let iteration = 0; iteration < 40; iteration++) {
    const size = nodes.length + sources.length;
    const a = Array.from({ length: size }, () => Array(size).fill(0));
    const b = Array(size).fill(0);
    for (let i = 0; i < nodes.length; i++) a[i][i] = 1e-10;
    models = {};
    for (const c of parts) {
      const i = index(`${c.id}:0`), j = index(`${c.id}:1`);
      if (c.type === 'battery') {
        const s = nodes.length + sources.indexOf(c);
        if (i !== undefined) { a[i][s] += 1; a[s][i] += 1; }
        if (j !== undefined) { a[j][s] -= 1; a[s][j] -= 1; }
        a[s][s] = -1; b[s] = c.value;
        continue;
      }
      let resistance = Math.max(c.value, 0.01), drop = 0;
      if (c.type === 'switch') resistance = c.value ? 0.1 : 1e12;
      if (c.type === 'capacitor') resistance = 1e12;
      if (c.type === 'led') { resistance = diodeState[c.id] ? 10 : 1e12; drop = diodeState[c.id] ? c.value : 0; }
      const g = 1 / resistance;
      models[c.id] = { resistance, drop };
      if (i !== undefined) { a[i][i] += g; b[i] += drop * g; }
      if (j !== undefined) { a[j][j] += g; b[j] -= drop * g; }
      if (i !== undefined && j !== undefined) { a[i][j] -= g; a[j][i] -= g; }
    }
    solution = gaussian(a, b);
    if (!solution) return { ...empty, warnings: ['This circuit could not be solved. Check the power connections.'] };
    let changed = false;
    for (const c of parts.filter(c => c.type === 'led')) {
      const voltage = (solution[index(`${c.id}:0`)] || 0) - (solution[index(`${c.id}:1`)] || 0);
      const on = voltage > c.value + 1e-8;
      if (on !== diodeState[c.id]) { diodeState[c.id] = on; changed = true; }
    }
    if (!changed) break;
  }
  const readings = {}, warnings = [];
  for (const c of parts) {
    const voltage = (solution[index(`${c.id}:0`)] || 0) - (solution[index(`${c.id}:1`)] || 0);
    const current = c.type === 'battery' ? -solution[nodes.length + sources.indexOf(c)] : (voltage - models[c.id].drop) / models[c.id].resistance;
    const power = Math.abs(voltage * current);
    const temperature = 22 + power * (c.type === 'resistor' ? 100 : 30);
    readings[c.id] = { voltage, current, power, temperature, active: Math.abs(current) > 0.00001 };
    if (c.type === 'led' && current > 0.03) warnings.push(`${c.label || 'LED'} is over its 30 mA limit. Increase resistance.`);
    if (c.type === 'resistor' && power > 0.25) warnings.push(`${c.label || 'Resistor'} exceeds its ¼ W rating and is overheating.`);
    if (c.type === 'battery' && current > 1) warnings.push('High source current. Check for a short circuit.');
    if (c.type === 'led' && voltage < -5) warnings.push('LED reverse voltage is too high. Reverse its connections.');
  }
  // Resolve currents through ideal wires with an incidence matrix. The
  // minimum-norm solution divides current evenly between redundant wires.
  const wireCurrents = {};
  const wireNodes = [...new Set(wires.flatMap(w => [canonical(w.from), canonical(w.to)]))];
  const wi = new Map(wireNodes.map((n, i) => [n, i]));
  if (wireNodes.length) {
    const n = wireNodes.length, matrix = Array.from({ length: n }, () => Array(n).fill(0)), demand = Array(n).fill(0);
    for (let i = 0; i < n; i++) matrix[i][i] = 1e-9;
    for (const c of parts) {
      const current = readings[c.id].current * (c.type === 'battery' ? -1 : 1);
      const i = wi.get(canonical(`${c.id}:0`)), j = wi.get(canonical(`${c.id}:1`));
      if (i !== undefined) demand[i] -= current;
      if (j !== undefined) demand[j] += current;
    }
    for (const w of wires) {
      const i = wi.get(canonical(w.from)), j = wi.get(canonical(w.to));
      matrix[i][i]++; matrix[j][j]++; matrix[i][j]--; matrix[j][i]--;
    }
    const potentials = gaussian(matrix, demand);
    for (const w of wires) wireCurrents[w.id] = potentials ? potentials[wi.get(canonical(w.from))] - potentials[wi.get(canonical(w.to))] : 0;
  }
  const current = sources.reduce((s, c) => s + Math.max(0, readings[c.id].current), 0);
  const power = parts.filter(c => c.type !== 'battery').reduce((s, c) => s + readings[c.id].power, 0);
  // Ideal wires share one node potential. Report that potential relative to the
  // first battery's negative terminal, rather than the zero drop along a wire.
  const wireVoltages = Object.fromEntries(wires.map(w => {
    const i = index(w.from);
    return [w.id, i === undefined ? 0 : solution[i]];
  }));
  return { readings, wireCurrents, wireVoltages, voltageReference: `${sources[0].id}:1`, current, voltage: sources[0].value, power, warnings, closed: current > 0.00001 };
}
