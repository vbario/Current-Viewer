import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Copy, Cpu, Download, Expand, Eye, FolderOpen, Hand, Lightbulb, Minus, MoreHorizontal, MousePointer2, MoveUpRight, Pencil, Play, Plus, Redo2, RotateCw, Search, Settings2, SlidersHorizontal, Sparkles, Square, Thermometer, Trash2, Undo2, Upload, X, Zap } from 'lucide-react';
import { PARTS, endpointPosition, initialProject, simulate, terminalPosition } from './circuit.js';
import { GraphicDefs, PartGraphic, PartThumbnail } from './PartGraphic.jsx';
import { insertBend, moveSegment, nearestSegment, wirePoints } from './wireGeometry.js';
import WireReadouts, { formatWireCurrent, formatWireVoltage } from './WireReadouts.jsx';

const STORAGE = 'current-workbench-v1';
const LED_COLORS = { '#e95f49': 'Red', '#dbaa36': 'Amber', '#82b94d': 'Green', '#5c94c5': 'Blue', '#b17aca': 'Violet' };
const COLORS = ['#dc6a52', '#d5a143', '#78977b', '#687b8d', '#9f85b6', '#424b43'];
const clone = value => JSON.parse(JSON.stringify(value));
const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
function validProject(p) {
  return p && typeof p.name === 'string' && Array.isArray(p.components) && p.components.length <= 150 && Array.isArray(p.wires) && p.wires.length <= 500 && new Set(p.components.map(c => c.id)).size === p.components.length && p.components.every(c => PARTS[c.type] && typeof c.id === 'string' && [c.x, c.y, c.value, c.rotation || 0].every(Number.isFinite) && c.value >= 0) && p.wires.every(w => typeof w.id === 'string' && typeof w.color === 'string' && [w.from, w.to].every(ep => {
    if (typeof ep !== 'string') return false;
    const [id, pin, col] = ep.split(':'); const c = p.components.find(c => c.id === id);
    return c && (c.type === 'breadboard' ? ['topPlus', 'topMinus', 'bottomPlus', 'bottomMinus', ...'abcdefghij'].includes(pin) && Number.isInteger(Number(col)) && Number(col) >= 0 && Number(col) < 30 : ['0', '1'].includes(pin) && col === undefined);
  }) && (!w.via || Array.isArray(w.via) && w.via.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))));
}
function loadProject() { try { const p = JSON.parse(localStorage.getItem(STORAGE)); return validProject(p) ? p : initialProject(); } catch { return initialProject(); } }
function readSaved() { try { return JSON.parse(localStorage.getItem(`${STORAGE}-saved`)) || []; } catch { return []; } }
function roundedPath(points, radius = 12) {
  const p = points.filter((point, i) => !i || Math.hypot(point.x - points[i - 1].x, point.y - points[i - 1].y) > .5);
  if (!p.length) return '';
  let d = `M${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const prev = p[i - 1], at = p[i], next = p[i + 1];
    const r = Math.min(radius, Math.hypot(at.x - prev.x, at.y - prev.y) / 2, Math.hypot(next.x - at.x, next.y - at.y) / 2);
    const da = Math.hypot(at.x - prev.x, at.y - prev.y), db = Math.hypot(next.x - at.x, next.y - at.y);
    const before = { x: at.x - (at.x - prev.x) / da * r, y: at.y - (at.y - prev.y) / da * r };
    const after = { x: at.x + (next.x - at.x) / db * r, y: at.y + (next.y - at.y) / db * r };
    d += ` L${before.x} ${before.y} Q${at.x} ${at.y} ${after.x} ${after.y}`;
  }
  const last = p.at(-1); return d + ` L${last.x} ${last.y}`;
}
function wirePath(w, components) {
  return roundedPath(wirePoints(w, components));
}
function Toggle({ checked, onChange, label }) { return <button type="button" className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span/></button>; }
function ToolButton({ children, label, active, onClick, disabled, className = '' }) { return <button type="button" title={label} aria-label={label} className={`icon-button ${active ? 'active' : ''} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>; }

