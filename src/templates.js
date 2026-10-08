import { initialProject } from './circuit.js';

export const TEMPLATES = [
  { kind: 'led', type: 'led', name: 'Your first light', description: 'A battery, a resistor, and a small bright idea.', level: 'Beginner' },
  { kind: 'lamp', type: 'lamp', name: 'A bright idea', description: 'Flip the switch and light up your workbench.', level: 'Beginner' },
  { kind: 'motor', type: 'motor', name: 'Make it move', description: 'Turn electrical energy into a little motion.', level: 'Beginner' },
  { kind: 'dimmer', type: 'potentiometer', name: 'LED dimmer', description: 'Turn a knob and watch the ammeter follow.', level: 'Beginner' },
  { kind: 'doorbell', type: 'pushbutton', name: 'Doorbell', description: 'Run it, then hold the button to sound the buzzer.', level: 'Beginner' },
  { kind: 'nightlight', type: 'ldr', name: 'Night light', description: 'A transistor lights the LED when it gets dark.', level: 'Intermediate' },
];

const part = (id, type, value, x, y, schematic, extra = {}) => ({ id, type, x, y, rotation: 0, value, ...extra, schematic });

export function templateProject(kind) {
  const p = initialProject();
  if (kind === 'lamp') { p.name = 'A bright idea'; p.components = p.components.filter(c => c.id !== 'r1').map(c => c.id === 'led1' ? { ...c, type: 'lamp', value: 100, y: 270 } : c); p.wires = p.wires.filter(w => !['w2', 'w3'].includes(w.id)); p.wires.push({ id: 'w5', from: 'sw1:1', to: 'led1:0', color: '#d5a143' }); }
  if (kind === 'motor') { p.name = 'Make it move'; p.components = p.components.filter(c => c.id !== 'r1').map(c => c.id === 'led1' ? { ...c, type: 'motor', value: 60, y: 290 } : c); p.wires = p.wires.filter(w => !['w2', 'w3'].includes(w.id)); p.wires.push({ id: 'w5', from: 'sw1:1', to: 'led1:0', color: '#78977b' }); }
  if (kind === 'dimmer') return {
    name: 'LED dimmer',
    components: [
      part('bat1', 'battery', 9, 150, 440, { x: 260, y: 380, rotation: 0 }),
      part('am1', 'ammeter', 0, 330, 330, { x: 380, y: 260, rotation: 0 }),
      part('rv1', 'potentiometer', 5000, 520, 332, { x: 540, y: 260, rotation: 0 }, { position: 20 }),
      part('r1', 'resistor', 330, 700, 374, { x: 700, y: 260, rotation: 0 }),
      part('led1', 'led', 2, 870, 342, { x: 800, y: 340, rotation: 90 }, { color: '#82b94d' }),
    ],
    wires: [
      { id: 'w1', from: 'bat1:0', to: 'am1:0', color: '#dc6a52', via: [{ x: 113, y: 300 }, { x: 250, y: 300 }, { x: 250, y: 374 }] },
      { id: 'w2', from: 'am1:1', to: 'rv1:0', color: '#d5a143', via: [] },
      { id: 'w3', from: 'rv1:1', to: 'rv1:2', color: '#9f85b6', via: [{ x: 544, y: 404 }, { x: 520, y: 404 }] },
      { id: 'w4', from: 'rv1:1', to: 'r1:0', color: '#9f85b6', via: [] },
      { id: 'w5', from: 'r1:1', to: 'led1:0', color: '#78977b', via: [] },
      { id: 'w6', from: 'led1:1', to: 'bat1:1', color: '#687b8d', via: [{ x: 940, y: 374 }, { x: 940, y: 470 }, { x: 188, y: 470 }] },
    ],
  };
  if (kind === 'doorbell') return {
    name: 'Doorbell',
    components: [
      part('bat1', 'battery', 9, 150, 420, { x: 300, y: 380, rotation: 0 }),
      part('sw1', 'pushbutton', 0, 380, 300, { x: 440, y: 260, rotation: 0 }),
      part('bz1', 'buzzer', 150, 620, 320, { x: 600, y: 360, rotation: 90 }),
    ],
    wires: [
      { id: 'w1', from: 'bat1:0', to: 'sw1:0', color: '#dc6a52', via: [{ x: 113, y: 300 }] },
      { id: 'w2', from: 'sw1:1', to: 'bz1:0', color: '#d5a143', via: [{ x: 520, y: 300 }, { x: 520, y: 348 }] },
      { id: 'w3', from: 'bz1:1', to: 'bat1:1', color: '#687b8d', via: [{ x: 700, y: 348 }, { x: 700, y: 440 }, { x: 188, y: 440 }] },
    ],
  };
  if (kind === 'nightlight') return {
    name: 'Night light',
    components: [
      part('bat1', 'battery', 9, 150, 440, { x: 220, y: 400, rotation: 0 }),
      part('r2', 'resistor', 330, 400, 230, { x: 640, y: 200, rotation: 90 }),
      part('led1', 'led', 2, 640, 260, { x: 640, y: 300, rotation: 90 }, { color: '#dbaa36' }),
      part('q1', 'npn', 100, 560, 360, { x: 620, y: 400, rotation: 0 }),
      part('r1', 'resistor', 47000, 820, 230, { x: 440, y: 200, rotation: 90 }),
      part('ldr1', 'ldr', 20, 900, 380, { x: 440, y: 400, rotation: 90 }),
    ],
    wires: [
      { id: 'w1', from: 'bat1:0', to: 'r2:0', color: '#dc6a52', via: [{ x: 113, y: 230 }] },
      { id: 'w2', from: 'r2:0', to: 'r1:0', color: '#dc6a52', via: [{ x: 343, y: 170 }, { x: 763, y: 170 }] },
      { id: 'w3', from: 'r2:1', to: 'led1:0', color: '#d5a143', via: [{ x: 600, y: 230 }, { x: 600, y: 292 }] },
      { id: 'w4', from: 'led1:1', to: 'q1:0', color: '#78977b', via: [{ x: 680, y: 292 }, { x: 680, y: 430 }, { x: 580, y: 430 }] },
      { id: 'w5', from: 'q1:1', to: 'r1:1', color: '#9f85b6', via: [{ x: 560, y: 460 }, { x: 940, y: 460 }, { x: 940, y: 230 }] },
      { id: 'w6', from: 'ldr1:0', to: 'r1:1', color: '#9f85b6', via: [{ x: 860, y: 414 }, { x: 860, y: 230 }] },
      { id: 'w7', from: 'ldr1:1', to: 'q1:2', color: '#687b8d', via: [{ x: 960, y: 414 }, { x: 960, y: 500 }, { x: 540, y: 500 }] },
      { id: 'w8', from: 'q1:2', to: 'bat1:1', color: '#687b8d', via: [{ x: 500, y: 402 }, { x: 500, y: 470 }, { x: 188, y: 470 }] },
    ],
  };
  return p;
}
