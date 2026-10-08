import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PARTS, SCHEMATIC_GRID, partBox } from '../parts.js';
import { validProject } from '../project.js';
import { initialProject } from '../circuit.js';
import { importDiagram, detectFormat, decodeText, ImportError, ACCEPTED_EXTENSIONS } from './index.js';
import { parseValue, inferType, zenerVoltage, buildProject, autoLayout, mapPins, sourceVoltage, railVoltage, evaluateExpression, substituteParams, collectParams } from './build.js';
import { kicadPinPosition } from './kicad.js';
import { ltspicePinPosition } from './ltspice.js';
import { eaglePinPosition } from './eagle.js';

const FIXTURES = fileURLToPath(new URL('../../tests/fixtures/diagrams/', import.meta.url));
const fixture = name => fs.readFileSync(FIXTURES + name);
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `Expected ${actual} to be near ${expected}`);

/** Nets as sorted strings of 'REF.pinIndex' (ground parts become 'GND' and are joined). */
function netlist(project) {
  const parent = new Map();
  const find = k => { if (!parent.has(k)) parent.set(k, k); while (parent.get(k) !== k) k = parent.get(k); return k; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  for (const w of project.wires) union(w.from, w.to);
  const grounds = project.components.filter(c => c.type === 'ground');
  for (const g of grounds) union(`${grounds[0].id}:0`, `${g.id}:0`);
  const groups = new Map();
  for (const c of project.components) {
    PARTS[c.type].pins.forEach((_, i) => {
      const root = find(`${c.id}:${i}`);
      if (!groups.has(root)) groups.set(root, new Set());
      groups.get(root).add(c.type === 'ground' ? 'GND' : `${c.ref}.${i}`);
    });
  }
  return [...groups.values()].filter(s => s.size > 1).map(s => [...s].sort().join(' ')).sort();
}
const nets = list => list.map(n => n.split(' ').sort().join(' ')).sort();

function assertLayout(project) {
  assert.ok(validProject(project), 'project is valid');
  for (const c of project.components) {
    assert.equal(c.schematic.x % SCHEMATIC_GRID, 0, `${c.ref} schematic x on grid`);
    assert.equal(c.schematic.y % SCHEMATIC_GRID, 0, `${c.ref} schematic y on grid`);
    assert.ok([0, 90, 180, 270].includes(c.schematic.rotation), `${c.ref} rotation`);
    assert.ok(!c.id.includes(':'), 'ids have no colons');
  }
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const view of ['schematic', 'model']) {
    const cs = project.components, boxes = cs.map(c => partBox(c, view));
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      assert.ok(!overlap(boxes[i], boxes[j]), `${view}: ${cs[i].ref} overlaps ${cs[j].ref}`);
    }
  }
}
const byRef = (project, ref) => project.components.find(c => c.ref === ref);

// ---------------------------------------------------------------------------
// Fixtures

test('KiCad schematic: LED circuit with rotated/mirrored parts, a T junction and GND symbol', () => {
  const r = importDiagram('led-circuit.kicad_sch', fixture('led-circuit.kicad_sch'));
  assert.equal(detectFormat('led-circuit.kicad_sch', decodeText(fixture('led-circuit.kicad_sch'))), 'kicad-sch');
  assert.equal(r.format, 'KiCad schematic');
  assert.equal(r.project.name, 'LED circuit');
  assertLayout(r.project);
  const p = r.project;
  assert.deepEqual(p.components.map(c => `${c.ref}:${c.type}`).sort(), ['BT1:battery', 'D1:led', 'GND1:ground', 'R1:resistor', 'SW1:switch']);
  assert.equal(byRef(p, 'BT1').value, 9);
  assert.equal(byRef(p, 'R1').value, 330);
  assert.equal(byRef(p, 'D1').value, 2);
  assert.equal(byRef(p, 'D1').color, '#e95f49');
  assert.equal(byRef(p, 'SW1').value, 1);
  assert.equal(byRef(p, 'R1').id, 'r1');
  // SW1 is mirrored, so its pin 1 (index 0) faces R1 and pin 2 the battery.
  assert.deepEqual(netlist(p), nets(['BT1.0 SW1.1', 'R1.0 SW1.0', 'D1.0 R1.1', 'BT1.1 D1.1 GND']));
  // The LED was drawn vertically (rotated 90°) with its anode on top.
  assert.equal(byRef(p, 'D1').schematic.rotation, 90);
  assert.deepEqual(r.summary, { parts: 5, nets: 4, wires: 5 });
  assert.deepEqual(r.skipped, []);
  assert.deepEqual(r.warnings, []);
  const power = p.wires.find(w => [w.from, w.to].includes('bt1:0'));
  assert.equal(power.color, '#dc6a52');
  const groundWire = p.wires.find(w => [w.from, w.to].includes('gnd1:0'));
  assert.equal(groundWire.color, '#424b43');
});

