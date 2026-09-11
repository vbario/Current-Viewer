import { endpointPosition } from './circuit.js';

export function wirePoints(wire, components) {
  const a = endpointPosition(wire.from, components), b = endpointPosition(wire.to, components);
  const via = wire.via ?? [{ x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }];
  // Keep both fixed endpoints while dropping redundant bends at terminals.
  const points = [a];
  for (const p of via) if (Math.hypot(p.x - points.at(-1).x, p.y - points.at(-1).y) > .5) points.push({ ...p });
  if (points.length > 1 && Math.hypot(points.at(-1).x - b.x, points.at(-1).y - b.y) <= .5) points.pop();
  points.push(b);
  return points;
}

export function nearestSegment(points, point) {
  let best = { index: 0, distance: Infinity, point: points[0] };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const projected = { x: a.x + t * dx, y: a.y + t * dy };
    const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
    if (distance < best.distance) best = { index: i, distance, point: projected };
  }
  return best;
}

export function moveSegment(points, index, dx, dy) {
  const a = points[index], b = points[index + 1];
  // Straight runs move perpendicular to their direction, preserving square corners.
  if (Math.abs(a.y - b.y) < .5) dx = 0;
  else if (Math.abs(a.x - b.x) < .5) dy = 0;
  const movedA = { x: a.x + dx, y: a.y + dy }, movedB = { x: b.x + dx, y: b.y + dy };
  // Terminal positions never move. Add a bend beside a terminal when needed.
  return [...points.slice(1, index), movedA, movedB, ...points.slice(index + 2, -1)];
}

export function insertBend(points, point) {
  const segment = nearestSegment(points, point);
  const via = points.slice(1, -1).map(p => ({ ...p }));
  via.splice(segment.index, 0, { ...segment.point });
  return via;
}
