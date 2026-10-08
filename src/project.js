import { PARTS } from './parts.js';

export const MAX_COMPONENTS = 150;
export const MAX_WIRES = 500;
const BOARD_ROWS = ['topPlus', 'topMinus', 'bottomPlus', 'bottomMinus', ...'abcdefghij'];
const finite = value => Number.isFinite(value);

export function validEndpoint(endpoint, byId) {
  if (typeof endpoint !== 'string') return false;
  const [id, pin, col] = endpoint.split(':'), c = byId.get(id);
  if (!c) return false;
  if (c.type === 'breadboard') return BOARD_ROWS.includes(pin) && Number.isInteger(Number(col)) && Number(col) >= 0 && Number(col) < 30;
  const index = Number(pin);
  return col === undefined && /^\d+$/.test(pin) && index < PARTS[c.type].pins.length;
}

function validComponent(c) {
  const part = c && PARTS[c.type];
  if (!part || typeof c.id !== 'string' || c.id.includes(':')) return false;
  if (![c.x, c.y, c.value, c.rotation || 0].every(finite)) return false;
  if (c.value < Math.min(0, part.field?.min ?? 0)) return false;
  if (c.schematic !== undefined && !(c.schematic && finite(c.schematic.x) && finite(c.schematic.y) && finite(c.schematic.rotation || 0))) return false;
  if (c.position !== undefined && !finite(c.position)) return false;
  return [c.label, c.ref, c.color].every(v => v === undefined || typeof v === 'string');
}

/** Structural validation for stored, imported, and generated projects. */
export function validProject(p) {
  if (!p || typeof p.name !== 'string' || !Array.isArray(p.components) || !Array.isArray(p.wires)) return false;
  if (p.components.length > MAX_COMPONENTS || p.wires.length > MAX_WIRES) return false;
  const byId = new Map();
  for (const c of p.components) {
    if (!validComponent(c) || byId.has(c.id)) return false;
    byId.set(c.id, c);
  }
  return p.wires.every(w => w && typeof w.id === 'string' && typeof w.color === 'string'
    && validEndpoint(w.from, byId) && validEndpoint(w.to, byId)
    && (w.via === undefined || Array.isArray(w.via) && w.via.every(p => p && finite(p.x) && finite(p.y))));
}