test('LTspice schematic: voltage source, rotated resistor, LED and two ground flags', () => {
  const r = importDiagram('led-circuit.asc', fixture('led-circuit.asc'));
  assert.equal(r.format, 'LTspice schematic');
  assertLayout(r.project);
  const p = r.project;
  assert.deepEqual(p.components.map(c => `${c.ref}:${c.type}`).sort(), ['D1:led', 'GND1:ground', 'GND2:ground', 'R1:resistor', 'V1:supply']);
  assert.equal(byRef(p, 'V1').value, 9);
  assert.equal(byRef(p, 'R1').value, 330);
  // R90 puts the resistor's pin 1 on the right, towards the LED.
  assert.deepEqual(netlist(p), nets(['R1.1 V1.0', 'D1.0 R1.0', 'D1.1 GND V1.1']));
  assert.ok([0, 180].includes(byRef(p, 'R1').schematic.rotation), 'rotated resistor is horizontal');
  assert.equal(p.name, 'led-circuit');
});

test('LTspice files saved as UTF-16LE (with or without BOM) import the same', () => {
  const text = decodeText(fixture('led-circuit.asc'));
  const utf16 = bom => {
    const bytes = new Uint8Array((bom ? 2 : 0) + text.length * 2);
    if (bom) { bytes[0] = 0xff; bytes[1] = 0xfe; }
    for (let i = 0; i < text.length; i++) { bytes[(bom ? 2 : 0) + 2 * i] = text.charCodeAt(i) & 0xff; bytes[(bom ? 2 : 0) + 2 * i + 1] = text.charCodeAt(i) >> 8; }
    return bytes;
  };
  const plain = importDiagram('led-circuit.asc', text);
  for (const bom of [true, false]) {
    const r = importDiagram('led-circuit.asc', utf16(bom).buffer);
    assert.deepEqual(r.project, plain.project);
  }
});

test('SPICE netlist: transistor switch with .model lines, continuations and comments', () => {
  const r = importDiagram('transistor-switch.cir', fixture('transistor-switch.cir'));
  assert.equal(detectFormat('transistor-switch.cir', decodeText(fixture('transistor-switch.cir'))), 'spice');
  assert.equal(r.format, 'SPICE netlist');
  assertLayout(r.project);
  const p = r.project;
  assert.equal(p.name, 'Transistor LED switch');
  assert.deepEqual(p.components.map(c => `${c.ref}:${c.type}`).sort(), ['D1:led', 'GND1:ground', 'Q1:npn', 'RB:resistor', 'RC:resistor', 'V1:supply']);
  assert.equal(byRef(p, 'V1').value, 9);
  assert.equal(byRef(p, 'RB').value, 10000);
  assert.equal(byRef(p, 'RC').value, 330);
  assert.equal(byRef(p, 'Q1').value, 200, 'hFE from the .model BF');
  assert.equal(byRef(p, 'D1').color, '#e95f49');
  assert.deepEqual(netlist(p), nets([
    'RB.0 RC.0 V1.0', // vcc
    'Q1.1 RB.1', // base
    'D1.1 Q1.0', // collector ↔ LED cathode
    'D1.0 RC.1', // LED anode
    'GND Q1.2 V1.1', // node 0
  ]));
  // Auto-layout: the source sits left of everything and is drawn vertically.
  const v1 = byRef(p, 'V1');
  for (const c of p.components) if (c.type !== 'ground' && c !== v1) assert.ok(c.schematic.x > v1.schematic.x, `${c.ref} is right of the source`);
  assert.equal(v1.schematic.rotation, 0);
  assert.equal(p.components.filter(c => c.type === 'ground').length, 1, 'one ground per SPICE import');
});