export default function App() {
  const [project, setProject] = useState(loadProject);
  const projectRef = useRef(project); projectRef.current = project;
  const [selected, setSelected] = useState('r1');
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState('select');
  const [dragging, setDragging] = useState(false);
  const [showFlow, setShowFlow] = useState(true);
  const [showEffects, setShowEffects] = useState(true);
  const [showHeat, setShowHeat] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [flowSpeed, setFlowSpeed] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [libraryTab, setLibraryTab] = useState('components');
  const [inspectorTab, setInspectorTab] = useState('properties');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [wireStart, setWireStart] = useState(null);
  const [wireColor, setWireColor] = useState(COLORS[0]);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]), [future, setFuture] = useState([]);
  const [modal, setModal] = useState(null);
  const [saved, setSaved] = useState(readSaved);
  const [toast, setToast] = useState(null);
  const [saveStatus, setSaveStatus] = useState('All changes saved');
  const [renaming, setRenaming] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [showReadings, setShowReadings] = useState(true);
  const [mobilePanel, setMobilePanel] = useState(null);
  const searchRef = useRef(null), modalRef = useRef(null), lastClickRef = useRef(null);
  const svgRef = useRef(null), sceneRef = useRef(null), dragRef = useRef(null), importRef = useRef(null), toastTimer = useRef(null);
  const result = useMemo(() => simulate(project.components, project.wires), [project.components, project.wires]);
  const component = project.components.find(c => c.id === selected);
  const selectedWire = project.wires.find(w => w.id === selected);
  const selectedWirePoints = selectedWire ? wirePoints(selectedWire, project.components) : [];
  const referenceBattery = project.components.find(c => `${c.id}:1` === result.voltageReference);
  const voltageReferenceName = referenceBattery?.label || 'Battery';
  const reading = component && result.readings[component.id];
  const part = component && PARTS[component.type];
  const connected = running && result.closed;
  const componentCount = project.components.length;
  const alert = useCallback(message => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 3500); }, []);

  const remember = useCallback(p => { setHistory(h => [...h.slice(-39), clone(p)]); setFuture([]); }, []);
  const update = useCallback(change => { remember(projectRef.current); setProject(p => typeof change === 'function' ? change(p) : change); }, [remember]);
  const patchComponent = (key, value) => update(p => ({ ...p, components: p.components.map(c => c.id === selected ? { ...c, [key]: value } : c) }));
  const undo = useCallback(() => { if (!history.length) return; const current = clone(projectRef.current); setFuture(f => [current, ...f]); setProject(history.at(-1)); setHistory(h => h.slice(0, -1)); }, [history]);
  const redo = useCallback(() => { if (!future.length) return; const current = clone(projectRef.current); setHistory(h => [...h, current]); setProject(future[0]); setFuture(f => f.slice(1)); }, [future]);

  useEffect(() => {
    setSaveStatus('Saving changes…');
    const timer = setTimeout(() => { try { localStorage.setItem(STORAGE, JSON.stringify(project)); setSaveStatus('All changes saved'); } catch { setSaveStatus('Storage full · export to save'); } }, 600);
    return () => clearTimeout(timer);
  }, [project]);
  useEffect(() => { setEditingLabel(false); }, [selected]);
  useEffect(() => { if (!running) return; const timer = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(timer); }, [running]);

  const toggleSimulation = useCallback(() => { setRunning(r => !r); if (!running) setSeconds(0); }, [running]);
  const deleteSelected = useCallback(() => {
    if (!selected) return;
    update(p => ({ ...p, components: p.components.filter(c => c.id !== selected), wires: p.wires.filter(w => w.id !== selected && ![w.from, w.to].some(ep => ep.split(':')[0] === selected)) }));
    setSelected(null); setWireStart(null); alert('Removed from your circuit');
  }, [selected, update, alert]);
  const rotateSelected = useCallback(() => {
    if (!component || component.type === 'breadboard') return;
    update(p => ({ ...p, components: p.components.map(c => c.id === selected ? { ...c, rotation: ((c.rotation || 0) + 90) % 360 } : c) }));
  }, [component, selected, update]);
  const duplicateSelected = () => {
    if (!component) return;
    const id = uid(component.type); update(p => ({ ...p, components: [...p.components, { ...component, id, x: component.x + 50, y: component.y + 80 }] })); setSelected(id); alert(`${part.name} duplicated`);
  };
  const saveCircuit = useCallback(() => {
    const entry = { ...clone(projectRef.current), savedAt: new Date().toISOString(), saveId: uid('save') };
    try { const next = [entry, ...readSaved()].slice(0, 15); localStorage.setItem(`${STORAGE}-saved`, JSON.stringify(next)); setSaved(next); alert('Circuit saved to My circuits'); } catch { alert('Storage is full. Export your circuit to keep a copy.'); }
  }, [alert]);

  useEffect(() => {
    const keydown = e => {
      if (e.key === 'Escape') {
        const drag = dragRef.current;
        if (drag?.snapshot) setProject(drag.snapshot);
        if (drag?.type === 'pan') setPan({ x: drag.originalX, y: drag.originalY });
        dragRef.current = null; setDragging(false);
        if (drag && svgRef.current?.hasPointerCapture(drag.pointerId)) svgRef.current.releasePointerCapture(drag.pointerId);
        setWireStart(null); setMode('select'); setModal(null); setMobilePanel(null); return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
      if (dragRef.current) return;
      if (modal) {
        if (e.key === 'Tab') {
          const items = [...modalRef.current.querySelectorAll('button:not(:disabled), input, a[href], [tabindex="0"]')];
          const first = items[0], last = items.at(-1);
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
        return;
      }
      if (e.key === '/') { e.preventDefault(); setLibraryTab('components'); setMobilePanel('library'); setTimeout(() => searchRef.current?.focus(), 0); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveCircuit(); }
      else if (e.code === 'Space') { e.preventDefault(); toggleSimulation(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      else if (e.key.toLowerCase() === 'r') rotateSelected();
      else if (e.key.toLowerCase() === 'v') { setMode('select'); setWireStart(null); }
      else if (e.key.toLowerCase() === 'w') setMode('wire');
      else if (e.key.toLowerCase() === 'h') { setMode('pan'); setWireStart(null); }
      else if (component && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault(); const step = e.shiftKey ? 20 : 4;
        const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
        const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
        update(p => ({ ...p, components: p.components.map(c => c.id === selected ? { ...c, x: c.x + dx, y: c.y + dy } : c) }));
      }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [modal, undo, redo, saveCircuit, toggleSimulation, deleteSelected, rotateSelected, component, selected, update]);

  const stagePoint = e => {
    if (!svgRef.current || !sceneRef.current) return { x: 525, y: 335 };
    const pt = svgRef.current.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(sceneRef.current.getScreenCTM().inverse());
  };
  const addPart = (type, point) => {
    const id = uid(type), count = project.components.filter(c => c.type !== 'breadboard').length;
    const position = point || { x: 360 + (count % 6) * 86, y: 570 + Math.floor((count % 12) / 6) * 65 };
    const c = { ...PARTS[type], id, type, x: position.x, y: position.y, rotation: 0 };
    update(p => ({ ...p, components: [...p.components, c] })); setSelected(id); setMode('select'); setInspectorTab('properties');
    alert(`${PARTS[type].name} added · drag to position`); setMobilePanel(null);
  };
  const connect = endpoint => {
    if (!wireStart) { setWireStart(endpoint); setMode('wire'); const pos = endpointPosition(endpoint, project.components); setPointer(pos); return; }
    if (wireStart === endpoint) { setWireStart(null); return; }
    if (project.wires.some(w => (w.from === wireStart && w.to === endpoint) || (w.to === wireStart && w.from === endpoint))) { alert('These terminals are already connected'); setWireStart(null); return; }
    const id = uid('wire'); update(p => ({ ...p, wires: [...p.wires, { id, from: wireStart, to: endpoint, color: wireColor }] })); setWireStart(null); setSelected(id); setMode('select'); alert('Wire connected · drag the wire or its handles to shape it');
  };
  const startPan = e => {
    if (e.button !== 0 || dragRef.current) return;
    e.preventDefault(); e.stopPropagation();
    document.activeElement?.blur();
    dragRef.current = { type: 'pan', pointerId: e.pointerId, x: e.clientX, y: e.clientY, originalX: pan.x, originalY: pan.y };
    svgRef.current.setPointerCapture(e.pointerId); setDragging(true);
  };
  const beginDrag = (e, c) => {
    if (e.button !== 0 || dragRef.current) return;
    if (mode === 'pan') { startPan(e); return; }
    e.preventDefault(); e.stopPropagation(); setMode('select'); setWireStart(null);
    document.activeElement?.blur();
    const point = stagePoint(e); setSelected(c.id); setInspectorTab('properties');
    dragRef.current = { type: 'component', pointerId: e.pointerId, id: c.id, x: point.x, y: point.y, originalX: c.x, originalY: c.y, snapshot: clone(projectRef.current), moved: false };
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const editWire = (id, via) => update(p => ({ ...p, wires: p.wires.map(w => w.id === id ? { ...w, via } : w) }));
  const addWireBend = (w, point) => {
    const points = wirePoints(w, projectRef.current.components);
    if (!point) {
      const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
      const i = lengths.indexOf(Math.max(...lengths));
      point = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    }
    editWire(w.id, insertBend(points, point));
  };
  const removeWireBend = (w, index) => editWire(w.id, wirePoints(w, projectRef.current.components).slice(1, -1).filter((_, i) => i !== index));
  const beginWireDrag = (e, w, kind = 'segment', index) => {
    if (e.button !== 0 || dragRef.current) return;
    if (mode === 'pan') { startPan(e); return; }
    e.preventDefault(); e.stopPropagation(); setMode('select'); setWireStart(null); setSelected(w.id); setInspectorTab('properties');
    document.activeElement?.blur();
    const p = stagePoint(e), points = wirePoints(w, projectRef.current.components);
    dragRef.current = { type: `wire-${kind}`, pointerId: e.pointerId, id: w.id, index: index ?? nearestSegment(points, p).index, x: p.x, y: p.y, points, snapshot: clone(projectRef.current), moved: false };
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const bendKeyDown = (e, w, index) => {
    if (['Delete', 'Backspace'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); removeWireBend(w, index); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation(); const step = e.shiftKey ? 20 : 4;
      const via = wirePoints(w, projectRef.current.components).slice(1, -1);
      via[index] = { x: via[index].x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), y: via[index].y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0) };
      editWire(w.id, via);
    }
  };
  const movePointer = e => {
    const p = stagePoint(e); if (wireStart) setPointer(p);
    const drag = dragRef.current; if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.type === 'pan') {
      const scale = svgRef.current.getScreenCTM().a;
      setPan({ x: drag.originalX + (e.clientX - drag.x) / scale, y: drag.originalY + (e.clientY - drag.y) / scale }); return;
    }
    const dx = p.x - drag.x, dy = p.y - drag.y;
    if (Math.hypot(dx, dy) * sceneRef.current.getScreenCTM().a > 3) { drag.moved = true; setDragging(true); }
    if (!drag.moved) return;
    if (drag.type === 'component') {
      setProject(current => ({ ...current, components: current.components.map(c => c.id === drag.id ? { ...c, x: drag.originalX + Math.round(dx / 4) * 4, y: drag.originalY + Math.round(dy / 4) * 4 } : c) }));
    } else {
      const sx = Math.round(dx / 4) * 4, sy = Math.round(dy / 4) * 4;
      let via;
      if (drag.type === 'wire-bend') {
        via = drag.points.slice(1, -1).map(p => ({ ...p }));
        via[drag.index] = { x: via[drag.index].x + sx, y: via[drag.index].y + sy };
      } else via = moveSegment(drag.points, drag.index, sx, sy);
      setProject(current => ({ ...current, wires: current.wires.map(w => w.id === drag.id ? { ...w, via } : w) }));
    }
  };
  const endDrag = e => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.type === 'pointercancel') {
      if (drag.snapshot) setProject(drag.snapshot);
      if (drag.type === 'pan') setPan({ x: drag.originalX, y: drag.originalY });
    } else if (drag.moved && drag.snapshot) { remember(drag.snapshot); lastClickRef.current = null; }
    else if (!drag.moved && drag.type !== 'pan') {
      const now = Date.now();
      const key = `${drag.type}:${drag.id}:${drag.type === 'wire-bend' ? drag.index : ''}`;
      if (lastClickRef.current?.key === key && now - lastClickRef.current.time < 400) {
        if (drag.type === 'component' && projectRef.current.components.find(c => c.id === drag.id)?.type === 'switch') {
          update(p => ({ ...p, components: p.components.map(c => c.id === drag.id ? { ...c, value: c.value ? 0 : 1 } : c) }));
        } else if (drag.type.startsWith('wire-')) {
          const w = projectRef.current.wires.find(w => w.id === drag.id);
          if (drag.type === 'wire-bend') removeWireBend(w, drag.index);
          else addWireBend(w, { x: drag.x, y: drag.y });
        }
        lastClickRef.current = null;
      } else lastClickRef.current = { key, time: now };
    }
    dragRef.current = null; setDragging(false);
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
  };
  const loadCircuit = p => { update({ name: p.name, components: clone(p.components), wires: clone(p.wires) }); setSelected(p.components.find(c => c.type === 'resistor')?.id || null); setRunning(false); setWireStart(null); setZoom(1); setPan({ x: 0, y: 0 }); setModal(null); setLibraryTab('components'); alert('Circuit opened'); };
  const exportCircuit = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'circuit'}.json`; a.click(); URL.revokeObjectURL(url); alert('Circuit exported');
  };
  const importCircuit = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try { if (file.size > 2000000) throw new Error(); const p = JSON.parse(await file.text()); if (!validProject(p)) throw new Error(); loadCircuit(p); alert('Circuit imported'); } catch { alert('This file isn’t a valid circuit. Choose a Current JSON export.'); } e.target.value = '';
  };
  const template = kind => {
    const p = initialProject();
    if (kind === 'lamp') { p.name = 'A bright idea'; p.components = p.components.filter(c => c.id !== 'r1').map(c => c.id === 'led1' ? { ...c, type: 'lamp', value: 100, y: 270 } : c); p.wires = p.wires.filter(w => !['w2', 'w3'].includes(w.id)); p.wires.push({ id: 'w5', from: 'sw1:1', to: 'led1:0', color: '#d5a143' }); }
    if (kind === 'motor') { p.name = 'Make it move'; p.components = p.components.filter(c => c.id !== 'r1').map(c => c.id === 'led1' ? { ...c, type: 'motor', value: 60, y: 290 } : c); p.wires = p.wires.filter(w => !['w2', 'w3'].includes(w.id)); p.wires.push({ id: 'w5', from: 'sw1:1', to: 'led1:0', color: '#78977b' }); }
    loadCircuit(p);
  };

  const filteredParts = Object.entries(PARTS).filter(([_, p]) => (category === 'All' || p.category === category) && `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()));
  const primaryCurrent = running ? result.current * 1000 : 0;

  return <div className="app-shell">
    <svg width="0" height="0" className="global-defs" aria-hidden="true"><GraphicDefs/></svg>
    <header className="app-header">
      <a href="#" className="brand" onClick={e => { e.preventDefault(); setModal('projects'); }} aria-label="Current home"><span className="brand-mark"><Zap size={23} fill="currentColor" strokeWidth={1.8}/></span><span>current<span className="brand-period">.</span></span></a>
      <div className="header-divider"/>
      <div className="project-title">
        {renaming ? <input aria-label="Circuit name" className="name-input" value={project.name} autoFocus onChange={e => setProject(p => ({ ...p, name: e.target.value }))} onBlur={() => { setRenaming(false); if (!project.name.trim()) setProject(p => ({ ...p, name: 'Untitled circuit' })); }} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}/>
          : <button className="name-button" onClick={() => setRenaming(true)}>{project.name}<ChevronDown size={14}/></button>}
        <span className="save-status"><CheckCheck size={13}/>{saveStatus}</span>
      </div>
      <div className="header-actions">
        <div className="history-actions"><ToolButton label="Undo (⌘Z)" onClick={undo} disabled={!history.length}><Undo2 size={17}/></ToolButton><ToolButton label="Redo (⌘⇧Z)" onClick={redo} disabled={!future.length}><Redo2 size={17}/></ToolButton></div>
        <button className="button quiet guide-button" onClick={() => setModal('guide')}><BookOpen size={16}/>Quick guide</button>
        <button className="button outline save-button" onClick={saveCircuit}><FolderOpen size={16}/>Save circuit</button>
        <button className={`button run-button ${running ? 'running' : ''}`} onClick={toggleSimulation}>{running ? <Square size={14} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}<span>{running ? 'Stop simulation' : 'Run simulation'}</span><span className="shortcut">␣</span></button>
        <button className="avatar" title="Your saved circuits" onClick={() => { setLibraryTab('circuits'); setMobilePanel('library'); }}>Y</button>
      </div>
    </header>

    <main className="workbench">
      <aside className={`library-panel ${mobilePanel === 'library' ? 'mobile-open' : ''}`}>
        <div className="panel-tabs"><button className={libraryTab === 'components' ? 'selected' : ''} onClick={() => setLibraryTab('components')}>Components</button><button className={libraryTab === 'circuits' ? 'selected' : ''} onClick={() => setLibraryTab('circuits')}>My circuits<span className="count">{saved.length}</span></button></div>
        {libraryTab === 'components' ? <>
          <div className="library-intro"><h2>Small parts. Big possibilities.</h2><p>Drag a component onto your canvas.</p></div>
          <label className="search-field"><Search size={16}/><input ref={searchRef} placeholder="Find a component…" value={search} onChange={e => setSearch(e.target.value)}/><kbd>/</kbd></label>
          <div className="category-filters">{['All', 'Basics', 'Power', 'Output'].map(c => <button key={c} onClick={() => setCategory(c)} className={category === c ? 'selected' : ''}>{c}</button>)}</div>
          <div className="parts-heading"><span>{search ? 'SEARCH RESULTS' : category === 'All' ? 'THE ESSENTIALS' : category.toUpperCase()}<span className="small-count">{filteredParts.length}</span></span><SlidersHorizontal size={13}/></div>
          <div className="parts-grid">{filteredParts.map(([type, p]) => <button key={type} className={`part-card part-${type}`} onClick={() => addPart(type)} draggable onDragStart={e => { e.dataTransfer.setData('application/current-part', type); e.dataTransfer.effectAllowed = 'copy'; }} title={`${p.description}. Click or drag to add.`}><span className="add-part"><Plus size={12}/></span><PartThumbnail type={type}/><span className="part-name">{p.name}</span><span className="part-subtitle">{type === 'breadboard' ? '30 columns' : type === 'switch' ? 'On / off' : type === 'led' ? 'Red · 2 V' : `${p.value} ${p.unit}`}</span></button>)}</div>
          {!filteredParts.length && <div className="empty-library"><Search size={24}/><p>No components found.</p><button onClick={() => { setSearch(''); setCategory('All'); }}>Clear filters</button></div>}
          <button className="wire-library-button" onClick={() => { setMode('wire'); alert('Click a component terminal or breadboard hole to start a wire'); }}><span className="wire-sample"><svg viewBox="0 0 34 24"><path d="M2 20V10q0-6 6-6h18q6 0 6 6v10" fill="none" stroke="#78977b" strokeWidth="3"/><circle cx="2" cy="20" r="2" fill="#58644d"/><circle cx="32" cy="20" r="2" fill="#58644d"/></svg></span><span>Connect with a wire<small>Click two terminals to connect</small></span><kbd>W</kbd></button>
        </> : <div className="saved-library"><div className="saved-heading"><h2>Your little inventions</h2><button className="icon-button" aria-label="New circuit" onClick={() => setModal('new')}><Plus size={17}/></button></div><p>Saved in this browser, ready when you are.</p>{saved.length ? saved.map(p => <button className="saved-circuit" key={p.saveId} onClick={() => loadCircuit(p)}><span className="saved-circuit-icon"><Cpu size={23}/></span><span><strong>{p.name}</strong><small>{p.components.length} parts · {new Date(p.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></span><ChevronRight size={15}/></button>) : <div className="saved-empty"><FolderOpen size={30}/><h3>A home for your ideas</h3><p>Save your first circuit and it will show up here.</p><button className="button outline" onClick={saveCircuit}>Save this circuit</button></div>}<button className="button outline import-button" onClick={() => importRef.current.click()}><Upload size={15}/>Import a circuit</button></div>}
        <div className="library-bottom"><div className="idea-card"><span className="idea-icon"><Sparkles size={18}/></span><h3>A little spark of inspiration</h3><p>Every bright idea starts with<br/>a simple connection.</p><button onClick={() => setModal('projects')}>Explore starter circuits<ArrowUpRight size={15}/></button></div><button className="help-link" onClick={() => setModal('guide')}><CircleHelp size={15}/>A hand getting started?<ArrowUpRight size={13}/></button></div>
      </aside>

      <section className="canvas-area">
        <div className="canvas-header"><div className="canvas-title"><span className="workspace-label">WORKSPACE</span><span className="workspace-name"><span className="status-dot"/>Circuit playground</span></div><div className="canvas-header-right"><span className="component-total">{componentCount} components<span>·</span>{project.wires.length} wires</span><ToolButton label="More circuit options" onClick={() => setModal('options')}><MoreHorizontal size={20}/></ToolButton></div></div>
        <div className="mobile-actions"><button onClick={() => setMobilePanel(mobilePanel === 'library' ? null : 'library')}><Plus size={15}/>Components</button><button onClick={() => setMobilePanel(mobilePanel === 'inspector' ? null : 'inspector')}><Settings2 size={15}/>Properties</button></div>
        <div className="canvas-top-info"><div className={`simulation-chip ${running ? 'is-running' : ''}`}><span className="status-dot"/>{running ? 'Simulation is running' : 'Ready when you are'}{running && <span className="elapsed">{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</span>}</div><button className="view-chip" onClick={() => setShowLabels(l => !l)}><Eye size={14}/><span>{showLabels ? 'Labels on' : 'Labels off'}</span></button>{running && showFlow && project.wires.length > 0 && <span className="wire-reference-note">{referenceBattery ? <>Wire voltage reference: <strong>{voltageReferenceName} − = 0 V</strong></> : 'Add a battery to measure wire voltage.'}</span>}</div>
        <svg ref={svgRef} className={`circuit-canvas mode-${mode} ${dragging ? 'is-dragging' : ''}`} viewBox="0 100 1050 530" aria-label="Interactive circuit breadboard canvas" onPointerMove={movePointer} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerDown={e => { if (e.button !== 0) return; if (mode === 'pan') { startPan(e); } else if (e.target === svgRef.current || e.target.classList.contains('canvas-hit')) { setSelected(null); if (wireStart) { setWireStart(null); } } }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const type = e.dataTransfer.getData('application/current-part'); if (PARTS[type]) addPart(type, stagePoint(e)); }}>
          <rect y="100" width="1050" height="530" fill="transparent" className="canvas-hit"/>
          <g ref={sceneRef} transform={`translate(${pan.x},${pan.y}) translate(525,355) scale(${zoom}) translate(-525,-355)`}>
            {project.components.filter(c => c.type === 'breadboard').map(c => <g key={c.id} transform={`translate(${c.x},${c.y})`} onPointerDown={e => beginDrag(e, c)} className="canvas-component" data-component={c.id}>
              {selected === c.id && <rect x="-335" y="-177" width="670" height="352" rx="15" fill="none" stroke="#98b363" strokeWidth="1.5" strokeDasharray="5 4"/>}
              <PartGraphic type="breadboard" id={c.id} onTerminal={connect} wireMode={mode === 'wire'}/>
              {showLabels && <g transform="translate(0,196)"><text className="part-label" textAnchor="middle">Breadboard <tspan fill="#a3aa9b">· 30 columns</tspan></text></g>}
            </g>)}
            {project.wires.map(w => { const d = wirePath(w, project.components); const current = result.wireCurrents[w.id] || 0; return <g key={w.id} className="circuit-wire" data-wire={w.id} onPointerDown={e => beginWireDrag(e, w)}>
              <title>{running ? `${formatWireVoltage(result.wireVoltages[w.id])} relative to ${voltageReferenceName} (−), ${formatWireCurrent(result.wireCurrents[w.id])}. ` : ''}Drag to reposition this wire. Double-click to add a bend.</title>
              <path d={d} stroke="transparent" strokeWidth="18" fill="none"/>
              {selected === w.id && <path d={d} stroke="#bfdc8b" strokeWidth="11" opacity=".45" fill="none"/>}
              <path d={d} transform="translate(0 3)" stroke="#39432c" strokeOpacity=".12" strokeWidth="6" fill="none" strokeLinecap="round"/>
              <path d={d} stroke={w.color} strokeWidth="5" fill="none" strokeLinecap="round"/>
              <path d={d} stroke="white" strokeOpacity=".14" strokeWidth="1.5" fill="none" transform="translate(0 -1)"/>
              {running && showFlow && Math.abs(current) > .00001 && <path d={d} className="current-flow" style={{ animationDuration: `${1.5 / flowSpeed}s`, animationDirection: current >= 0 ? 'normal' : 'reverse' }} stroke="#f1ffd3" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 19" fill="none"/>}
            </g>; })}
            {project.components.filter(c => c.type !== 'breadboard').map(c => {
              const active = running && result.readings[c.id]?.active; const selectedPart = c.id === selected;
              return <g key={c.id} className={`canvas-component ${selectedPart ? 'is-selected' : ''}`} data-component={c.id}>
                <g transform={`translate(${c.x},${c.y}) rotate(${c.rotation || 0})`} onPointerDown={e => beginDrag(e, c)}>
                  {selectedPart && <rect x={c.type === 'battery' ? -63 : -67} y={c.type === 'battery' ? -85 : c.type === 'resistor' ? -25 : -57} width={c.type === 'battery' ? 128 : 134} height={c.type === 'battery' ? 185 : c.type === 'resistor' ? 50 : 107} rx="9" fill="#c5df9833" stroke="#9ab96e" strokeWidth="1.2" strokeDasharray="4 3"/>}
                  <PartGraphic type={c.type} active={active} intensity={Math.abs(result.readings[c.id]?.current || 0) / (c.type === 'led' ? .02 : .08)} effects={showEffects} heat={showHeat && (result.readings[c.id]?.power || 0) > .02} value={c.value} color={c.color}/>
                </g>
                {[0, 1].map(pin => { const pos = terminalPosition(c, pin); return <g key={pin} data-terminal={`${c.id}:${pin}`} className={`terminal ${wireStart === `${c.id}:${pin}` ? 'terminal-selected' : ''}`} onPointerDown={e => { if (mode === 'pan') { startPan(e); return; } e.stopPropagation(); connect(`${c.id}:${pin}`); }}><circle cx={pos.x} cy={pos.y} r="10" fill="transparent"/><circle cx={pos.x} cy={pos.y} r="4.2" fill={wireStart === `${c.id}:${pin}` ? '#c5ec5b' : '#dfe3d8'} stroke="#7c8873" strokeWidth="1.5"/><circle cx={pos.x} cy={pos.y} r="1.7" fill="#7e8c74"/><title>{`${PARTS[c.type].name} ${pin === 0 ? (['battery', 'led'].includes(c.type) ? 'positive / anode (+)' : 'terminal 1') : (['battery', 'led'].includes(c.type) ? 'negative / cathode (−)' : 'terminal 2')} — click to wire`}</title></g>; })}
                {showLabels && <g transform={`translate(${c.x},${c.y + (c.type === 'battery' ? 111 : c.type === 'resistor' ? -42 : c.type === 'led' ? -67 : c.type === 'switch' ? 43 : -70)})`} className="canvas-component-label" onPointerDown={e => beginDrag(e, c)}>
                  <rect x="-63" y="-15" width="126" height="24" rx="6" fill={selectedPart ? '#edf2e2' : '#f9faf5'} fillOpacity=".95"/>
                  <text textAnchor="middle" className={`part-label ${selectedPart ? 'selected' : ''}`}>{c.label || (c.type === 'resistor' ? `R${project.components.filter(p => p.type === 'resistor').indexOf(c) + 1}` : PARTS[c.type].name)}<tspan className="part-value">{c.type === 'switch' ? ` · ${c.value ? 'ON' : 'OFF'}` : c.type === 'led' ? ` · ${LED_COLORS[c.color] || 'Red'}` : ` · ${c.value} ${PARTS[c.type].unit}`}</tspan></text>
                </g>}
                {c.type === 'led' && running && showEffects && active && <g transform={`translate(${c.x + 53},${c.y - 27})`}><rect x="-6" y="-13" width="50" height="23" rx="11" fill="#eff4df" stroke="#d7e4b5"/><circle cx="5" cy="-1" r="3" fill="#89aa50"/><text x="15" y="3" fontSize="10" fill="#647b3f">ON</text></g>}
              </g>;
            })}
            {running && showFlow && <WireReadouts wires={project.wires} components={project.components} voltages={result.wireVoltages} currents={result.wireCurrents} referenceName={voltageReferenceName}/>}
            {selectedWire && mode === 'select' && <g className="wire-routing-handles" data-wire-handles={selectedWire.id}>
              {selectedWirePoints.slice(0, -1).map((a, index) => {
                const b = selectedWirePoints[index + 1];
                if (Math.hypot(a.x - b.x, a.y - b.y) * zoom < 38) return null;
                const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
                const cursor = Math.abs(a.y - b.y) < .5 ? 'ns-resize' : Math.abs(a.x - b.x) < .5 ? 'ew-resize' : 'move';
                return <g key={`segment-${index}`} className="wire-segment-handle" data-wire-segment={index} style={{ cursor }} onPointerDown={e => beginWireDrag(e, selectedWire, 'segment', index)}>
                  <circle className="wire-handle-hit" cx={x} cy={y} r={13 / zoom} fill="transparent"/>
                  <rect x={x - 3.5 / zoom} y={y - 3.5 / zoom} width={7 / zoom} height={7 / zoom} rx={1.5 / zoom} fill="white" stroke={selectedWire.color} strokeWidth={1.5 / zoom} pointerEvents="none"/>
                  <title>Drag this segment to move the wire. Double-click to add a bend.</title>
                </g>;
              })}
              {selectedWirePoints.slice(1, -1).map((p, index) => <g key={`bend-${index}`} className="wire-bend-handle" data-wire-bend={index} role="button" tabIndex={0} aria-label={`Wire bend ${index + 1}. Drag or use arrow keys to move; Delete to remove.`} onKeyDown={e => bendKeyDown(e, selectedWire, index)} onPointerDown={e => beginWireDrag(e, selectedWire, 'bend', index)}>
                <circle className="wire-handle-hit" cx={p.x} cy={p.y} r={14 / zoom} fill="transparent"/>
                <circle className="wire-handle-ring" cx={p.x} cy={p.y} r={6 / zoom} fill="white" stroke={selectedWire.color} strokeWidth={2 / zoom} pointerEvents="none"/>
                <circle cx={p.x} cy={p.y} r={2 / zoom} fill={selectedWire.color} pointerEvents="none"/>
                <title>Drag to move this bend. Double-click to remove it.</title>
              </g>)}
            </g>}
            {wireStart && <path className="pending-wire" d={roundedPath([endpointPosition(wireStart, project.components), { x: pointer.x, y: endpointPosition(wireStart, project.components).y }, pointer])} stroke={wireColor} strokeWidth="3" strokeDasharray="6 4" fill="none" pointerEvents="none"/>}
            {!project.components.length && <g transform="translate(525 305)" pointerEvents="none"><circle r="46" fill="#edf1e4"/><path d="m5-25-22 30h16l-5 22 24-32H2z" fill="#8ea85e"/><text y="85" textAnchor="middle" fontSize="23" fontWeight="600" fill="#404b38">Every idea starts somewhere.</text><text y="116" textAnchor="middle" fontSize="15" fill="#919988">Drag a component here and make your first connection.</text></g>}
          </g>
        </svg>
        <div className="canvas-bottom">
          <div className="canvas-hint">{dragging ? <><Hand size={14}/>Release to place<kbd>esc</kbd><span>to cancel</span></> : mode === 'wire' ? <><MoveUpRight size={14}/>{wireStart ? 'Choose another terminal to connect' : 'Click a terminal to start a wire'}<kbd>esc</kbd><span>to cancel</span></> : mode === 'pan' ? <><Hand size={14}/>Drag the canvas to look around</> : selectedWire ? <><MoveUpRight size={14}/><span>Drag wire or handles to reshape</span><span className="hint-dot">·</span><span>Double-click to add a bend</span></> : <><MousePointer2 size={13}/><span>Drag a part or its label to move</span><span className="hint-dot">·</span><span>Arrow keys to nudge</span></>}</div>
          <div className="canvas-controls"><div className="tool-dock"><ToolButton label="Select (V)" active={mode === 'select'} onClick={() => { setMode('select'); setWireStart(null); }}><MousePointer2 size={18}/></ToolButton><ToolButton label="Wire (W)" active={mode === 'wire'} onClick={() => setMode('wire')}><svg viewBox="0 0 20 20" width="19" height="19"><path d="M4 16V7q0-3 3-3h6q3 0 3 3v9" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="4" cy="16" r="2" fill="currentColor"/><circle cx="16" cy="16" r="2" fill="currentColor"/></svg></ToolButton><ToolButton label="Pan (H)" active={mode === 'pan'} onClick={() => { setMode('pan'); setWireStart(null); }}><Hand size={18}/></ToolButton><span className="tool-divider"/><ToolButton label="Rotate component (R)" onClick={rotateSelected} disabled={!component || component.type === 'breadboard'}><RotateCw size={18}/></ToolButton><ToolButton label="Delete selected (Backspace)" onClick={deleteSelected} disabled={!selected}><Trash2 size={17}/></ToolButton></div><div className="zoom-dock"><ToolButton label="Zoom out" disabled={zoom <= .5} onClick={() => setZoom(z => Math.max(.5, +(z - .1).toFixed(1)))}><Minus size={16}/></ToolButton><button className="zoom-value" title="Reset zoom" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{Math.round(zoom * 100)}%</button><ToolButton label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom(z => Math.min(2, +(z + .1).toFixed(1)))}><Plus size={16}/></ToolButton><span className="tool-divider"/><ToolButton label="Fit circuit to view" onClick={() => {
            if (!project.components.length) { setZoom(1); setPan({ x: 0, y: 0 }); return; }
            const bends = project.wires.flatMap(w => w.via || []);
            const minX = Math.min(...project.components.map(c => c.x - (c.type === 'breadboard' ? 340 : 85)), ...bends.map(p => p.x - 15)), maxX = Math.max(...project.components.map(c => c.x + (c.type === 'breadboard' ? 340 : 85)), ...bends.map(p => p.x + 15)), minY = Math.min(...project.components.map(c => c.y - (c.type === 'breadboard' ? 180 : 100)), ...bends.map(p => p.y - 15)), maxY = Math.max(...project.components.map(c => c.y + (c.type === 'breadboard' ? 200 : 120)), ...bends.map(p => p.y + 15));
            const z = Math.min(1.4, 910 / (maxX - minX), 510 / (maxY - minY)); setZoom(z); setPan({ x: (525 - (minX + maxX) / 2) * z, y: (355 - (minY + maxY) / 2) * z });
          }}><Expand size={16}/></ToolButton></div></div>
        </div>
        <section className={`readings-panel ${showReadings ? '' : 'collapsed'}`}>
          <div className="readings-top"><div><Activity size={16}/><h2>Live readings</h2><span className={`reading-state ${connected ? 'live' : ''}`}>{running ? result.closed ? 'LIVE' : 'OPEN CIRCUIT' : 'SIMULATION OFF'}</span></div><button className="readings-collapse" aria-label={showReadings ? 'Collapse live readings' : 'Expand live readings'} onClick={() => setShowReadings(v => !v)}><ChevronDown size={16}/></button></div>
          {showReadings && <><div className="reading-cards"><div className="reading-card"><span><Zap size={14}/>Supply voltage</span><strong>{running ? result.voltage.toFixed(1) : '—'}<small>V</small></strong><p>{project.components.filter(c => c.type === 'battery').length || 'No'} power source{project.components.filter(c => c.type === 'battery').length === 1 ? '' : 's'}</p></div><div className="reading-card"><span><Activity size={14}/>Total current</span><strong>{running ? primaryCurrent.toFixed(1) : '—'}<small>mA</small>{connected && <span className="tiny-wave">⌁⌁⌁</span>}</strong><p>{running ? connected ? 'Current is flowing' : 'No closed path' : 'Waiting for simulation'}</p></div><div className="reading-card"><span><Lightbulb size={14}/>Power used</span><strong>{running ? (result.power * 1000).toFixed(1) : '—'}<small>mW</small></strong><p>Across all components</p></div></div><div className={`circuit-health ${running && result.warnings.length ? 'warning' : ''}`}><span>{running && result.warnings.length ? <Thermometer size={14}/> : <span className="health-check"><Check size={10}/></span>}{running ? result.warnings[0] || (connected ? 'Looking good. Your circuit is connected and working.' : 'Close the switch or connect a complete loop to let current flow.') : 'Your next bright idea is one click away. Run your circuit to see it come alive.'}</span><button onClick={() => setModal('diagnostics')}>Circuit details<ArrowUpRight size={13}/></button></div></>}
        </section>
      </section>

      <aside className={`inspector-panel ${mobilePanel === 'inspector' ? 'mobile-open' : ''}`}>
        <div className="panel-tabs inspector-tabs"><button className={inspectorTab === 'properties' ? 'selected' : ''} onClick={() => setInspectorTab('properties')}>Properties</button><button className={inspectorTab === 'simulation' ? 'selected' : ''} onClick={() => setInspectorTab('simulation')}>Simulation<span className="tab-dot"/></button></div>
        <div className="inspector-scroll">
          {inspectorTab === 'properties' && <>
            {component ? <div className="component-inspector"><div className="section-eyebrow">SELECTED COMPONENT<div><ToolButton label="Rename component" onClick={() => setEditingLabel(v => !v)}><Pencil size={13}/></ToolButton><ToolButton label="Duplicate component" onClick={duplicateSelected}><Copy size={13}/></ToolButton><ToolButton label="Delete component" onClick={deleteSelected}><Trash2 size={13}/></ToolButton></div></div><div className="selected-component-card"><PartThumbnail type={component.type} large color={component.color} value={component.value}/><div><h2>{part.name}</h2><p>{component.type === 'resistor' ? 'A little resistance goes a long way.' : part.description}</p></div><span className="part-id">{component.id === 'r1' ? 'R1' : component.type === 'battery' ? 'BAT' : component.type === 'breadboard' ? 'BB' : component.type.toUpperCase().slice(0, 3)}</span></div>
              <details className="position-details"><summary><MoveUpRight size={13}/>Position<span>{Math.round(component.x)}, {Math.round(component.y)}</span></summary><div className="position-fields">{['x', 'y'].map(axis => <label key={axis}>{axis.toUpperCase()}<input aria-label={`Component ${axis.toUpperCase()} position`} type="number" step="4" value={component[axis]} onChange={e => { const value = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(value)) patchComponent(axis, value); }}/></label>)}</div><p>Drag the part or its label. Arrow keys nudge; Shift moves farther.</p></details>
              {editingLabel && <label className="field-label">Name<input autoFocus onBlur={() => setEditingLabel(false)} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} value={component.label || (component.id === 'r1' ? 'Resistor 1' : part.name)} onChange={e => patchComponent('label', e.target.value)}/></label>}
              {component.type === 'switch' ? <div className="switch-property"><span>Switch position<small>{component.value ? 'Closed · current can flow' : 'Open · current is interrupted'}</small></span><Toggle label="Switch position" checked={!!component.value} onChange={v => patchComponent('value', v ? 1 : 0)}/></div> : component.type === 'breadboard' ? <div className="board-description"><span>30 columns · 420 connection points</span><p>Each column connects its five holes within a–e or f–j. The center gap separates both halves. Each colored power rail is continuous.</p></div> : <><label className="field-label">{component.type === 'resistor' || ['lamp', 'motor', 'buzzer'].includes(component.type) ? 'Resistance' : component.type === 'battery' ? 'Voltage' : component.type === 'led' ? 'Forward voltage' : 'Capacitance'}<div className="number-field"><input aria-label={component.type === 'resistor' ? 'Resistance' : component.type === 'battery' ? 'Voltage' : 'Component value'} type="number" min={component.type === 'battery' ? .1 : .01} max={component.type === 'battery' ? 48 : 10000000} step={component.type === 'battery' || component.type === 'led' ? .1 : 1} value={component.value} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0 && v <= (component.type === 'battery' ? 48 : 10000000)) patchComponent('value', v); }}/><span>{part.unit}</span><ChevronDown size={14}/></div></label>{component.type === 'resistor' && <div className="quick-values">{[100, 220, 330, 1000].map(v => <button className={component.value === v ? 'selected' : ''} key={v} onClick={() => patchComponent('value', v)}>{v === 1000 ? '1k' : v} Ω</button>)}</div>}
                {component.type === 'led' && <div className="wire-color-picker"><label>LED color</label><div>{['#e95f49', '#dbaa36', '#82b94d', '#5c94c5', '#b17aca'].map(color => <button key={color} aria-label={`LED color ${color}`} className={component.color === color ? 'selected' : ''} style={{ background: color }} onClick={() => patchComponent('color', color)}>{component.color === color && <Check size={12}/>}</button>)}</div></div>}
                <div className="property-meta"><span>{component.type === 'resistor' ? 'Tolerance' : component.type === 'led' ? 'Max. current' : component.type === 'battery' ? 'Internal resistance' : 'Model'}</span><strong>{component.type === 'resistor' ? '±5%' : component.type === 'led' ? '30 mA' : component.type === 'battery' ? '1 Ω' : 'Steady-state DC'}</strong></div>{component.type === 'resistor' && <div className="property-meta"><span>Power rating</span><strong>¼ W</strong></div>}
              </>}
              {component.type !== 'breadboard' && <><div className="property-divider"/><div className="section-eyebrow">IN THIS CIRCUIT<span className={`live-dot ${running ? 'on' : ''}`}/></div><div className="component-readings"><div><span>Voltage</span><strong>{running && reading ? Math.abs(reading.voltage).toFixed(2) : '—'}<small>V</small></strong></div><div><span>Current</span><strong>{running && reading ? (Math.abs(reading.current) * 1000).toFixed(2) : '—'}<small>mA</small></strong></div></div>{component.type === 'resistor' && <div className={`temperature-note ${running && reading?.temperature > 60 ? 'hot' : ''}`}><Thermometer size={15}/><span>{running && reading ? `${reading.temperature.toFixed(1)} °C` : '22.0 °C'}<small>{running && reading?.temperature > 60 ? 'Getting warm' : 'Comfortably cool'}</small></span><span className="temp-bar"><i style={{ width: `${Math.min(100, running ? reading?.temperature || 22 : 22)}%` }}/></span></div>}</>}
            </div> : selectedWire ? <div className="component-inspector"><div className="section-eyebrow">SELECTED CONNECTION<ToolButton label="Delete wire" onClick={deleteSelected}><Trash2 size={14}/></ToolButton></div><h2 className="wire-title">Jumper wire</h2><p className="inspector-description">A small connection. A new possibility.</p><div className="wire-color-picker"><label>Wire color</label><div>{COLORS.map(color => <button key={color} aria-label={`Wire color ${color}`} style={{ background: color }} className={selectedWire.color === color ? 'selected' : ''} onClick={() => update(p => ({ ...p, wires: p.wires.map(w => w.id === selected ? { ...w, color } : w) }))}>{selectedWire.color === color && <Check size={12}/>}</button>)}</div></div><div className="wire-routing-panel"><div className="section-eyebrow">WIRE POSITION<span>{Math.max(0, selectedWirePoints.length - 2)} bends</span></div><p>Drag the wire to move a segment, or drag a round handle to shape a bend. Connections stay attached.</p><div className="wire-routing-actions"><button className="button outline" onClick={() => addWireBend(selectedWire)}><Plus size={13}/>Add bend</button><button className="button outline" onClick={() => editWire(selectedWire.id, undefined)} disabled={!selectedWire.via}><RotateCw size={13}/>Reset route</button></div><small>Double-click a bend to remove it. All moves support undo.</small></div><div className="connection-info"><span>From</span><strong>{project.components.find(c => c.id === selectedWire.from.split(':')[0])?.label || PARTS[project.components.find(c => c.id === selectedWire.from.split(':')[0])?.type]?.name} · {selectedWire.from.split(':').slice(1).join(' / ')}</strong><span>To</span><strong>{project.components.find(c => c.id === selectedWire.to.split(':')[0])?.label || PARTS[project.components.find(c => c.id === selectedWire.to.split(':')[0])?.type]?.name} · {selectedWire.to.split(':').slice(1).join(' / ')}</strong></div><div className="property-meta"><span>Voltage vs. battery −</span><strong>{running ? formatWireVoltage(result.wireVoltages[selectedWire.id]) : '— V'}</strong></div><div className="property-meta"><span>Current</span><strong>{running ? formatWireCurrent(result.wireCurrents[selectedWire.id]) : '— mA'}</strong></div></div> : <div className="no-selection"><MousePointer2 size={27}/><h2>Make yourself at ohm.</h2><p>Select a component to change its properties and see what’s happening inside.</p></div>}
          </>}

          <div className="visualization-section"><div className="visualization-heading"><span className="section-eyebrow">SEE THE INVISIBLE</span><Sparkles size={15}/></div><h2>A circuit, brought to life.</h2><p>Get a feel for what’s flowing.</p><div className="setting-row"><span className="setting-icon"><Activity size={17}/></span><span className="setting-copy">Current flow<small>Voltage and current on every wire</small></span><Toggle label="Show current flow" checked={showFlow} onChange={setShowFlow}/></div><div className="setting-row"><span className="setting-icon"><Lightbulb size={17}/></span><span className="setting-copy">Component effects<small>See light, motion, and sound waves</small></span><Toggle label="Show component effects" checked={showEffects} onChange={setShowEffects}/></div><div className="setting-row"><span className="setting-icon"><Thermometer size={17}/></span><span className="setting-copy">Heat view<small>See where energy becomes warmth</small></span><Toggle label="Show heat view" checked={showHeat} onChange={setShowHeat}/></div>{inspectorTab === 'simulation' && <div className="flow-speed"><label htmlFor="flow-speed">Flow animation speed<span>{flowSpeed}×</span></label><input id="flow-speed" aria-label="Flow animation speed" type="range" min="0.5" max="2" step="0.5" value={flowSpeed} onChange={e => setFlowSpeed(Number(e.target.value))}/><div><span>A little slower</span><span>A little faster</span></div></div>}{mode === 'wire' && <div className="wire-color-picker"><label>New wire color</label><div>{COLORS.map(color => <button key={color} aria-label={`New wire color ${color}`} style={{ background: color }} className={wireColor === color ? 'selected' : ''} onClick={() => setWireColor(color)}>{wireColor === color && <Check size={12}/>}</button>)}</div></div>}
            {inspectorTab === 'simulation' && <div className="simulation-about"><h3>Made for little experiments</h3><p>Current uses a steady-state DC model. Capacitors act as an open circuit after charging. Motor and buzzer loads use an equivalent resistance; sound is shown visually.</p><p>Heat and light effects are illustrative. Wire dots show conventional current from positive to negative; animation speed is for visibility. Wire voltages use the first battery’s negative terminal as 0 V. Current labels show the amount flowing through each wire.</p><button onClick={() => setModal('diagnostics')}>View electrical diagnostics<ArrowUpRight size={14}/></button></div>}
          </div>
        </div>
        <div className="inspector-footer"><span className="small-spark">✳</span><span>A safe space to experiment.<br/><strong>Curiosity is the only requirement.</strong></span></div>
      </aside>
    </main>
    <footer className="status-bar"><span><span className="status-dot"/>All systems ready<span className="status-separator">/</span>Made for curious minds.</span><div><button onClick={() => setModal('guide')}><span>⌘</span>Keyboard shortcuts</button><span className="status-separator">/</span><span>DC simulation</span><span className="version-label">v.1.0</span></div></footer>
    <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={importCircuit}/>
    {toast && <div className="toast" role="status"><span><Check size={15}/></span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={14}/></button></div>}
    {mobilePanel && <button className="mobile-backdrop" aria-label="Close panel" onClick={() => setMobilePanel(null)}/>}
    {modal && <div className="modal-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) setModal(null); }}><div ref={modalRef} className={`modal modal-${modal}`} role="dialog" aria-modal="true" aria-label={modal === 'guide' ? 'Quick guide' : modal === 'projects' ? 'Starter circuits' : modal === 'diagnostics' ? 'Circuit diagnostics' : 'Circuit options'}><button className="modal-close icon-button" autoFocus aria-label="Close dialog" onClick={() => setModal(null)}><X size={20}/></button>
      {modal === 'guide' && <><span className="modal-symbol"><BookOpen size={24}/></span><span className="section-eyebrow">A LITTLE GUIDANCE</span><h2>Let’s make a connection.</h2><p className="modal-lead">You don’t need a lab. Just a little curiosity.</p><div className="guide-steps">{[['01', 'Pick your parts', 'Click or drag components from the library. Drag a placed part or its label to move it, or use arrow keys to nudge it. Connections follow along.'], ['02', 'Connect the dots', 'Press W, then click two terminal dots or breadboard holes. Holes a–e and f–j connect within each column; the power rails connect along the full row. Components connect through their terminal dots and explicit wires.'], ['03', 'Make room for your connections', 'Drag a wire to reposition a segment. Select it to reveal round bend handles you can drag. Double-click the wire to add a bend, or double-click a bend to remove it. Reset route returns to automatic routing.'], ['04', 'Give it a little power', 'Run the simulation. Double-click a switch to open or close it. Select a component to change its value and inspect live readings.'], ['05', 'See the invisible', 'Turn on current flow, component effects, or heat view. Try a larger resistor and watch the current drop.']].map(([n, title, desc]) => <div key={n}><span>{n}</span><section><h3>{title}</h3><p>{desc}</p></section></div>)}</div><div className="shortcut-grid">{[['V', 'Select'], ['W', 'Connect wire'], ['H', 'Pan'], ['R', 'Rotate'], ['Space', 'Run / stop'], ['⌘ Z', 'Undo'], ['⌘ S', 'Save'], ['Delete', 'Remove']].map(([key, label]) => <div key={key}><span>{label}</span><kbd>{key}</kbd></div>)}</div><button className="button run-button modal-primary" onClick={() => setModal(null)}>Let’s build something<ArrowRight size={16}/></button></>}
      {modal === 'projects' && <><span className="modal-symbol"><Sparkles size={25}/></span><span className="section-eyebrow">START WITH A SPARK</span><h2>Something small. Something bright.</h2><p className="modal-lead">Ready-to-connect ideas for your next experiment.</p><div className="template-grid">{[['led', 'led', 'Your first light', 'A battery, a resistor, and a small bright idea.', '5 components'], ['lamp', 'lamp', 'A bright idea', 'Flip the switch and light up your workbench.', '4 components'], ['motor', 'motor', 'Make it move', 'Turn electrical energy into a little motion.', '4 components']].map(([kind, type, name, desc, total]) => <button className="template-card" key={kind} onClick={() => template(kind)}><div className={`template-art art-${type}`}><PartThumbnail type={type} large/></div><h3>{name}<ArrowUpRight size={16}/></h3><p>{desc}</p><span>{total}<span>Beginner</span></span></button>)}</div><button className="start-blank" onClick={() => setModal('new')}><Plus size={17}/>Or start with a blank canvas<ArrowRight size={16}/></button><p className="modal-footnote">Your current circuit stays in undo history. Save it to keep it in My circuits.</p></>}
      {modal === 'options' && <><span className="section-eyebrow">YOUR WORKSPACE</span><h2>Keep the ideas flowing.</h2><div className="options-list"><button onClick={() => { setModal(null); saveCircuit(); }}><FolderOpen size={20}/><span><strong>Save circuit</strong><small>Keep a copy in this browser</small></span><ChevronRight size={17}/></button><button onClick={exportCircuit}><Download size={20}/><span><strong>Export circuit</strong><small>Download an editable JSON file</small></span><ChevronRight size={17}/></button><button onClick={() => importRef.current.click()}><Upload size={20}/><span><strong>Import circuit</strong><small>Open a previously exported circuit</small></span><ChevronRight size={17}/></button><button onClick={() => setModal('projects')}><Sparkles size={20}/><span><strong>Explore starter circuits</strong><small>A little inspiration to get you going</small></span><ChevronRight size={17}/></button><button onClick={() => setModal('new')}><Plus size={20}/><span><strong>New circuit</strong><small>A fresh canvas for a fresh idea</small></span><ChevronRight size={17}/></button></div></>}
      {modal === 'new' && <><span className="modal-symbol"><Plus size={26}/></span><span className="section-eyebrow">A FRESH START</span><h2>Room for your next idea.</h2><p className="modal-lead">Choose your starting point. Your current circuit stays in undo history.</p><div className="new-options"><button onClick={() => loadCircuit({ name: 'Untitled circuit', components: [], wires: [] })}><Square size={30}/><h3>Blank canvas</h3><p>Start from the very beginning.</p></button><button onClick={() => loadCircuit({ name: 'Untitled circuit', components: [initialProject().components[0]], wires: [] })}><Cpu size={30}/><h3>With a breadboard</h3><p>A home for your next invention.</p></button></div><button className="button outline modal-primary" onClick={saveCircuit}><FolderOpen size={16}/>Save current circuit first</button></>}
      {modal === 'diagnostics' && <><span className="modal-symbol"><Activity size={25}/></span><span className="section-eyebrow">UNDER THE SURFACE</span><h2>Your circuit, at a glance.</h2><p className="modal-lead">{running ? 'Live steady-state electrical readings.' : 'Calculated DC preview. Run the simulation for live effects.'}</p><div className={`diagnostic-health ${result.warnings.length ? 'warning' : ''}`}><Check size={18}/>{result.warnings.length ? 'Your circuit needs a little attention.' : result.closed ? 'A complete circuit. Ready to bring to life.' : 'There’s no current flowing yet.'}</div>{result.warnings.map(w => <p className="diagnostic-warning" key={w}><Thermometer size={16}/>{w}</p>)}<div className="diagnostics-table"><table><thead><tr><th>Component</th><th>Voltage</th><th>Current</th><th>Power</th></tr></thead><tbody>{project.components.filter(c => c.type !== 'breadboard').map(c => <tr key={c.id}><td>{c.label || PARTS[c.type].name}</td><td>{Math.abs(result.readings[c.id]?.voltage || 0).toFixed(2)} V</td><td>{(Math.abs(result.readings[c.id]?.current || 0) * 1000).toFixed(2)} mA</td><td>{((result.readings[c.id]?.power || 0) * 1000).toFixed(1)} mW</td></tr>)}</tbody></table></div><p className="model-note">DC learning model with 1 Ω battery resistance and piecewise-linear LEDs. Capacitors show their fully charged state; heat, light, and motion are illustrative. Animation dots represent conventional current.</p><button className="button run-button modal-primary" onClick={() => { setModal(null); if (!running) toggleSimulation(); }}>{running ? 'Back to the workbench' : 'Run this circuit'}<ArrowRight size={16}/></button></>}
    </div></div>}
  </div>;
}
