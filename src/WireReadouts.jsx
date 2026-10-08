import React, { useEffect, useRef, useState } from 'react';
import { wirePoints } from './wireGeometry.js';
import { partBox } from './parts.js';

export function formatWireVoltage(value) {
  return Number.isFinite(value) ? `${(Math.abs(value) < .005 ? 0 : value).toFixed(2)} V` : '— V';
}

export function formatWireCurrent(value) {
  if (!Number.isFinite(value)) return '— mA';
  const magnitude = Math.abs(value);
  return magnitude >= 1 ? `${magnitude.toFixed(2)} A` : `${(magnitude * 1000).toFixed(2)} mA`;
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function placeReadouts(wires, components, scale) {
  const obstacles = components.filter(c => c.type !== 'breadboard').map(c => partBox(c, 'model'));
  return wires.map(wire => {
    const points = wirePoints(wire, components);
    const segments = points.slice(1).map((b, i) => ({ a: points[i], b, length: Math.hypot(b.x - points[i].x, b.y - points[i].y) })).sort((a, b) => b.length - a.length).slice(0, 3);
    const width = 150 * scale, height = 29 * scale;
    let best;
    for (const [rank, segment] of segments.entries()) {
      const nx = -(segment.b.y - segment.a.y) / (segment.length || 1), ny = (segment.b.x - segment.a.x) / (segment.length || 1);
      const edge = Math.abs(nx) * width / 2 + Math.abs(ny) * height / 2;
      for (const t of [.5, .3, .7]) for (const side of [1, -1]) for (const extra of [0, 24, 48]) {
        const anchor = { x: segment.a.x + (segment.b.x - segment.a.x) * t, y: segment.a.y + (segment.b.y - segment.a.y) * t };
        const distance = edge + (12 + extra) * scale;
        const x = anchor.x + nx * distance * side, y = anchor.y + ny * distance * side;
        const box = { x: x - width / 2 - 5, y: y - height / 2 - 5, w: width + 10, h: height + 10 };
        const outside = Math.max(0, 8 - box.x) + Math.max(0, box.x + box.w - 1042) + Math.max(0, 108 - box.y) + Math.max(0, box.y + box.h - 622);
        const score = obstacles.reduce((sum, obstacle) => sum + overlap(box, obstacle), 0) * 100 + outside * 1000 + extra + rank * 16 + Math.abs(t - .5) * 20;
        if (!best || score < best.score) best = { x, y, anchor, box, score };
      }
    }
    obstacles.push(best.box);
    return { ...best, wire };
  });
}

export default function WireReadouts({ wires, components, voltages, currents, referenceName }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const svg = ref.current.ownerSVGElement;
    const resize = () => {
      const { width, height } = svg.getBoundingClientRect();
      const baseScale = Math.min(width / 1050, height / 530);
      if (baseScale > 0) setScale(Math.max(1, .8 / baseScale));
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  return <g ref={ref} className="wire-readouts" pointerEvents="none">
    {placeReadouts(wires, components, scale).map(({ wire, x, y, anchor }) => {
      const voltage = formatWireVoltage(voltages[wire.id]), current = formatWireCurrent(currents[wire.id]);
      return <g key={wire.id} className="wire-readout" data-wire-readout={wire.id} data-voltage={voltages[wire.id]} data-current={currents[wire.id]} role="img" aria-label={`Wire: ${voltage} relative to ${referenceName} negative terminal; current ${current}`}>
        <path d={`M${anchor.x} ${anchor.y} L${x} ${y}`} stroke={wire.color} strokeOpacity=".5" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
        <circle cx={anchor.x} cy={anchor.y} r={2.5 * scale} fill={wire.color}/>
        <g transform={`translate(${x},${y}) scale(${scale})`}>
          <rect x="-75" y="-14.5" width="150" height="29" rx="7" fill="#ffffff" stroke={wire.color} strokeOpacity=".38" strokeWidth="1"/>
          <rect x="-74" y="-13.5" width="4" height="27" rx="2" fill={wire.color} opacity=".7"/>
          <text x="-36" y="4" textAnchor="middle" className="wire-voltage">{voltage}</text>
          <line x1="-1" y1="-7" x2="-1" y2="7" stroke="#e0e7d7"/>
          <text x="37" y="4" textAnchor="middle" className="wire-current">{current}</text>
        </g>
      </g>;
    })}
  </g>;
}