test('KiCad netlist export: components and nets with auto-layout', () => {
  const r = importDiagram('led-circuit.net', fixture('led-circuit.net'));
  assert.equal(detectFormat('led-circuit.net', decodeText(fixture('led-circuit.net'))), 'kicad-netlist');
  assert.equal(r.format, 'KiCad netlist');
  assertLayout(r.project);
  const p = r.project;
  assert.equal(p.name, 'led-circuit');
  assert.deepEqual(p.components.map(c => `${c.ref}:${c.type}`).sort(), ['BT1:battery', 'D1:led', 'GND1:ground', 'R1:resistor', 'SW1:switch']);
  assert.equal(byRef(p, 'BT1').value, 9);
  assert.equal(byRef(p, 'R1').value, 330);
  // Device:LED pin 1 is K and pin 2 is A; the registry wants anode first.
  assert.deepEqual(netlist(p), nets(['BT1.0 SW1.1', 'R1.0 SW1.0', 'D1.0 R1.1', 'BT1.1 D1.1 GND']));
});

test('Eagle schematic: rcl/led/supply1 parts, a rotated resistor and a +5V rail without a battery', () => {
  const r = importDiagram('led-circuit.sch', fixture('led-circuit.sch'));
  assert.equal(detectFormat('led-circuit.sch', decodeText(fixture('led-circuit.sch'))), 'eagle-sch');
  assert.equal(r.format, 'Eagle schematic');
  assertLayout(r.project);
  const p = r.project;
  assert.deepEqual(p.components.map(c => `${c.ref}:${c.type}`).sort(), ['GND1:ground', 'GND2:ground', 'LED1:led', 'R1:resistor', 'V1:supply']);
  assert.equal(byRef(p, 'R1').value, 330);
  assert.equal(byRef(p, 'LED1').color, '#e95f49');
  assert.equal(byRef(p, 'V1').value, 5, 'a 5 V supply drives the +5V rail');
  assert.ok(r.warnings.some(w => /No battery or power supply/.test(w) && /\+5V/.test(w)));
  assert.deepEqual(netlist(p), nets(['R1.1 V1.0', 'LED1.0 R1.0', 'GND LED1.1 V1.1']));
  // R1 was placed with rot="R90": vertical in the import too.
  assert.ok([90, 270].includes(byRef(p, 'R1').schematic.rotation));
  assert.deepEqual(r.skipped, [], 'the frame has no pins and is ignored silently');
});

test('importing an exported Current project round-trips', () => {
  const imported = importDiagram('led-circuit.kicad_sch', fixture('led-circuit.kicad_sch')).project;
  for (const project of [imported, initialProject()]) {
    const r = importDiagram('my-circuit.json', JSON.stringify(project, null, 2));
    assert.equal(r.format, 'Current project');
    assert.deepEqual(r.project, project);
    assert.deepEqual(r.skipped, []);
  }
  assert.throws(() => importDiagram('broken.json', JSON.stringify({ name: 'x', components: [{ id: 'a:b', type: 'resistor' }], wires: [] })), ImportError);
});

// ---------------------------------------------------------------------------
// Values, decoding and detection

test('parseValue handles engineering notation, embedded units and SPICE suffixes', () => {
  const cases = [
    ['4k7', 4700], ['4K7', 4700], ['2R2', 2.2], ['R47', 0.47], ['0R', 0], ['330R', 330], ['5V1', 5.1], ['3V3', 3.3],
    ['10uF', 10e-6], ['10µ', 10e-6], ['10μF', 10e-6], ['100n', 100e-9], ['4n7', 4.7e-9], ['22p', 22e-12], ['22pF', 22e-12],
    ['330Ω', 330], ['330ohm', 330], ['330 Ω', 330], ['10 k', 10000], ['4.7 kOhm', 4700], ['1Meg', 1e6], ['1MEG', 1e6],
    ['1e3', 1000], ['-5', -5], ['470uF/16V', 470e-6], ['100n X7R', 100e-9], ['10k LIN', 10000], ['500mA', 0.5], ['12VDC', 12], ['1u0', 1e-6],
  ];
  for (const [text, expected] of cases) near(parseValue(text), expected);
  // 'M' is mega on resistors (practical), milli under SPICE rules otherwise.
  near(parseValue('1M', { type: 'resistor' }), 1e6);
  near(parseValue('1M', { type: 'resistor', spice: true }), 1e6);
  near(parseValue('1M', { type: 'capacitor', spice: true }), 1e-3);
  near(parseValue('1m'), 1e-3);
  near(parseValue('1F', { spice: true }), 1e-15);
  near(parseValue('1F'), 1);
  for (const text of ['1N4148', 'BC547', '2N2222', 'LED', '{res}', '', 'GAIN']) assert.ok(Number.isNaN(parseValue(text)), `${text} is not a value`);
});

