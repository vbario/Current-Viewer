import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, initialProject } from './circuit.js';

const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `Expected ${actual} to be near ${expected}`);
const battery = { id: 'b', type: 'battery', value: 9 };
const resistor = (id, value) => ({ id, type: 'resistor', value });
const wire = (from, to) => ({ id: `${from}-${to}`, from, to });

test('starter LED circuit obeys Ohm’s law including LED drop and source resistance', () => {
  const p = initialProject(), r = simulate(p.components, p.wires);
  near(r.current, 7 / 341.1);
  assert.equal(r.closed, true);
  near(r.readings.r1.power, (7 / 341.1) ** 2 * 330);
  for (const current of Object.values(r.wireCurrents)) near(current, r.current);
  assert.equal(r.voltageReference, 'bat1:1');
  near(r.wireVoltages.w1, 9 - r.current);
  near(r.wireVoltages.w2, r.wireVoltages.w1 - r.readings.sw1.voltage);
  near(r.wireVoltages.w3, r.readings.led1.voltage);
  near(r.wireVoltages.w4, 0);
  assert.equal(r.warnings.length, 0);
});

test('an open switch stops current and component effects', () => {
  const p = initialProject(); p.components.find(c => c.type === 'switch').value = 0;
  const r = simulate(p.components, p.wires);
  assert.equal(r.closed, false);
  assert.equal(r.readings.led1.active, false);
  near(r.current, 0);
  near(r.wireVoltages.w1, 9);
  near(r.wireVoltages.w4, 0);
});

test('a disconnected wire stops current', () => {
  const p = initialProject(); p.wires.pop();
  const r = simulate(p.components, p.wires);
  assert.equal(r.closed, false); near(r.current, 0);
});

test('parallel branches split current according to resistance', () => {
  const parts = [battery, resistor('r1', 100), resistor('r2', 200)];
  const wires = [wire('b:0', 'r1:0'), wire('b:0', 'r2:0'), wire('r1:1', 'b:1'), wire('r2:1', 'b:1')];
  const r = simulate(parts, wires);
  near(r.current, 9 / (1 + 200 / 3));
  near(r.readings.r1.current, r.readings.r2.current * 2);
  near(r.wireCurrents['b:0-r1:0'], r.readings.r1.current);
  near(r.wireCurrents['b:0-r2:0'], r.readings.r2.current);
  near(r.wireVoltages['b:0-r1:0'], r.wireVoltages['b:0-r2:0']);
  near(r.wireVoltages['b:0-r1:0'], 9 - r.current);
  near(r.wireVoltages['r1:1-b:1'], 0);
});

test('breadboard connects a–e by column and separates the center channel', () => {
  const parts = [battery, resistor('r', 100), { id: 'bb', type: 'breadboard', value: 30 }];
  const wires = [wire('b:0', 'bb:a:5'), wire('bb:e:5', 'r:0'), wire('r:1', 'b:1')];
  near(simulate(parts, wires).current, 9 / 101);
  wires[1] = wire('bb:f:5', 'r:0');
  assert.equal(simulate(parts, wires).closed, false);
  wires[1] = wire('bb:e:6', 'r:0');
  assert.equal(simulate(parts, wires).closed, false);
});

test('breadboard power rails connect across columns but remain separate', () => {
  const parts = [battery, resistor('r', 100), { id: 'bb', type: 'breadboard', value: 30 }];
  const wires = [wire('b:0', 'bb:topPlus:0'), wire('bb:topPlus:29', 'r:0'), wire('r:1', 'b:1')];
  near(simulate(parts, wires).current, 9 / 101);
  wires[1] = wire('bb:topMinus:29', 'r:0');
  assert.equal(simulate(parts, wires).closed, false);
});

test('a reverse-connected LED blocks current', () => {
  const p = initialProject();
  p.wires = p.wires.map(w => ({ ...w, from: w.from.replace('led1:1', 'led1:0'), to: w.to.replace('led1:0', 'led1:1') }));
  const r = simulate(p.components, p.wires);
  assert.equal(r.closed, false); assert.equal(r.readings.led1.active, false);
});

test('low resistance triggers LED and resistor overload warnings', () => {
  const p = initialProject(); p.components.find(c => c.type === 'resistor').value = 100;
  const r = simulate(p.components, p.wires);
  assert.ok(r.warnings.some(w => w.includes('30 mA')));
  assert.ok(r.warnings.some(w => w.includes('¼ W')));
});

test('shorted source reports a warning without a numerical failure', () => {
  const r = simulate([battery], [wire('b:0', 'b:1')]);
  near(r.current, 9);
  assert.ok(r.warnings.some(w => w.includes('short circuit')));
});

test('a capacitor blocks steady-state DC and a floating part stays inactive', () => {
  const r = simulate([battery, { id: 'c', type: 'capacitor', value: 100 }, resistor('floating', 100)], [wire('b:0', 'c:0'), wire('c:1', 'b:1')]);
  assert.equal(r.closed, false); assert.equal(r.readings.floating.active, false);
});

test('a circuit without a battery gives a useful diagnostic', () => {
  const r = simulate([resistor('r', 100)], []);
  assert.equal(r.current, 0); assert.ok(r.warnings[0].includes('battery'));
  assert.equal(r.voltageReference, null);
  assert.deepEqual(r.wireVoltages, {});
});

test('wire voltages retain their sign on the negative side of a source', () => {
  const parts = [battery, { id: 'b2', type: 'battery', value: 3 }, resistor('r', 100)];
  const wires = [wire('b:1', 'b2:0'), wire('b2:1', 'r:0'), wire('r:1', 'b:1')];
  const r = simulate(parts, wires);
  near(r.wireVoltages['b2:1-r:0'], -3 * 100 / 101);
  near(r.wireCurrents['b2:1-r:0'], -3 / 101);
});
