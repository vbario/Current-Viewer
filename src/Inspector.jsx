import React from 'react';
import { Activity, ArrowUpRight, Check, Copy, Lightbulb, MousePointer2, MoveUpRight, Plus, RotateCw, Thermometer, Trash2, Waypoints } from 'lucide-react';
import { PARTS, LED_COLORS, formatValue, placement } from './parts.js';
import { PartThumbnail } from './PartGraphic.jsx';
import { SchematicThumbnail } from './SchematicSymbol.jsx';
import { formatWireCurrent, formatWireVoltage } from './WireReadouts.jsx';

export function Toggle({ checked, onChange, label }) { return <button type="button" className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span/></button>; }
export function ToolButton({ children, label, active, onClick, disabled, className = '' }) { return <button type="button" title={label} aria-label={label} className={`icon-button ${active ? 'active' : ''} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>; }

const NOTES = {
  battery: ['Internal resistance', '1 Ω'], cell: ['Internal resistance', '10 Ω'], supply: ['Internal resistance', '0.05 Ω'],
  resistor: ['Tolerance · rating', '±5% · ¼ W'], capacitor: ['At DC', 'Open once charged'], inductor: ['At DC', '0.5 Ω coil'],
  led: ['Max. current', '30 mA'], diode: ['Max. current', '1 A'], zener: ['Power rating', '½ W'], fuse: ['Behaviour', 'Opens above rating'],
  npn: ['Model', 'Vbe 0.7 V · Vce(sat) 0.2 V'], pnp: ['Model', 'Veb 0.7 V · Vec(sat) 0.2 V'], ammeter: ['Burden', '0.01 Ω'], voltmeter: ['Input resistance', '10 MΩ'],
  lamp: ['Model', 'Resistive load'], motor: ['Model', 'Resistive load'], buzzer: ['Model', 'Resistive load'], speaker: ['Model', 'Resistive load'], ground: ['Connection', 'All grounds are joined'],
};
const TRANSISTOR_STATES = { cutoff: 'Off (cut-off)', active: 'Amplifying (active)', saturation: 'Fully on (saturated)' };
const ldrResistance = light => 10 ** (6 - 3 * Math.min(100, Math.max(0, light)) / 100);
const ntcResistance = t => 10000 * Math.exp(3950 * (1 / (t + 273.15) - 1 / 298.15));

function Reading({ label, value, unit }) { return <div><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>; }

function ComponentPanel({ c, view, designator, reading, running, patch, onDuplicate, onDelete, onPress }) {
  const part = PARTS[c.type], field = part.field, at = placement(c, view), live = running && reading;
  const fix = (v, digits = 2) => live ? Math.abs(v).toFixed(digits) : '—';
  const setNumber = (key, raw, min, max) => { const v = Number(raw); if (raw !== '' && Number.isFinite(v) && v >= min && v <= max) patch(key, v); };
  return <div className="component-inspector">
    <div className="section-eyebrow">Selected component<div><ToolButton label="Duplicate component" onClick={onDuplicate}><Copy size={14}/></ToolButton><ToolButton label="Delete component" onClick={onDelete}><Trash2 size={14}/></ToolButton></div></div>
    <div className="selected-component-card">
      {view === 'schematic' ? <SchematicThumbnail type={c.type} large value={c.value} color={c.color}/> : <PartThumbnail type={c.type} large color={c.color} value={c.value}/>}
      <div><h2>{part.name}</h2><p>{part.description}</p></div>
      <span className="part-id">{designator}</span>
    </div>
    <label className="field-label">Label<input value={c.label || ''} placeholder={designator} onChange={e => patch('label', e.target.value)}/></label>
    {field && <label className="field-label">{field.label}
      <div className="number-field"><input aria-label={field.label} type="number" min={field.min} max={field.max} step={field.step} value={c.value} onChange={e => setNumber('value', e.target.value, field.min, field.max)}/><span>{part.unit || ''}</span></div>
    </label>}
    {field?.slider && <input className="range" aria-label={`${field.label} slider`} type="range" min={field.min} max={field.max} step={field.step} value={c.value} onChange={e => patch('value', Number(e.target.value))}/>}
    {field?.presets.length > 0 && <div className="quick-values">{field.presets.map(v => <button className={c.value === v ? 'selected' : ''} key={v} onClick={() => patch('value', v)}>{part.format ? v : formatValue(v, part.unit)}</button>)}</div>}
    {c.type === 'potentiometer' && <label className="field-label">Wiper position<span className="field-value">{Math.round(c.position ?? 50)}%</span><input className="range" aria-label="Wiper position" type="range" min="0" max="100" step="1" value={c.position ?? 50} onChange={e => patch('position', Number(e.target.value))}/></label>}
    {c.type === 'switch' && <div className="switch-property"><span>Switch position<small>{c.value ? 'Closed · current can flow' : 'Open · current is interrupted'}</small></span><Toggle label="Switch position" checked={!!c.value} onChange={v => patch('value', v ? 1 : 0)}/></div>}
    {c.type === 'spdt' && <div className="segmented-field"><span>Connected throw</span><div className="segmented">{['A', 'B'].map((throwName, i) => <button key={throwName} aria-pressed={!!c.value === !!i} className={!!c.value === !!i ? 'selected' : ''} onClick={() => patch('value', i)}>Common → {throwName}</button>)}</div></div>}
    {c.type === 'pushbutton' && <button className="button outline press-button" onPointerDown={() => onPress(c.id)} onPointerUp={() => onPress(null)} onPointerLeave={() => onPress(null)}>Hold to press</button>}
    {c.type === 'led' && <div className="color-picker"><label>LED colour</label><div>{Object.entries(LED_COLORS).map(([color, name]) => <button key={color} aria-label={`LED color ${name}`} title={name} className={c.color === color ? 'selected' : ''} style={{ background: color }} onClick={() => patch('color', color)}>{c.color === color && <Check size={12}/>}</button>)}</div></div>}
    {c.type === 'breadboard' && <p className="board-description">Each column joins its five holes within a–e or f–j. The centre gap separates both halves, and each coloured power rail runs the full length.</p>}
    {NOTES[c.type] && <div className="property-meta"><span>{NOTES[c.type][0]}</span><strong>{NOTES[c.type][1]}</strong></div>}
    {c.type === 'ldr' && <div className="property-meta"><span>Resistance now</span><strong>{formatValue(ldrResistance(c.value), 'Ω')}</strong></div>}
    {c.type === 'thermistor' && <div className="property-meta"><span>Resistance now</span><strong>{formatValue(ntcResistance(c.value), 'Ω')}</strong></div>}
    {c.type === 'potentiometer' && <div className="property-meta"><span>A–wiper · wiper–B</span><strong>{formatValue(c.value * (c.position ?? 50) / 100, 'Ω')} · {formatValue(c.value * (100 - (c.position ?? 50)) / 100, 'Ω')}</strong></div>}
    <details className="position-details"><summary><MoveUpRight size={13}/>Position<span>{Math.round(at.x)}, {Math.round(at.y)} · {at.rotation}°</span></summary>
      <div className="position-fields">{['x', 'y'].map(axis => <label key={axis}>{axis.toUpperCase()}<input aria-label={`Component ${axis.toUpperCase()} position`} type="number" step={view === 'schematic' ? 20 : 4} value={at[axis]} onChange={e => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) patch(axis, v); }}/></label>)}</div>
      <p>{view === 'schematic' ? 'Schematic placement snaps to a 20-unit grid and is independent of the workbench.' : 'Drag the part or its label. Arrow keys nudge; Shift moves farther.'}</p>
    </details>
    {c.type !== 'breadboard' && <>
      <div className="section-eyebrow readings-eyebrow">In this circuit<span className={`live-dot ${running ? 'on' : ''}`}/></div>
      <div className="component-readings">
        {c.type === 'npn' || c.type === 'pnp' ? <>
          <Reading label="Collector current" value={live ? (Math.abs(reading.current) * 1000).toFixed(2) : '—'} unit="mA"/>
          <Reading label="Base current" value={live ? (Math.abs(reading.baseCurrent) * 1000).toFixed(3) : '—'} unit="mA"/>
        </> : <>
          <Reading label="Voltage" value={fix(reading?.voltage)} unit="V"/>
          <Reading label="Current" value={live ? (Math.abs(reading.current) * 1000).toFixed(2) : '—'} unit="mA"/>
        </>}
      </div>
      {(c.type === 'npn' || c.type === 'pnp') && <div className="property-meta"><span>State</span><strong>{live ? TRANSISTOR_STATES[reading.state] : '—'}</strong></div>}
      {c.type === 'fuse' && live && <div className="property-meta"><span>State</span><strong>{reading.state ? 'Blown' : 'Intact'}</strong></div>}
      {live && reading.power > 0.0005 && <div className="property-meta"><span>Power</span><strong>{(reading.power * 1000).toFixed(1)} mW</strong></div>}
      {c.type === 'resistor' && <div className={`temperature-note ${live && reading.temperature > 60 ? 'hot' : ''}`}><Thermometer size={15}/><span>{live ? `${reading.temperature.toFixed(1)} °C` : '22.0 °C'}<small>{live && reading.temperature > 60 ? 'Getting warm' : 'Cool'}</small></span><span className="temp-bar"><i style={{ width: `${Math.min(100, live ? reading.temperature : 22)}%` }}/></span></div>}
    </>}
  </div>;
}

function WirePanel({ wire, points, project, designators, running, result, colors, onColor, onAddBend, onResetRoute, onDelete }) {
  const end = endpoint => { const [id, ...rest] = endpoint.split(':'), c = project.components.find(c => c.id === id); return `${c?.label || designators[id] || PARTS[c?.type]?.name} · ${c?.type === 'breadboard' ? rest.join(' / ') : PARTS[c?.type]?.pins[rest[0]] ?? rest[0]}`; };
  return <div className="component-inspector">
    <div className="section-eyebrow">Selected wire<ToolButton label="Delete wire" onClick={onDelete}><Trash2 size={14}/></ToolButton></div>
    <h2 className="wire-title">Jumper wire</h2>
    <div className="connection-info"><span>From</span><strong>{end(wire.from)}</strong><span>To</span><strong>{end(wire.to)}</strong></div>
    <div className="color-picker"><label>Wire colour</label><div>{colors.map(color => <button key={color} aria-label={`Wire color ${color}`} style={{ background: color }} className={wire.color === color ? 'selected' : ''} onClick={() => onColor(color)}>{wire.color === color && <Check size={12}/>}</button>)}</div></div>
    <div className="wire-routing-panel"><div className="section-eyebrow">Route<span>{Math.max(0, points.length - 2)} bends</span></div><p>Drag the wire to move a segment, or drag a round handle to shape a bend. Connections stay attached.</p><div className="wire-routing-actions"><button className="button outline" onClick={onAddBend}><Plus size={13}/>Add bend</button><button className="button outline" onClick={onResetRoute} disabled={!wire.via}><RotateCw size={13}/>Reset route</button></div><small>Double-click a bend to remove it.</small></div>
    <div className="property-meta"><span>Voltage</span><strong>{running ? formatWireVoltage(result.wireVoltages[wire.id]) : '— V'}</strong></div>
    <div className="property-meta"><span>Current</span><strong>{running ? formatWireCurrent(result.wireCurrents[wire.id]) : '— mA'}</strong></div>
  </div>;
}

function NetPanel({ net, project, designators, running, result }) {
  return <div className="component-inspector">
    <div className="section-eyebrow">Selected net</div>
    <h2 className="wire-title">{net.pins.length} connected pins</h2>
    <p className="inspector-description">Schematic wiring is drawn from your connections. Switch to Model view to edit individual wires.</p>
    <ul className="net-pins">{net.pins.map(pin => { const [id, index] = pin.split(':'), c = project.components.find(c => c.id === id); return <li key={pin}><strong>{c?.label || designators[id]}</strong><span>{PARTS[c?.type]?.pins[index]}</span></li>; })}</ul>
    <div className="property-meta"><span>Voltage</span><strong>{running ? formatWireVoltage(result.pinVoltages[net.pins[0]]) : '— V'}</strong></div>
  </div>;
}

export default function Inspector(props) {
  const { className, tab, setTab, view, component, selectedWire, selectedNet, project, designators, result, running, showFlow, setShowFlow, showEffects, setShowEffects, showHeat, setShowHeat, flowSpeed, setFlowSpeed, mode, wireColor, setWireColor, colors, onDiagnostics } = props;
  return <aside className={`inspector-panel ${className}`}>
    <div className="panel-tabs inspector-tabs"><button className={tab === 'properties' ? 'selected' : ''} onClick={() => setTab('properties')}>Properties</button><button className={tab === 'simulation' ? 'selected' : ''} onClick={() => setTab('simulation')}>Simulation{running && <span className="tab-dot"/>}</button></div>
    <div className="inspector-scroll">
      {tab === 'properties' && (component ? <ComponentPanel c={component} view={view} designator={designators[component.id]} reading={result.readings[component.id]} running={running} patch={props.patchComponent} onDuplicate={props.onDuplicate} onDelete={props.onDelete} onPress={props.onPress}/>
        : selectedWire ? <WirePanel wire={selectedWire} points={props.selectedWirePoints} project={project} designators={designators} running={running} result={result} colors={colors} onColor={props.onWireColor} onAddBend={props.onAddBend} onResetRoute={props.onResetRoute} onDelete={props.onDelete}/>
        : selectedNet ? <NetPanel net={selectedNet} project={project} designators={designators} running={running} result={result}/>
        : <div className="no-selection"><MousePointer2 size={24}/><h2>Nothing selected</h2><p>Select a part to edit its values and see live readings{view === 'schematic' ? ', or click a wire to inspect its net' : ''}.</p></div>)}
      <div className="visualization-section">
        <div className="section-eyebrow">Visualization</div>
        <div className="setting-row"><span className="setting-icon"><Activity size={16}/></span><span className="setting-copy">Current flow<small>{view === 'schematic' ? 'Moving dots and net voltages' : 'Voltage and current on every wire'}</small></span><Toggle label="Show current flow" checked={showFlow} onChange={setShowFlow}/></div>
        <div className="setting-row"><span className="setting-icon"><Lightbulb size={16}/></span><span className="setting-copy">Component effects<small>Light, motion, and sound</small></span><Toggle label="Show component effects" checked={showEffects} onChange={setShowEffects}/></div>
        <div className="setting-row"><span className="setting-icon"><Thermometer size={16}/></span><span className="setting-copy">Heat view<small>Where energy becomes warmth</small></span><Toggle label="Show heat view" checked={showHeat} onChange={setShowHeat}/></div>
        {tab === 'simulation' && <div className="flow-speed"><label htmlFor="flow-speed">Flow animation speed<span>{flowSpeed}×</span></label><input id="flow-speed" className="range" aria-label="Flow animation speed" type="range" min="0.5" max="2" step="0.5" value={flowSpeed} onChange={e => setFlowSpeed(Number(e.target.value))}/></div>}
        {mode === 'wire' && view === 'model' && <div className="color-picker"><label>New wire colour</label><div>{colors.map(color => <button key={color} aria-label={`New wire color ${color}`} style={{ background: color }} className={wireColor === color ? 'selected' : ''} onClick={() => setWireColor(color)}>{wireColor === color && <Check size={12}/>}</button>)}</div></div>}
      </div>
      {tab === 'simulation' && <div className="simulation-about">
        <h3><Waypoints size={15}/>About the model</h3>
        <p>Current solves the steady-state DC operating point with modified nodal analysis. Capacitors are open and inductors are low-resistance coils once settled. Diodes, LEDs, zeners, and transistors use piecewise-linear models.</p>
        <p>Wire voltages are measured from {result.voltageReference?.split(':')[1] === '0' && project.components.find(c => `${c.id}:0` === result.voltageReference)?.type === 'ground' ? 'ground' : 'the first source’s negative terminal'}. Heat, light, and sound effects are illustrative.</p>
        <button onClick={onDiagnostics}>View electrical diagnostics<ArrowUpRight size={14}/></button>
      </div>}
    </div>
  </aside>;
}