test('zener voltages, source levels and rail names', () => {
  assert.equal(zenerVoltage('BZX79C5V1'), 5.1);
  assert.equal(zenerVoltage('1N4733A'), 5.1);
  assert.equal(zenerVoltage('1N5231B'), 5.1);
  assert.equal(zenerVoltage('BZX55C12'), 12);
  assert.equal(zenerVoltage('5V1'), 5.1);
  assert.deepEqual(sourceVoltage('DC 9'), { voltage: 9, varying: false });
  assert.deepEqual(sourceVoltage('9'), { voltage: 9, varying: false });
  assert.deepEqual(sourceVoltage('dc=5'), { voltage: 5, varying: false });
  assert.deepEqual(sourceVoltage('PULSE(0 5 1m 1n 1n 5m 10m)'), { voltage: 5, varying: true });
  assert.deepEqual(sourceVoltage('SINE(2 1 1k)'), { voltage: 2, varying: true });
  assert.deepEqual(sourceVoltage('dc=0 ampl=1 f=1k'), { voltage: 0, varying: true });
  assert.deepEqual(railVoltage('+3V3'), { voltage: 3.3, negative: false });
  assert.deepEqual(railVoltage('+3.3V'), { voltage: 3.3, negative: false });
  assert.deepEqual(railVoltage('+12V'), { voltage: 12, negative: false });
  assert.deepEqual(railVoltage('-12V'), { voltage: 12, negative: true });
  assert.deepEqual(railVoltage('VCC'), { voltage: 5, negative: false });
  assert.equal(railVoltage('GND'), null);
});

test('inferType classifies parts by designator, library and value', () => {
  const cases = [
    [{ ref: 'R1', lib: 'Device:R' }, 'resistor'], [{ ref: 'RV1', lib: 'Device:R_Potentiometer' }, 'potentiometer'],
    [{ ref: 'R2', lib: 'Device:R_Potentiometer' }, 'potentiometer'], [{ ref: 'R3', lib: 'Device:R_Photo' }, 'ldr'],
    [{ ref: 'TH1', lib: 'Device:Thermistor_NTC' }, 'thermistor'], [{ ref: 'C1', value: '100n' }, 'capacitor'],
    [{ ref: 'L1' }, 'inductor'], [{ ref: 'F1' }, 'fuse'], [{ ref: 'D1', lib: 'Device:D', value: '1N4148' }, 'diode'],
    [{ ref: 'D2', lib: 'Device:LED' }, 'led'], [{ ref: 'D3', value: 'BZX79C5V1' }, 'zener'], [{ ref: 'D4', lib: 'Device:D_Zener' }, 'zener'],
    [{ ref: 'LED1', lib: 'led:LED5MM' }, 'led'], [{ ref: 'Q1', value: '2N2222' }, 'npn'], [{ ref: 'Q2', value: 'BC557' }, 'pnp'],
    [{ ref: 'Q3', value: '2N3906' }, 'pnp'], [{ ref: 'Q4', lib: 'Device:Q_PNP_EBC' }, 'pnp'], [{ ref: 'Q5' }, 'npn'],
    [{ ref: 'SW1', lib: 'Switch:SW_Push' }, 'pushbutton'], [{ ref: 'SW2', lib: 'Switch:SW_SPDT' }, 'spdt'], [{ ref: 'SW3', lib: 'Switch:SW_SPST' }, 'switch'],
    [{ ref: 'BT1', lib: 'Device:Battery' }, 'battery'], [{ ref: 'BT2', lib: 'Device:Battery_Cell', value: 'CR2032' }, 'cell'],
    [{ ref: 'V1' }, 'supply'], [{ ref: 'M1', lib: 'Motor:Motor_DC' }, 'motor'], [{ ref: 'LS1' }, 'speaker'], [{ ref: 'BZ1' }, 'buzzer'],
    [{ ref: 'LP1' }, 'lamp'],
    [{ ref: 'U1', value: 'LM358' }, null], [{ ref: 'J1', lib: 'Connector:Conn_01x02' }, null], [{ ref: 'TP1' }, null],
    [{ ref: 'H1', lib: 'Mechanical:MountingHole' }, null], [{ ref: 'Y1', value: '16MHz' }, null], [{ ref: 'Q6', lib: 'Device:Q_NMOS_GSD' }, null],
    [{ ref: 'MIC1' }, null], [{ ref: 'BUS1' }, null],
  ];
  for (const [info, expected] of cases) assert.equal(inferType(info), expected, JSON.stringify(info));
});

