import React, { useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Cpu, Download, FileUp, FolderOpen, ImageOff, Plus, Sparkles, Square, Thermometer, Upload, X } from 'lucide-react';
import { PARTS } from './parts.js';
import { PartThumbnail } from './PartGraphic.jsx';
import { TEMPLATES, templateProject } from './templates.js';

const GUIDE = [
  ['Pick your parts', 'Click or drag components from the library. Drag a placed part or its label to move it, or nudge it with the arrow keys.'],
  ['Connect the dots', 'Press W, then click two terminals or breadboard holes. Holes a–e and f–j connect within each column; power rails run the full row.'],
  ['Shape your wires', 'Drag a wire segment to move it, drag a round handle to reshape a bend, and double-click to add or remove bends.'],
  ['Switch views', 'Toggle between the realistic Model and a Schematic diagram with S. Both views edit the same circuit; schematic wiring is drawn from your connections.'],
  ['Bring in a diagram', 'Drop a KiCad, LTspice, Eagle, or SPICE file anywhere on the app to import it as a new project.'],
  ['Run it', 'Press Space to simulate. Double-click a switch to flip it, hold a push button, and select any part to see live readings.'],
];
const SHORTCUTS = [['V', 'Select'], ['W', 'Connect wire'], ['H', 'Pan'], ['S', 'Model / schematic'], ['R', 'Rotate'], ['Space', 'Run / stop'], ['⌘ Z', 'Undo'], ['⌘ S', 'Save'], ['Delete', 'Remove'], ['/', 'Search parts']];
export const FORMATS = [['KiCad schematic', '.kicad_sch'], ['KiCad netlist', '.net'], ['LTspice schematic', '.asc'], ['Eagle / Fusion schematic', '.sch'], ['SPICE netlist', '.cir · .sp · .net'], ['Current project', '.json']];
const TITLES = { guide: 'Quick guide', projects: 'Starter circuits', diagnostics: 'Circuit diagnostics', options: 'Circuit options', new: 'New circuit', import: 'Import a diagram' };

function ImportPanel({ state, onChoose, onFile }) {
  const [over, setOver] = useState(false);
  const report = state?.report;
  return <>
    <span className="modal-symbol"><FileUp size={22}/></span>
    <h2>{report ? 'Diagram imported' : 'Import a diagram'}</h2>
    <p className="modal-lead">{report ? <>Opened <strong>{report.fileName}</strong> ({report.format}) with {report.summary.parts} parts and {report.summary.nets} nets.</> : 'Turn an existing schematic or netlist into an editable, simulated project.'}</p>
    {state?.error && <div className="import-error" role="alert"><AlertTriangle size={17}/><div><strong>{state.fileName ? `Couldn’t import ${state.fileName}` : 'Couldn’t import that file'}</strong><p>{state.error}</p></div></div>}
    {report && <div className="import-report">
      {report.skipped.length > 0 && <section><h3>Not imported</h3><ul>{report.skipped.map((s, i) => <li key={i}><strong>{s.ref}</strong>{s.reason}</li>)}</ul></section>}
      {report.warnings.length > 0 && <section><h3>Notes</h3><ul>{report.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></section>}
    </div>}
    {!report && <button className={`dropzone ${over ? 'is-over' : ''}`} onClick={onChoose} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); e.stopPropagation(); setOver(false); onFile(e.dataTransfer.files[0]); }}>
      <Upload size={26}/><strong>Drop a file here</strong><span>or click to choose one</span>
    </button>}
    {!report && <div className="format-list">{FORMATS.map(([name, ext]) => <div key={name}><span>{name}</span><code>{ext}</code></div>)}</div>}
    {!report && <p className="modal-footnote"><ImageOff size={14}/>Photos, screenshots, and PDFs of schematics can’t be read. Export the design file from your EDA tool instead.</p>}
    {report && <button className="button primary modal-primary" onClick={onChoose}>Import another file</button>}
  </>;
}

