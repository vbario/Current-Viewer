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

const part = (id, type, value, extra = {}) => ({ id, type, value, ...extra });

test('a diode conducts forward with its drop and blocks in reverse', () => {
  const parts = [battery, part('d', 'diode', 0.7), resistor('r', 100)];
  const on = simulate(parts, [wire('b:0', 'd:0'), wire('d:1', 'r:0'), wire('r:1', 'b:1')]);
  near(on.current, (9 - 0.7) / 101.5);
  near(on.readings.d.voltage, 0.7 + on.current * 0.5);
  const off = simulate(parts, [wire('b:0', 'd:1'), wire('d:0', 'r:0'), wire('r:1', 'b:1')]);
  assert.equal(off.closed, false);
});

test('a reverse-biased zener regulates its breakdown voltage', () => {
  const parts = [battery, resistor('r', 1000), part('z', 'zener', 5.1)];
  const r = simulate(parts, [wire('b:0', 'r:0'), wire('r:1', 'z:1'), wire('z:0', 'b:1')]);
  const vz = -r.readings.z.voltage;
  assert.ok(vz > 5.1 && vz < 5.12, `zener voltage ${vz}`);
  near(r.current, (9 - vz) / 1001, 1e-6);
});

test('an NPN transistor switches an LED from a small base current', () => {
  const parts = [battery, resistor('rb', 10000), resistor('rc', 330), part('led', 'led', 2), part('q', 'npn', 100), part('s', 'switch', 1)];
  const wires = [wire('b:0', 's:0'), wire('s:1', 'rb:0'), wire('rb:1', 'q:1'), wire('b:0', 'rc:0'), wire('rc:1', 'led:0'), wire('led:1', 'q:0'), wire('q:2', 'b:1')];
  const on = simulate(parts, wires);
  assert.equal(on.readings.q.state, 'saturation');
  near(on.readings.q.baseCurrent, (9 - 0.7) / 10001, 1e-5);
  assert.ok(on.readings.led.active);
  assert.ok(on.readings.led.current > 0.015 && on.readings.led.current < 0.025);
  for (const id of ['q', 'led', 'rb']) near(pinCurrentSum(on, id), 0, 1e-9);
  parts[5] = part('s', 'switch', 0);
  const off = simulate(parts, wires);
  assert.equal(off.readings.q.state, 'cutoff');
  assert.equal(off.readings.led.active, false);
});

test('an NPN in the active region multiplies base current by its gain', () => {
  const parts = [battery, resistor('rb', 1e6), resistor('rc', 100), part('q', 'npn', 150)];
  const r = simulate(parts, [wire('b:0', 'rb:0'), wire('rb:1', 'q:1'), wire('b:0', 'rc:0'), wire('rc:1', 'q:0'), wire('q:2', 'b:1')]);
  assert.equal(r.readings.q.state, 'active');
  near(r.readings.q.current, 150 * r.readings.q.baseCurrent, 1e-9);
});

test('a PNP transistor conducts when its base is pulled low', () => {
  const parts = [battery, resistor('rb', 10000), resistor('rc', 330), part('q', 'pnp', 100)];
  const r = simulate(parts, [wire('b:0', 'q:2'), wire('q:1', 'rb:0'), wire('rb:1', 'b:1'), wire('q:0', 'rc:0'), wire('rc:1', 'b:1')]);
  assert.equal(r.readings.q.state, 'saturation');
  assert.ok(r.readings.rc.current > 0.02);
  near(pinCurrentSum(r, 'q'), 0, 1e-9);
});

test('a potentiometer divides voltage at its wiper', () => {
  const parts = [battery, part('p', 'potentiometer', 10000, { position: 25 }), part('vm', 'voltmeter', 0)];
  const r = simulate(parts, [wire('b:0', 'p:0'), wire('p:1', 'b:1'), wire('p:2', 'vm:0'), wire('vm:1', 'b:1')]);
  const supply = 9 - r.current;
  near(r.readings.vm.voltage, supply * 0.75, 5e-3);
});

test('a toggle switch routes current to the selected throw', () => {
  const parts = [battery, part('t', 'spdt', 0), resistor('ra', 100), resistor('rb', 200)];
  const wires = [wire('b:0', 't:0'), wire('t:1', 'ra:0'), wire('t:2', 'rb:0'), wire('ra:1', 'b:1'), wire('rb:1', 'b:1')];
  assert.ok(simulate(parts, wires).readings.ra.active);
  assert.equal(simulate(parts, wires).readings.rb.active, false);
  parts[1] = part('t', 'spdt', 1);
  assert.equal(simulate(parts, wires).readings.ra.active, false);
  assert.ok(simulate(parts, wires).readings.rb.active);
});

test('a fuse blows when its rating is exceeded and stays intact otherwise', () => {
  const parts = [battery, part('f', 'fuse', 0.5), resistor('r', 10)];
  const wires = [wire('b:0', 'f:0'), wire('f:1', 'r:0'), wire('r:1', 'b:1')];
  const blown = simulate(parts, wires);
  assert.equal(blown.closed, false);
  assert.ok(blown.warnings.some(w => w.includes('blew')));
  parts[2] = resistor('r', 100);
  assert.ok(simulate(parts, wires).closed);
});

test('ground parts share one reference node and report their return currents', () => {
  const parts = [battery, resistor('r', 100), part('g1', 'ground', 0), part('g2', 'ground', 0)];
  const r = simulate(parts, [wire('b:0', 'r:0'), wire('r:1', 'g1:0'), wire('b:1', 'g2:0')]);
  assert.equal(r.voltageReference, 'g1:0');
  near(r.current, 9 / 101);
  near(r.pinVoltages['b:1'], 0);
  near(r.pinVoltages['b:0'], 9 - r.current);
  near(r.pinCurrents['g1:0'], r.current);
  near(r.pinCurrents['g2:0'], -r.current);
});

test('meters read current in series and voltage in parallel', () => {
  const parts = [battery, part('am', 'ammeter', 0), resistor('r', 100), part('vm', 'voltmeter', 0)];
  const r = simulate(parts, [wire('b:0', 'am:0'), wire('am:1', 'r:0'), wire('r:1', 'b:1'), wire('vm:0', 'r:0'), wire('vm:1', 'r:1')]);
  near(r.readings.am.current, 9 / 101.01, 1e-5);
  near(r.readings.vm.voltage, r.readings.am.current * 100, 1e-4);
});

test('light and temperature change sensor resistance', () => {
  const at = (type, value) => simulate([battery, part('s', type, value)], [wire('b:0', 's:0'), wire('s:1', 'b:1')]).current;
  assert.ok(at('ldr', 100) > at('ldr', 0) * 100);
  near(9 / at('thermistor', 25) - 1, 10000, 0.1);
  assert.ok(at('thermistor', 80) > at('thermistor', 25) * 5);
});

test('pin currents satisfy KCL at every wire network node', () => {
  const p = initialProject(), r = simulate(p.components, p.wires);
  near(r.pinCurrents['bat1:0'], -r.current);
  near(r.pinCurrents['r1:0'], r.current);
  near(r.pinCurrents['led1:1'], -r.current);
});

function pinCurrentSum(result, id) {
  return Object.entries(result.pinCurrents).filter(([pin]) => pin.startsWith(`${id}:`)).reduce((sum, [, current]) => sum + current, 0);
}