test('pin mapping uses names first (KiCad LED: pin 1 = K, pin 2 = A)', () => {
  const led = mapPins('led', [{ number: '1', name: 'K', net: 'k' }, { number: '2', name: 'A', net: 'a' }]);
  assert.deepEqual(led.map(p => p.net), ['a', 'k']);
  const bjt = mapPins('npn', [{ number: '1', name: 'E', net: 'e' }, { number: '2', name: 'B', net: 'b' }, { number: '3', name: 'C', net: 'c' }]);
  assert.deepEqual(bjt.map(p => p.net), ['c', 'b', 'e']);
  const pot = mapPins('potentiometer', [{ number: '1', name: '1', net: 'x' }, { number: '2', name: '2', net: 'w' }, { number: '3', name: '3', net: 'y' }]);
  assert.deepEqual(pot.map(p => p.net), ['x', 'y', 'w']);
  const bat = mapPins('battery', [{ number: '1', name: '-', net: 'n' }, { number: '2', name: '+', net: 'p' }]);
  assert.deepEqual(bat.map(p => p.net), ['p', 'n']);
  const unnamedDiode = mapPins('diode', [{ number: '1', name: '~', net: 'k' }, { number: '2', name: '~', net: 'a' }], { order: ['2', '1'] });
  assert.deepEqual(unnamedDiode.map(p => p.net), ['a', 'k']);
});

test('orientation conventions validated against real files', () => {
  // KiCad: y-up library, rotate CCW on screen, then mirror in sheet space.
  assert.deepEqual(kicadPinPosition(0, 3.81, { x: 100, y: 50, angle: 90 }), { x: 96.19, y: 50 });
  assert.deepEqual(kicadPinPosition(-5.08, 0, { x: 100, y: 50, angle: 0 }, 'y'), { x: 105.08, y: 50 });
  assert.deepEqual(kicadPinPosition(0, 2.54, { x: 0, y: 0, angle: 90 }, 'x'), { x: -2.54, y: 0 });
  // LTspice: R90 is clockwise (y-down); M mirrors x after rotating.
  assert.deepEqual(ltspicePinPosition(16, 16, 0, 0, 'R90'), { x: -16, y: 16 });
  assert.deepEqual(ltspicePinPosition(16, 96, 0, 0, 'M90'), { x: 96, y: 16 });
  // Eagle: y-up, R90 counter-clockwise, M mirrors x after rotating.
  assert.deepEqual(eaglePinPosition(5.08, 0, 0, 0, 'R90'), { x: 0, y: 5.08 });
  assert.deepEqual(eaglePinPosition(0, 2.54, 0, 0, 'MR90'), { x: 2.54, y: 0 });
});

test('decodeText handles UTF-8 (BOM), UTF-16 LE/BE (BOM or not) and Latin-1', () => {
  const text = 'Version 4\nSYMBOL res 16 16 R0\n';
  const le = Uint8Array.from([...text].flatMap(c => [c.charCodeAt(0), 0]));
  const be = Uint8Array.from([...text].flatMap(c => [0, c.charCodeAt(0)]));
  assert.equal(decodeText(le), text);
  assert.equal(decodeText(Uint8Array.from([0xff, 0xfe, ...le])), text);
  assert.equal(decodeText(Uint8Array.from([0xfe, 0xff, ...be])), text);
  assert.equal(decodeText(be), text);
  assert.equal(decodeText(Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('10µF')])), '10µF');
  assert.equal(decodeText(new TextEncoder().encode('10µF').buffer), '10µF');
  assert.equal(decodeText(Uint8Array.from([0x31, 0x30, 0xb5, 0x46])), '10µF', 'invalid UTF-8 falls back to Latin-1');
  assert.equal(decodeText('\uFEFFhello'), 'hello');
  // A Latin-1 µ in an LTspice value still parses.
  const asc = `Version 4\nSHEET 1 880 680\nWIRE 16 0 16 -32\nFLAG 16 64 0\nSYMBOL voltage 16 -48 R0\nSYMATTR InstName V1\nSYMATTR Value 5\nSYMBOL cap 0 0 R0\nSYMATTR InstName C1\nSYMATTR Value 10\xb5\n`;
  const bytes = Uint8Array.from(asc, ch => ch.charCodeAt(0));
  const r = importDiagram('cap.asc', bytes);
  assert.equal(byRef(r.project, 'C1').value, 10);
});

