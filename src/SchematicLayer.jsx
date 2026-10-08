import React from 'react';
import { PARTS, partBox, partValueLabel, pinDirection, pinPosition, placement } from './parts.js';
import { SchematicSymbol } from './SchematicSymbol.jsx';
import { edgeCurrents } from './schematic.js';
import { formatWireCurrent, formatWireVoltage } from './WireReadouts.jsx';

function meterText(c, reading) {
  if (!reading) return null;
  if (c.type === 'ammeter') return formatWireCurrent(reading.current);
  if (c.type === 'voltmeter') return formatWireVoltage(reading.voltage);
  return null;
}

/** Designator and value beside a symbol, kept upright whatever the rotation. */
function SymbolLabel({ c, designator, reading, running }) {
  const box = partBox(c, 'schematic');
  const lines = [[designator, 'designator'], [partValueLabel(c), 'value'], [running && meterText(c, reading), 'reading']].filter(([text]) => text);
  if (box.w >= box.h) {
    // Designator above and value below, unless a lead leaves that side.
    const cx = box.x + box.w / 2, sides = PARTS[c.type].pins.map((_, pin) => pinDirection(c, pin));
    const above = sides.includes('up') ? [] : sides.includes('down') ? lines : lines.slice(0, 1);
    const below = lines.filter(line => !above.includes(line));
    return <g className="schematic-label" pointerEvents="none">
      {above.map(([text, kind], i) => <text key={kind} x={cx} y={box.y - 13 - (above.length - 1 - i) * 14} textAnchor="middle" className={kind}>{text}</text>)}
      {below.map(([text, kind], i) => <text key={kind} x={cx} y={box.y + box.h + 18 + i * 14} textAnchor="middle" className={kind}>{text}</text>)}
    </g>;
  }
  const x = box.x + box.w + 12, top = box.y + box.h / 2 - (lines.length - 1) * 7 + 4;
  return <g className="schematic-label" pointerEvents="none">
    {lines.map(([text, kind], i) => <text key={kind} x={x} y={top + i * 14} className={kind}>{text}</text>)}
  </g>;
}

export default function SchematicLayer({ components, routing, result, running, showFlow, showLabels, flowSpeed, selected, wireStart, mode, designators, pressed, onPartPointerDown, onTerminal, onNetPointerDown, startPan }) {
  const parts = components.filter(c => PARTS[c.type]?.schematic);
  const groundNets = new Set(routing.nets.filter(net => net.pins.some(pin => components.find(c => c.id === pin.split(':')[0])?.type === 'ground')).map(net => net.key));
  return <>
    <g className="schematic-nets">
      {routing.nets.map(net => {
        const currents = running && showFlow ? edgeCurrents(net, result.pinCurrents) : null;
        return <g key={net.key} className={`schematic-net ${selected === `net:${net.key}` ? 'is-selected' : ''}`} data-net={net.key} onPointerDown={e => onNetPointerDown(e, net)}>
          {net.edges.map((edge, i) => {
            const a = net.nodes[edge.a], b = net.nodes[edge.b];
            const forward = !currents || currents[i] >= 0, [from, to] = forward ? [a, b] : [b, a];
            return <g key={i}>
              <line className="net-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>
              <line className="net-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>
              {currents && Math.abs(currents[i]) > 0.00001 && <line className="schematic-flow" x1={from.x} y1={from.y} x2={to.x} y2={to.y} style={{ animationDuration: `${1.5 / flowSpeed}s` }}/>}
            </g>;
          })}
          {net.junctions.map((j, i) => <circle key={i} className="net-junction" cx={j.x} cy={j.y} r="3.6"/>)}
        </g>;
      })}
    </g>
    {parts.map(c => {
      const at = placement(c, 'schematic'), [x1, y1, x2, y2] = PARTS[c.type].schematic.box;
      const reading = result.readings[c.id], active = running && !!reading?.active, isSelected = selected === c.id;
      return <g key={c.id} className={`schematic-part ${isSelected ? 'is-selected' : ''} ${active ? 'is-active' : ''}`} data-component={c.id}>
        <g transform={`translate(${at.x},${at.y}) rotate(${at.rotation})`} onPointerDown={e => onPartPointerDown(e, c)}>
          <rect className="symbol-hit" x={x1 - 6} y={y1 - 6} width={x2 - x1 + 12} height={y2 - y1 + 12} rx="4"/>
          {isSelected && <rect className="symbol-selection" x={x1 - 8} y={y1 - 8} width={x2 - x1 + 16} height={y2 - y1 + 16} rx="5"/>}
          <SchematicSymbol type={c.type} value={c.value} color={c.color} position={c.position} active={active} pressed={pressed === c.id} blown={running && c.type === 'fuse' && reading?.state === true} rotation={at.rotation}/>
        </g>
        {showLabels && c.type !== 'ground' && <SymbolLabel c={c} designator={c.label || designators[c.id]} reading={reading} running={running}/>}
        {PARTS[c.type].pins.map((name, pin) => {
          const key = `${c.id}:${pin}`, p = pinPosition(c, pin, 'schematic');
          return <g key={pin} data-terminal={key} className={`schematic-pin ${wireStart === key ? 'is-start' : ''}`} onPointerDown={e => { if (mode === 'pan') { startPan(e); return; } e.stopPropagation(); onTerminal(key); }}>
            <circle cx={p.x} cy={p.y} r="8" className="pin-hit"/>
            <circle cx={p.x} cy={p.y} r="3.2" className="pin-dot"/>
            <title>{`${designators[c.id]} · ${name} — click to wire`}</title>
          </g>;
        })}
      </g>;
    })}
    {running && showFlow && routing.nets.filter(net => !groundNets.has(net.key) && net.label).map(net => {
      const text = formatWireVoltage(result.pinVoltages[net.pins[0]]), width = text.length * 6.6 + 14;
      // Keep the pill clear of its wire: above horizontal runs, beside vertical ones.
      const x = net.label.horizontal ? net.label.x : net.label.x + width / 2, y = net.label.horizontal ? net.label.y - 7 : net.label.y;
      return <g key={net.key} className="net-voltage" transform={`translate(${x},${y})`} pointerEvents="none" data-net-voltage={net.key}>
        <rect x={-width / 2} y="-9" width={width} height="18" rx="9"/>
        <text textAnchor="middle" y="4">{text}</text>
      </g>;
    })}
  </>;
}