export default function Modals({ modal, modalRef, close, setModal, running, result, project, designators, importState, actions }) {
  if (!modal) return null;
  return <div className="modal-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div ref={modalRef} className={`modal modal-${modal}`} role="dialog" aria-modal="true" aria-label={TITLES[modal]}>
      <button className="modal-close icon-button" autoFocus aria-label="Close dialog" onClick={close}><X size={18}/></button>
      {modal === 'guide' && <>
        <span className="modal-symbol"><BookOpen size={22}/></span>
        <h2>Quick guide</h2>
        <p className="modal-lead">Build, connect, and simulate circuits right in your browser.</p>
        <ol className="guide-steps">{GUIDE.map(([title, text], i) => <li key={title}><span>{String(i + 1).padStart(2, '0')}</span><section><h3>{title}</h3><p>{text}</p></section></li>)}</ol>
        <div className="shortcut-grid">{SHORTCUTS.map(([key, label]) => <div key={key}><span>{label}</span><kbd>{key}</kbd></div>)}</div>
        <button className="button primary modal-primary" onClick={close}>Start building<ArrowRight size={16}/></button>
      </>}
      {modal === 'projects' && <>
        <span className="modal-symbol"><Sparkles size={22}/></span>
        <h2>Starter circuits</h2>
        <p className="modal-lead">Ready-made circuits to explore, tweak, and take apart.</p>
        <div className="template-grid">{TEMPLATES.map(t => <button className="template-card" key={t.kind} onClick={() => actions.template(t.kind)}>
          <div className={`template-art art-${t.type}`}><PartThumbnail type={t.type} large/></div>
          <h3>{t.name}<ArrowUpRight size={15}/></h3><p>{t.description}</p>
          <span>{templateProject(t.kind).components.length} components<span>{t.level}</span></span>
        </button>)}</div>
        <button className="start-blank" onClick={() => setModal('new')}><Plus size={16}/>Or start with a blank canvas<ArrowRight size={15}/></button>
        <p className="modal-footnote">Your current circuit stays in undo history.</p>
      </>}
      {modal === 'options' && <>
        <h2>Circuit options</h2>
        <div className="options-list">
          <button onClick={() => { close(); actions.save(); }}><FolderOpen size={19}/><span><strong>Save circuit</strong><small>Keep a copy in this browser</small></span><ChevronRight size={16}/></button>
          <button onClick={actions.export}><Download size={19}/><span><strong>Export circuit</strong><small>Download an editable JSON file</small></span><ChevronRight size={16}/></button>
          <button onClick={() => setModal('import')}><Upload size={19}/><span><strong>Import circuit</strong><small>KiCad, LTspice, Eagle, SPICE, or JSON</small></span><ChevronRight size={16}/></button>
          <button onClick={() => setModal('projects')}><Sparkles size={19}/><span><strong>Explore starter circuits</strong><small>Ready-made circuits to learn from</small></span><ChevronRight size={16}/></button>
          <button onClick={() => setModal('new')}><Plus size={19}/><span><strong>New circuit</strong><small>Start from an empty canvas</small></span><ChevronRight size={16}/></button>
        </div>
      </>}
      {modal === 'new' && <>
        <span className="modal-symbol"><Plus size={22}/></span>
        <h2>New circuit</h2>
        <p className="modal-lead">Choose a starting point. Your current circuit stays in undo history.</p>
        <div className="new-options">
          <button onClick={() => actions.load({ name: 'Untitled circuit', components: [], wires: [] })}><Square size={26}/><h3>Blank canvas</h3><p>Start from scratch.</p></button>
          <button onClick={() => actions.load({ name: 'Untitled circuit', components: [{ id: 'board1', type: 'breadboard', x: 572, y: 335, rotation: 0, value: 30 }], wires: [] })}><Cpu size={26}/><h3>With a breadboard</h3><p>A board ready for parts.</p></button>
        </div>
        <button className="button outline modal-primary" onClick={actions.save}><FolderOpen size={16}/>Save current circuit first</button>
      </>}
      {modal === 'import' && <ImportPanel state={importState} onChoose={actions.chooseFile} onFile={actions.importFile}/>}
      {modal === 'diagnostics' && <>
        <span className="modal-symbol"><Activity size={22}/></span>
        <h2>Circuit diagnostics</h2>
        <p className="modal-lead">{running ? 'Live steady-state readings.' : 'Calculated DC preview. Run the simulation for live effects.'}</p>
        <div className={`diagnostic-health ${result.warnings.length ? 'warning' : ''}`}>{result.warnings.length ? <AlertTriangle size={17}/> : <Check size={17}/>}{result.warnings.length ? 'Your circuit needs attention.' : result.closed ? 'A complete circuit, ready to run.' : 'No current is flowing yet.'}</div>
        {result.warnings.map(w => <p className="diagnostic-warning" key={w}><Thermometer size={15}/>{w}</p>)}
        <div className="diagnostics-table"><table><thead><tr><th>Part</th><th>Voltage</th><th>Current</th><th>Power</th></tr></thead><tbody>{project.components.filter(c => c.type !== 'breadboard' && c.type !== 'ground').map(c => <tr key={c.id}><td><strong>{c.label || designators[c.id]}</strong> {PARTS[c.type].name}</td><td>{Math.abs(result.readings[c.id]?.voltage || 0).toFixed(2)} V</td><td>{(Math.abs(result.readings[c.id]?.current || 0) * 1000).toFixed(2)} mA</td><td>{((result.readings[c.id]?.power || 0) * 1000).toFixed(1)} mW</td></tr>)}</tbody></table></div>
        <p className="model-note">DC model: sources include internal resistance; diodes, LEDs, zeners, and transistors are piecewise linear; capacitors show their charged state. Animation dots represent conventional current.</p>
        <button className="button primary modal-primary" onClick={() => { close(); if (!running) actions.run(); }}>{running ? 'Back to the workbench' : 'Run this circuit'}<ArrowRight size={16}/></button>
      </>}
    </div>
  </div>;
}