test('detectFormat prefers content and falls back to the extension', () => {
  assert.equal(detectFormat('a.kicad_sch', '(kicad_sch (version 20231120) (generator "eeschema"))'), 'kicad-sch');
  assert.equal(detectFormat('wrong.cir', '(kicad_sch (version 20231120))'), 'kicad-sch');
  assert.equal(detectFormat('a.net', '(export (version "E") (design))'), 'kicad-netlist');
  assert.equal(detectFormat('a.net', '* LTspice netlist\nR1 in out 1k\nV1 in 0 5\n.end\n'), 'spice');
  assert.equal(detectFormat('a.sch', 'EESchema Schematic File Version 4\nEELAYER 30 0\n'), 'kicad-legacy');
  assert.equal(detectFormat('a.sch', '<?xml version="1.0"?>\n<!DOCTYPE eagle SYSTEM "eagle.dtd">\n<eagle version="9.6.2"><drawing><schematic/></drawing></eagle>'), 'eagle-sch');
  assert.equal(detectFormat('a.brd', '<?xml version="1.0"?>\n<eagle version="9.6.2"><drawing><board/></drawing></eagle>'), 'eagle-brd');
  assert.equal(detectFormat('a.asc', 'Version 4\nSHEET 1 880 680\nWIRE 0 0 16 0\n'), 'ltspice-asc');
  assert.equal(detectFormat('circuit.txt', 'My divider\nR1 in out 10k\nR2 out 0 10k\nV1 in 0 9\n'), 'spice');
  assert.equal(detectFormat('a.json', JSON.stringify(initialProject())), 'current-json');
  assert.equal(detectFormat('notes.txt', 'Remember to buy milk.'), null);
  assert.equal(detectFormat('a.cir', ''), null);
  assert.ok(ACCEPTED_EXTENSIONS.includes('.kicad_sch') && ACCEPTED_EXTENSIONS.includes('.asc'));
});

// ---------------------------------------------------------------------------
// Errors

test('pictures, PDFs and archives are rejected with a helpful message', () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]);
  const webp = new TextEncoder().encode('RIFF\x10\x00\x00\x00WEBPVP8 ');
  for (const [name, data] of [['circuit.png', png], ['upload.bin', png], ['photo.jpg', jpeg], ['scan.webp', webp], ['drawing.gif', new TextEncoder().encode('GIF89a')], ['sketch.jpeg', 'not really a jpeg']]) {
    assert.throws(() => importDiagram(name, data), e => e instanceof ImportError && /picture/.test(e.message) && /KiCad|LTspice|SPICE/.test(e.message), name);
  }
  assert.throws(() => importDiagram('datasheet.pdf', new TextEncoder().encode('%PDF-1.7\n')), e => e instanceof ImportError && /PDF/.test(e.message));
  assert.throws(() => importDiagram('project.fzz', Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0])), e => e instanceof ImportError && /Fritzing/.test(e.message));
  assert.throws(() => importDiagram('bundle.zip', Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0])), e => e instanceof ImportError && /ZIP/.test(e.message));
});

test('legacy KiCad, Eagle boards, empty and unknown files explain what to do', () => {
  assert.throws(() => importDiagram('old.sch', 'EESchema Schematic File Version 4\nEELAYER 30 0\nEELAYER END\n'),
    e => e instanceof ImportError && /KiCad 6/.test(e.message) && /\.kicad_sch/.test(e.message));
  assert.throws(() => importDiagram('board.brd', '<?xml version="1.0"?>\n<eagle version="7.7.0"><drawing><board></board></drawing></eagle>'),
    e => e instanceof ImportError && /schematic/.test(e.message) && /\.brd/.test(e.message));
  for (const data of ['', '   \n', 'lorem ipsum dolor sit amet']) {
    assert.throws(() => importDiagram('mystery.txt', data), e => e instanceof ImportError && /couldn.t find any components/.test(e.message));
  }
  // Only unsupported parts: say so.
  assert.throws(() => importDiagram('ic.cir', 'IC only\nX1 a b c LM358\nI1 a 0 1m\n.end\n'),
    e => e instanceof ImportError && /couldn.t find any components we can simulate/.test(e.message) && /subcircuits/.test(e.message));
});

test('parts beyond the 150-part limit are rejected', () => {
  const lines = ['Big ladder', 'V1 n0 0 9'];
  for (let i = 0; i < 160; i++) lines.push(`R${i + 1} n${i} n${i + 1} 1k`);
  assert.throws(() => importDiagram('ladder.cir', lines.join('\n') + '\n.end\n'), e => e instanceof ImportError && /150/.test(e.message));
});

// ---------------------------------------------------------------------------
// buildProject behaviour

test('power rails without a source get a supply and ground, with a warning', () => {
  const parts = autoLayout([
    { ref: 'R1', type: 'resistor', value: 1000, pins: [{ net: '+3V3' }, { net: 'mid' }] },
    { ref: 'D1', type: 'led', text: 'green', pins: [{ net: 'mid' }, { net: 'GND' }] },
    { ref: 'R2', type: 'resistor', value: 4700, pins: [{ net: 'VCC' }, { net: 'GND' }] },
  ]);
  const { project, warnings } = buildProject({ name: 'Rails', parts });
  assertLayout(project);
  const supplies = project.components.filter(c => c.type === 'supply').map(c => c.value).sort();
  assert.deepEqual(supplies, [3.3, 5]);
  assert.ok(warnings.some(w => /No battery or power supply/.test(w) && /3\.3 V/.test(w) && /VCC/.test(w)));
  assert.equal(byRef(project, 'D1').color, '#82b94d');
  assert.equal(byRef(project, 'D1').value, 2.2);
  const v3 = project.components.find(c => c.type === 'supply' && c.value === 3.3);
  assert.deepEqual(netlist(project).filter(n => n.includes(`${v3.ref}.0`)), [`R1.0 ${v3.ref}.0`]);
  // With a battery present, rails are left alone.
  const withBattery = buildProject({ parts: autoLayout([...parts.map(p => ({ ...p })), { ref: 'BT1', type: 'battery', value: 9, pins: [{ net: '+3V3' }, { net: 'GND' }] }]) });
  assert.equal(withBattery.project.components.filter(c => c.type === 'supply').length, 0);
});

test('ids are lowercase refs, deduplicated; values convert to registry units', () => {
  const parts = autoLayout([
    { ref: 'R1', type: 'resistor', value: 4700, pins: [{ net: 'a' }, { net: '0' }] },
    { ref: 'r1', type: 'resistor', value: 100, pins: [{ net: 'a' }, { net: '0' }] },
    { ref: 'C1', type: 'capacitor', value: 1e-7, pins: [{ net: 'a' }, { net: '0' }] },
    { ref: 'L1', type: 'inductor', value: 0.01, pins: [{ net: 'a' }, { net: '0' }] },
    { ref: 'D1', type: 'zener', text: '1N4733A', pins: [{ net: '0' }, { net: 'a' }] },
    { ref: 'D2', type: 'diode', text: '1N5819', pins: [{ net: 'a' }, { net: '0' }] },
    { ref: 'V1', type: 'supply', value: -12, pins: [{ net: 'a' }, { net: '0' }] },
  ], { groundNets: ['0'] });
  const { project } = buildProject({ parts, groundNets: ['0'] });
  assertLayout(project);
  assert.deepEqual(project.components.map(c => c.id).filter(id => id.startsWith('r')), ['r1', 'r1-2']);
  near(byRef(project, 'C1').value, 0.1);
  near(byRef(project, 'L1').value, 10);
  assert.equal(byRef(project, 'D1').value, 5.1);
  assert.equal(byRef(project, 'D2').value, 0.3);
  // A negative source is flipped so its value stays positive.
  assert.equal(byRef(project, 'V1').value, 12);
  const groundNet = netlist(project).find(n => n.includes('GND'));
  assert.ok(groundNet.includes('V1.0'), 'the negative source’s + terminal is on ground');
});

test('SPICE/LTspice parameters: .param, .params, .step fallbacks and {expressions}', () => {
  const params = collectParams(['.param R=1k Val=25', '.params VIN=12', '.step param Rload list 100 200 300']);
  assert.equal(evaluateExpression('{2*R}', params), 2000);
  assert.equal(evaluateExpression('{R*(Val/100)}', params), 250);
  assert.equal(evaluateExpression('(1k+500)/2'), 750);
  assert.equal(evaluateExpression('{Rload}', params), 100);
  assert.ok(Number.isNaN(evaluateExpression('{ if(time<2m, 20, 0.5) }', params)));
  assert.equal(substituteParams('DC {VIN}', params), 'DC 12');
  const r = importDiagram('divider.cir', 'Divider\n.param RTOP=10k\nV1 in 0 {VIN}\nR1 in out {RTOP}\nR2 out 0 {RTOP/2}\n.params VIN=6\n.op\n.end\n');
  assert.equal(byRef(r.project, 'V1').value, 6);
  assert.equal(byRef(r.project, 'R1').value, 10000);
  assert.equal(byRef(r.project, 'R2').value, 5000);
  // Values with notes after them still parse.
  near(parseValue('2200uF;63V'), 2200e-6);
  near(parseValue('47R;1W'), 47);
  near(parseValue('10k,1%'), 10000);
  near(parseValue('4,7k'), 4700);
});

test('KiCad 6 files keep annotation in a root symbol_instances table', () => {
  let text = decodeText(fixture('led-circuit.kicad_sch')).replace('(version 20231120)', '(version 20211123)');
  const table = [];
  // Move each symbol's (instances …) annotation into a KiCad 6 style table and un-annotate the field.
  text = text.replace(/\(uuid "([^"]+)"\)\n\t\t\(property "Reference" "([^"]+)"([\s\S]*?)\t\t\(instances[\s\S]*?\n\t\t\)\n\t\)/g, (m, uuid, ref, body) => {
    table.push(`\t\t(path "/${uuid}" (reference "${ref}") (unit 1) (value "") (footprint ""))`);
    return `(uuid "${uuid}")\n\t\t(property "Reference" "${ref.replace(/\d+$/, '?')}"${body}\t)`;
  });
  assert.equal(table.length, 5);
  text = text.replace(/\t\(sheet_instances/, `\t(symbol_instances\n${table.join('\n')}\n\t)\n\t(sheet_instances`);
  const r = importDiagram('led-circuit.kicad_sch', text);
  assert.deepEqual(r.project.components.map(c => c.ref).sort(), ['BT1', 'D1', 'GND1', 'R1', 'SW1']);
  assert.deepEqual(netlist(r.project), nets(['BT1.0 SW1.1', 'R1.0 SW1.0', 'D1.0 R1.1', 'BT1.1 D1.1 GND']));
});

test('KiCad labels join separate wire islands by name', () => {
  const text = decodeText(fixture('led-circuit.kicad_sch'))
    // Cut the wire between R1 and the LED corner, then label both ends "LED_A".
    .replace(/\t\(wire\n\t\t\(pts \(xy 134\.62 76\.2\) \(xy 143\.51 76\.2\)\)[\s\S]*?\n\t\)\n/, '')
    .replace('(label "LED_A"\n\t\t(at 138.43 76.2 0)', '(label "LED_A"\n\t\t(at 134.62 76.2 0)')
    .replace('\t(symbol\n\t\t(lib_id "Device:Battery")', '\t(global_label "LED_A" (shape input) (at 143.51 76.2 180) (effects (font (size 1.27 1.27))))\n\t(label "LED_A" (at 143.51 76.2 0) (effects (font (size 1.27 1.27))))\n\t(symbol\n\t\t(lib_id "Device:Battery")');
  const r = importDiagram('labels.kicad_sch', text);
  assert.deepEqual(netlist(r.project), nets(['BT1.0 SW1.1', 'R1.0 SW1.0', 'D1.0 R1.1', 'BT1.1 D1.1 GND']));
});
