import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowUpRight, BookOpen, Box, Check, CheckCheck, ChevronDown, CircuitBoard, Expand, Eye, EyeOff, FolderOpen, Hand, Lightbulb, Minus, MoreHorizontal, MousePointer2, MoveUpRight, Play, Plus, Redo2, RotateCw, Settings2, Square, Thermometer, Trash2, Undo2, Upload, X, Zap } from 'lucide-react';
import { endpointPosition, initialProject, simulate, terminalPosition } from './circuit.js';
import { PARTS, createComponent, partBox, partValueLabel, pinPosition, placement, referenceDesignators, SCHEMATIC_GRID } from './parts.js';
import { validProject } from './project.js';
import { GraphicDefs, PartGraphic } from './PartGraphic.jsx';
import { insertBend, moveSegment, nearestSegment, wirePoints } from './wireGeometry.js';
import WireReadouts, { formatWireCurrent, formatWireVoltage } from './WireReadouts.jsx';
import SchematicLayer from './SchematicLayer.jsx';
import Library from './Library.jsx';
import Inspector, { ToolButton } from './Inspector.jsx';
import Modals, { FORMATS } from './Modals.jsx';
import { templateProject } from './templates.js';
import { routeSchematic } from './schematic.js';
import { ACCEPTED_EXTENSIONS, ImportError, importDiagram } from './importers/index.js';

const STORAGE = 'current-workbench-v1';
const VIEW_STORAGE = 'current-view';
const COLORS = ['#dc6a52', '#d5a143', '#78977b', '#687b8d', '#9f85b6', '#424b43'];
const CENTER = { x: 525, y: 355 };
const clone = value => JSON.parse(JSON.stringify(value));
const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const snap = (value, grid) => Math.round(value / grid) * grid;
function loadProject() { try { const p = JSON.parse(localStorage.getItem(STORAGE)); return validProject(p) ? p : initialProject(); } catch { return initialProject(); } }
function readSaved() { try { return JSON.parse(localStorage.getItem(`${STORAGE}-saved`)) || []; } catch { return []; } }
function readView() { try { return localStorage.getItem(VIEW_STORAGE) === 'schematic' ? 'schematic' : 'model'; } catch { return 'model'; } }
function storeView(view) { try { localStorage.setItem(VIEW_STORAGE, view); } catch { /* preference only */ } }
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
const wirePath = (w, components) => roundedPath(wirePoints(w, components));
const viewPosition = (endpoint, components, view) => {
  if (view !== 'schematic') return endpointPosition(endpoint, components);
  const [id, pin] = endpoint.split(':'), c = components.find(c => c.id === id);
  return c ? pinPosition(c, pin, 'schematic') : { x: 0, y: 0 };
};

/** Zoom and pan that frame a project in the given view. */
function fitCamera(project, view, routing) {
  const parts = project.components.filter(c => view === 'model' || PARTS[c.type]?.schematic);
  if (!parts.length) return { zoom: 1, pan: { x: 0, y: 0 } };
  const boxes = parts.map(c => partBox(c, view));
  const points = view === 'model' ? project.wires.flatMap(w => w.via || []) : (routing?.nets || []).flatMap(net => net.nodes);
  const pad = view === 'model' ? 34 : 46;
  const minX = Math.min(...boxes.map(b => b.x), ...points.map(p => p.x)) - pad, maxX = Math.max(...boxes.map(b => b.x + b.w), ...points.map(p => p.x)) + pad;
  const minY = Math.min(...boxes.map(b => b.y), ...points.map(p => p.y)) - pad - 20, maxY = Math.max(...boxes.map(b => b.y + b.h), ...points.map(p => p.y)) + pad + 10;
  const zoom = Math.max(.25, Math.min(view === 'schematic' ? 1.5 : 1.4, 960 / (maxX - minX), 470 / (maxY - minY)));
  return { zoom, pan: { x: (CENTER.x - (minX + maxX) / 2) * zoom, y: (CENTER.y - (minY + maxY) / 2) * zoom } };
}

export default function App() {
  const [project, setProject] = useState(loadProject);
  const projectRef = useRef(project); projectRef.current = project;
  const [view, setView] = useState(readView);
  const [selected, setSelected] = useState('r1');
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState('select');
  const [dragging, setDragging] = useState(false);
  const [pressed, setPressed] = useState(null);
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
  const [importState, setImportState] = useState(null);
  const [fileDrag, setFileDrag] = useState(false);
  const [saved, setSaved] = useState(readSaved);
  const [toast, setToast] = useState(null);
  const [saveStatus, setSaveStatus] = useState('All changes saved');
  const [renaming, setRenaming] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [showReadings, setShowReadings] = useState(true);
  const [mobilePanel, setMobilePanel] = useState(null);
  const searchRef = useRef(null), modalRef = useRef(null), lastClickRef = useRef(null), camerasRef = useRef({});
  const svgRef = useRef(null), sceneRef = useRef(null), dragRef = useRef(null), importRef = useRef(null), toastTimer = useRef(null), importFileRef = useRef(null);

  const simComponents = useMemo(() => pressed ? project.components.map(c => c.id === pressed ? { ...c, value: 1 } : c) : project.components, [project.components, pressed]);
  const result = useMemo(() => simulate(simComponents, project.wires), [simComponents, project.wires]);
  const routing = useMemo(() => view === 'schematic' ? routeSchematic(project.components, project.wires) : null, [view, project.components, project.wires]);
  const designators = useMemo(() => referenceDesignators(project.components), [project.components]);
  const component = project.components.find(c => c.id === selected);
  const selectedWire = view === 'model' ? project.wires.find(w => w.id === selected) : null;
  const selectedNet = routing?.nets.find(net => `net:${net.key}` === selected) || null;
  const selectedWirePoints = selectedWire ? wirePoints(selectedWire, project.components) : [];
  const referencePart = project.components.find(c => result.voltageReference?.startsWith(`${c.id}:`));
  const voltageReferenceName = referencePart?.type === 'ground' ? 'Ground' : `${referencePart?.label || 'Battery'} −`;
  const connected = running && result.closed;
  const sourceCount = project.components.filter(c => PARTS[c.type]?.source).length;
  const alert = useCallback(message => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 3500); }, []);

  const remember = useCallback(p => { setHistory(h => [...h.slice(-39), clone(p)]); setFuture([]); }, []);
  const update = useCallback(change => { remember(projectRef.current); setProject(p => typeof change === 'function' ? change(p) : change); }, [remember]);
  const moveTo = (c, x, y, targetView = view) => targetView === 'schematic' ? { ...c, schematic: { ...placement(c, 'schematic'), x, y } } : { ...c, x, y };
  const patchComponent = (key, value) => update(p => ({ ...p, components: p.components.map(c => {
    if (c.id !== selected) return c;
    if (key === 'x' || key === 'y') { const at = placement(c, view); return moveTo(c, key === 'x' ? value : at.x, key === 'y' ? value : at.y); }
    return { ...c, [key]: value };
  }) }));
  const undo = useCallback(() => { if (!history.length) return; const current = clone(projectRef.current); setFuture(f => [current, ...f]); setProject(history.at(-1)); setHistory(h => h.slice(0, -1)); }, [history]);
  const redo = useCallback(() => { if (!future.length) return; const current = clone(projectRef.current); setHistory(h => [...h, current]); setProject(future[0]); setFuture(f => f.slice(1)); }, [future]);

  useEffect(() => {
    setSaveStatus('Saving changes…');
    const timer = setTimeout(() => { try { localStorage.setItem(STORAGE, JSON.stringify(project)); setSaveStatus('All changes saved'); } catch { setSaveStatus('Storage full · export to save'); } }, 600);
    return () => clearTimeout(timer);
  }, [project]);
  useEffect(() => { if (!running) return; const timer = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(timer); }, [running]);

  const switchView = useCallback(next => {
    if (next === view) return;
    camerasRef.current[view] = { zoom, pan };
    const camera = camerasRef.current[next] || { zoom: 1, pan: { x: 0, y: 0 } };
    setZoom(camera.zoom); setPan(camera.pan); setView(next); storeView(next); setWireStart(null);
    setSelected(s => {
      const c = projectRef.current.components.find(c => c.id === s);
      if (c) return next === 'schematic' && c.type === 'breadboard' ? null : s;
      return null;
    });
  }, [view, zoom, pan]);
  const toggleSimulation = useCallback(() => { setRunning(r => !r); if (!running) setSeconds(0); }, [running]);
  const deleteSelected = useCallback(() => {
    if (!selected || selected.startsWith('net:')) return;
    update(p => ({ ...p, components: p.components.filter(c => c.id !== selected), wires: p.wires.filter(w => w.id !== selected && ![w.from, w.to].some(ep => ep.split(':')[0] === selected)) }));
    setSelected(null); setWireStart(null); alert('Removed from your circuit');
  }, [selected, update, alert]);
  const rotateSelected = useCallback(() => {
    if (!component || component.type === 'breadboard') return;
    update(p => ({ ...p, components: p.components.map(c => {
      if (c.id !== selected) return c;
      if (view === 'schematic') { const at = placement(c, 'schematic'); return { ...c, schematic: { ...at, rotation: (at.rotation + 90) % 360 } }; }
      return { ...c, rotation: ((c.rotation || 0) + 90) % 360 };
    }) }));
  }, [component, selected, update, view]);
  const duplicateSelected = () => {
    if (!component) return;
    const id = uid(component.type), copy = { ...clone(component), id, x: component.x + 50, y: component.y + 80 };
    delete copy.ref;
    if (component.schematic) copy.schematic = { ...component.schematic, x: component.schematic.x + 60, y: component.schematic.y + 60 };
    update(p => ({ ...p, components: [...p.components, copy] })); setSelected(id); alert(`${PARTS[component.type].name} duplicated`);
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
        if (drag?.type === 'press') setPressed(null);
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
      const key = e.key.toLowerCase(), plain = !e.metaKey && !e.ctrlKey && !e.altKey;
      if (e.key === '/') { e.preventDefault(); setLibraryTab('components'); setMobilePanel('library'); setTimeout(() => searchRef.current?.focus(), 0); return; }
      if ((e.metaKey || e.ctrlKey) && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.metaKey || e.ctrlKey) && key === 's') { e.preventDefault(); saveCircuit(); }
      else if (e.code === 'Space') { e.preventDefault(); toggleSimulation(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      else if (!plain) return;
      else if (key === 'r') rotateSelected();
      else if (key === 's') switchView(view === 'model' ? 'schematic' : 'model');
      else if (key === 'v') { setMode('select'); setWireStart(null); }
      else if (key === 'w') setMode('wire');
      else if (key === 'h') { setMode('pan'); setWireStart(null); }
      else if (component && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault(); const step = view === 'schematic' ? (e.shiftKey ? 60 : 20) : (e.shiftKey ? 20 : 4);
        const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
        const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
        update(p => ({ ...p, components: p.components.map(c => { if (c.id !== selected) return c; const at = placement(c, view); return moveTo(c, at.x + dx, at.y + dy); }) }));
      }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [modal, undo, redo, saveCircuit, toggleSimulation, deleteSelected, rotateSelected, switchView, component, selected, update, view]);

  const stagePoint = e => {
    if (!svgRef.current || !sceneRef.current) return { ...CENTER };
    const pt = svgRef.current.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(sceneRef.current.getScreenCTM().inverse());
  };
  const freeSchematicSpot = components => {
    const camera = view === 'schematic' ? { zoom, pan } : camerasRef.current.schematic || { zoom: 1, pan: { x: 0, y: 0 } };
    const center = { x: snap(CENTER.x - camera.pan.x / camera.zoom, SCHEMATIC_GRID), y: snap(CENTER.y - camera.pan.y / camera.zoom, SCHEMATIC_GRID) };
    const boxes = components.filter(c => PARTS[c.type].schematic).map(c => partBox(c, 'schematic'));
    for (let ring = 0; ring < 12; ring++) for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      const spot = { x: center.x + dx * 120, y: center.y + dy * 100 };
      if (boxes.every(b => spot.x + 70 < b.x || spot.x - 70 > b.x + b.w || spot.y + 60 < b.y || spot.y - 60 > b.y + b.h)) return spot;
    }
    return center;
  };
  const addPart = (type, point) => {
    const id = uid(type), components = projectRef.current.components, c = createComponent(type, id, 0, 0);
    if (view === 'schematic') {
      const spot = point ? { x: snap(point.x, SCHEMATIC_GRID), y: snap(point.y, SCHEMATIC_GRID) } : freeSchematicSpot(components);
      Object.assign(c, { x: snap(spot.x, 4), y: snap(spot.y, 4), schematic: { x: spot.x, y: spot.y, rotation: 0 } });
    } else {
      const count = components.filter(c => c.type !== 'breadboard').length;
      Object.assign(c, point || { x: 360 + (count % 6) * 86, y: 570 + Math.floor((count % 12) / 6) * 65 });
      if (PARTS[type].schematic) c.schematic = { ...freeSchematicSpot(components), rotation: 0 };
    }
    update(p => ({ ...p, components: [...p.components, c] })); setSelected(type === 'breadboard' && view === 'schematic' ? null : id); setMode('select'); setInspectorTab('properties');
    alert(type === 'breadboard' && view === 'schematic' ? 'Breadboard added · it appears in Model view' : `${PARTS[type].name} added · drag to position`); setMobilePanel(null);
  };
  const connect = endpoint => {
    const components = projectRef.current.components;
    if (!wireStart) { setWireStart(endpoint); setMode('wire'); setPointer(viewPosition(endpoint, components, view)); return; }
    if (wireStart === endpoint) { setWireStart(null); return; }
    if (projectRef.current.wires.some(w => (w.from === wireStart && w.to === endpoint) || (w.to === wireStart && w.from === endpoint))) { alert('These terminals are already connected'); setWireStart(null); return; }
    const id = uid('wire'); update(p => ({ ...p, wires: [...p.wires, { id, from: wireStart, to: endpoint, color: wireColor }] })); setWireStart(null); setSelected(view === 'model' ? id : null); setMode('select');
    alert(view === 'model' ? 'Wire connected · drag the wire or its handles to shape it' : 'Connected · the schematic routes the wire for you');
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
    e.preventDefault(); e.stopPropagation();
    if (running && c.type === 'pushbutton') {
      setSelected(c.id); setPressed(c.id);
      dragRef.current = { type: 'press', pointerId: e.pointerId, id: c.id };
      svgRef.current.setPointerCapture(e.pointerId); return;
    }
    setMode('select'); setWireStart(null);
    document.activeElement?.blur();
    const point = stagePoint(e), at = placement(c, view); setSelected(c.id); setInspectorTab('properties');
    dragRef.current = { type: 'component', view, pointerId: e.pointerId, id: c.id, x: point.x, y: point.y, originalX: at.x, originalY: at.y, snapshot: clone(projectRef.current), moved: false };
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const selectNet = (e, net) => {
    if (e.button !== 0 || dragRef.current) return;
    if (mode === 'pan') { startPan(e); return; }
    e.preventDefault(); e.stopPropagation();
    if (mode === 'wire') {
      const p = stagePoint(e), components = projectRef.current.components;
      const distance = pin => { const q = viewPosition(pin, components, 'schematic'); return Math.hypot(q.x - p.x, q.y - p.y); };
      connect(net.pins.reduce((best, pin) => distance(pin) < distance(best) ? pin : best)); return;
    }
    setSelected(`net:${net.key}`); setInspectorTab('properties');
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
    const drag = dragRef.current; if (!drag || e.pointerId !== drag.pointerId || drag.type === 'press') return;
    if (drag.type === 'pan') {
      const scale = svgRef.current.getScreenCTM().a;
      setPan({ x: drag.originalX + (e.clientX - drag.x) / scale, y: drag.originalY + (e.clientY - drag.y) / scale }); return;
    }
    const dx = p.x - drag.x, dy = p.y - drag.y;
    if (Math.hypot(dx, dy) * sceneRef.current.getScreenCTM().a > 3) { drag.moved = true; setDragging(true); }
    if (!drag.moved) return;
    if (drag.type === 'component') {
      const grid = drag.view === 'schematic' ? SCHEMATIC_GRID : 4;
      setProject(current => ({ ...current, components: current.components.map(c => c.id === drag.id ? moveTo(c, drag.originalX + snap(dx, grid), drag.originalY + snap(dy, grid), drag.view) : c) }));
    } else {
      const sx = snap(dx, 4), sy = snap(dy, 4);
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
    if (drag.type === 'press') setPressed(null);
    else if (e.type === 'pointercancel') {
      if (drag.snapshot) setProject(drag.snapshot);
      if (drag.type === 'pan') setPan({ x: drag.originalX, y: drag.originalY });
    } else if (drag.moved && drag.snapshot) { remember(drag.snapshot); lastClickRef.current = null; }
    else if (!drag.moved && drag.type !== 'pan') {
      const now = Date.now();
      const key = `${drag.type}:${drag.id}:${drag.type === 'wire-bend' ? drag.index : ''}`;
      if (lastClickRef.current?.key === key && now - lastClickRef.current.time < 400) {
        const type = projectRef.current.components.find(c => c.id === drag.id)?.type;
        if (drag.type === 'component' && (type === 'switch' || type === 'spdt')) {
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

  const loadCircuit = (p, { message = 'Circuit opened', view: nextView = view, cameras = {} } = {}) => {
    update({ name: p.name, components: clone(p.components), wires: clone(p.wires) });
    setSelected(p.components.find(c => c.type === 'resistor')?.id || null); setRunning(false); setWireStart(null); setPressed(null);
    camerasRef.current = cameras;
    const camera = cameras[nextView] || { zoom: 1, pan: { x: 0, y: 0 } };
    setZoom(camera.zoom); setPan(camera.pan);
    if (nextView !== view) { setView(nextView); storeView(nextView); }
    setModal(null); setLibraryTab('components'); alert(message);
  };
  const framedCameras = p => ({ model: fitCamera(p, 'model'), schematic: fitCamera(p, 'schematic', routeSchematic(p.components, p.wires)) });
  const exportCircuit = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'circuit'}.json`; a.click(); URL.revokeObjectURL(url); alert('Circuit exported');
  };
  const importFile = async file => {
    if (!file) return;
    setMobilePanel(null);
    try {
      if (file.size > 5000000) throw new ImportError('That file is larger than 5 MB. Choose a schematic, netlist, or circuit file.');
      const imported = importDiagram(file.name, await file.arrayBuffer());
      if (imported.format === 'Current project') { loadCircuit(imported.project, { message: 'Circuit imported' }); return; }
      loadCircuit(imported.project, { message: `Imported ${imported.summary.parts} parts from ${file.name}`, view: 'schematic', cameras: framedCameras(imported.project) });
      setImportState(imported.skipped.length || imported.warnings.length ? { report: { ...imported, fileName: file.name } } : null);
      if (imported.skipped.length || imported.warnings.length) setModal('import');
    } catch (error) {
      setImportState({ error: error instanceof ImportError ? error.message : 'This file couldn’t be read. Choose a KiCad, LTspice, Eagle, SPICE, or Current file.', fileName: file.name });
      setModal('import');
    }
  };
  importFileRef.current = importFile;
  const addPartRef = useRef(addPart); addPartRef.current = addPart;
  const addLibraryPart = useCallback(type => addPartRef.current(type), []);
  const openImport = () => { setImportState(null); setModal('import'); setMobilePanel(null); };
  const template = kind => { const p = templateProject(kind); loadCircuit(p, { cameras: framedCameras(p) }); };

  useEffect(() => {
    let depth = 0;
    const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
    const enter = e => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setFileDrag(true); };
    const over = e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const leave = e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setFileDrag(false); };
    const drop = e => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; setFileDrag(false); if (e.dataTransfer.files[0]) importFileRef.current(e.dataTransfer.files[0]); };
    window.addEventListener('dragenter', enter); window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragenter', enter); window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop); };
  }, []);

  const modelLabel = c => c.label || c.ref || (c.type === 'resistor' || project.components.filter(p => p.type === c.type).length > 1 ? designators[c.id] : PARTS[c.type].name);
  const primaryCurrent = running ? result.current * 1000 : 0;
  const pendingStart = wireStart && viewPosition(wireStart, project.components, view);

  return <div className="app-shell">
    <svg width="0" height="0" className="global-defs" aria-hidden="true"><GraphicDefs/></svg>
    <header className="app-header">
      <a href="#" className="brand" onClick={e => { e.preventDefault(); setModal('projects'); }} aria-label="Current home"><span className="brand-mark"><Zap size={18} fill="currentColor" strokeWidth={1.8}/></span><span>current</span></a>
      <div className="header-divider"/>
      <div className="project-title">
        {renaming ? <input aria-label="Circuit name" className="name-input" value={project.name} autoFocus onChange={e => setProject(p => ({ ...p, name: e.target.value }))} onBlur={() => { setRenaming(false); if (!project.name.trim()) setProject(p => ({ ...p, name: 'Untitled circuit' })); }} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}/>
          : <button className="name-button" onClick={() => setRenaming(true)}>{project.name}<ChevronDown size={14}/></button>}
        <span className="save-status"><CheckCheck size={13}/>{saveStatus}</span>
      </div>
      <div className="header-actions">
        <div className="history-actions"><ToolButton label="Undo (⌘Z)" onClick={undo} disabled={!history.length}><Undo2 size={17}/></ToolButton><ToolButton label="Redo (⌘⇧Z)" onClick={redo} disabled={!future.length}><Redo2 size={17}/></ToolButton></div>
        <button className="button quiet guide-button" onClick={() => setModal('guide')}><BookOpen size={16}/>Guide</button>
        <button className="button outline import-header-button" onClick={openImport}><Upload size={16}/>Import</button>
        <button className="button outline save-button" onClick={saveCircuit}><FolderOpen size={16}/>Save circuit</button>
        <button className={`button run-button ${running ? 'running' : ''}`} onClick={toggleSimulation}>{running ? <Square size={13} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}<span>{running ? 'Stop simulation' : 'Run simulation'}</span><kbd className="shortcut">␣</kbd></button>
      </div>
    </header>

    <main className="workbench">
      <Library className={mobilePanel === 'library' ? 'mobile-open' : ''} tab={libraryTab} setTab={setLibraryTab} view={view} search={search} setSearch={setSearch} category={category} setCategory={setCategory} searchRef={searchRef} saved={saved}
        onAdd={addLibraryPart} onWire={() => { setMode('wire'); alert('Click a terminal to start a wire'); setMobilePanel(null); }} onLoad={loadCircuit} onNew={() => setModal('new')} onSave={saveCircuit} onImport={openImport} onStarters={() => setModal('projects')} onGuide={() => setModal('guide')}/>

      <section className={`canvas-area view-${view}`}>
        <div className="canvas-header">
          <div className="view-switch" role="radiogroup" aria-label="Canvas view">
            <button role="radio" aria-checked={view === 'model'} className={view === 'model' ? 'selected' : ''} onClick={() => switchView('model')} title="Realistic model view (S)"><Box size={15}/>Model</button>
            <button role="radio" aria-checked={view === 'schematic'} className={view === 'schematic' ? 'selected' : ''} onClick={() => switchView('schematic')} title="Schematic diagram view (S)"><CircuitBoard size={15}/>Schematic</button>
          </div>
          <div className="canvas-header-right">
            <span className="component-total">{project.components.length} components<span>·</span>{project.wires.length} wires</span>
            <ToolButton label={showLabels ? 'Hide labels' : 'Show labels'} onClick={() => setShowLabels(l => !l)}>{showLabels ? <Eye size={17}/> : <EyeOff size={17}/>}</ToolButton>
            <ToolButton label="More circuit options" onClick={() => setModal('options')}><MoreHorizontal size={19}/></ToolButton>
          </div>
        </div>
        <div className="mobile-actions"><button onClick={() => setMobilePanel(mobilePanel === 'library' ? null : 'library')}><Plus size={15}/>Components</button><button onClick={() => setMobilePanel(mobilePanel === 'inspector' ? null : 'inspector')}><Settings2 size={15}/>Properties</button></div>
        <div className="canvas-top-info">
          <div className={`simulation-chip ${running ? 'is-running' : ''}`}><span className="status-dot"/>{running ? 'Simulation running' : 'Ready to run'}{running && <span className="elapsed">{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</span>}</div>
          {running && showFlow && project.wires.length > 0 && <span className="wire-reference-note">{result.voltageReference ? <>Voltages measured from <strong>{voltageReferenceName} = 0 V</strong></> : 'Add a battery to measure voltages.'}</span>}
        </div>
        <svg ref={svgRef} className={`circuit-canvas mode-${mode} ${dragging ? 'is-dragging' : ''}`} viewBox="0 100 1050 530" aria-label={view === 'schematic' ? 'Interactive schematic diagram' : 'Interactive circuit breadboard canvas'} onPointerMove={movePointer} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerDown={e => { if (e.button !== 0) return; if (mode === 'pan') { startPan(e); } else if (e.target === svgRef.current || e.target.classList.contains('canvas-hit')) { setSelected(null); if (wireStart) { setWireStart(null); } } }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const type = e.dataTransfer.getData('application/current-part'); if (PARTS[type]) addPart(type, stagePoint(e)); }}>
          <defs>
            <pattern id="schematicGrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" className="grid-minor"/></pattern>
            <pattern id="schematicGridMajor" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#schematicGrid)"/><path d="M100 0H0V100" fill="none" className="grid-major"/></pattern>
          </defs>
          <rect y="100" width="1050" height="530" fill="transparent" className="canvas-hit"/>
          <g ref={sceneRef} transform={`translate(${pan.x},${pan.y}) translate(525,355) scale(${zoom}) translate(-525,-355)`}>
            {view === 'schematic' ? <>
              <rect x="-5000" y="-5000" width="11000" height="11000" fill="url(#schematicGridMajor)" className="canvas-hit schematic-paper"/>
              <SchematicLayer components={project.components} routing={routing} result={result} running={running} showFlow={showFlow} showLabels={showLabels} flowSpeed={flowSpeed} selected={selected} wireStart={wireStart} mode={mode} designators={designators} pressed={pressed} onPartPointerDown={beginDrag} onTerminal={connect} onNetPointerDown={selectNet} startPan={startPan}/>
            </> : <>
              {project.components.filter(c => c.type === 'breadboard').map(c => <g key={c.id} transform={`translate(${c.x},${c.y})`} onPointerDown={e => beginDrag(e, c)} className="canvas-component" data-component={c.id}>
                {selected === c.id && <rect x="-335" y="-177" width="670" height="352" rx="15" className="selection-outline board"/>}
                <PartGraphic type="breadboard" id={c.id} onTerminal={connect} wireMode={mode === 'wire'}/>
                {showLabels && <g transform="translate(0,196)"><text className="part-label" textAnchor="middle">{c.label || 'Breadboard'} <tspan className="part-value">· 30 columns</tspan></text></g>}
              </g>)}
              {project.wires.map(w => { const d = wirePath(w, project.components); const current = result.wireCurrents[w.id] || 0; return <g key={w.id} className="circuit-wire" data-wire={w.id} onPointerDown={e => beginWireDrag(e, w)}>
                <title>{running ? `${formatWireVoltage(result.wireVoltages[w.id])} relative to ${voltageReferenceName}, ${formatWireCurrent(result.wireCurrents[w.id])}. ` : ''}Drag to reposition this wire. Double-click to add a bend.</title>
                <path d={d} stroke="transparent" strokeWidth="18" fill="none"/>
                {selected === w.id && <path d={d} stroke="#bfdc8b" strokeWidth="11" opacity=".45" fill="none"/>}
                <path d={d} transform="translate(0 3)" stroke="#39432c" strokeOpacity=".12" strokeWidth="6" fill="none" strokeLinecap="round"/>
                <path d={d} stroke={w.color} strokeWidth="5" fill="none" strokeLinecap="round"/>
                <path d={d} stroke="white" strokeOpacity=".14" strokeWidth="1.5" fill="none" transform="translate(0 -1)"/>
                {running && showFlow && Math.abs(current) > .00001 && <path d={d} className="current-flow" style={{ animationDuration: `${1.5 / flowSpeed}s`, animationDirection: current >= 0 ? 'normal' : 'reverse' }} stroke="#f1ffd3" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 19" fill="none"/>}
              </g>; })}
              {project.components.filter(c => c.type !== 'breadboard').map(c => {
                const part = PARTS[c.type], reading = result.readings[c.id], active = running && reading?.active, selectedPart = c.id === selected;
                const [x1, y1, x2, y2] = part.model.box, labelY = part.model.label ?? y1 - 14;
                const name = modelLabel(c), value = partValueLabel(c), labelWidth = Math.max(70, (name.length + value.length + 3) * 6.3 + 22);
                return <g key={c.id} className={`canvas-component ${selectedPart ? 'is-selected' : ''}`} data-component={c.id}>
                  <g transform={`translate(${c.x},${c.y}) rotate(${c.rotation || 0})`} onPointerDown={e => beginDrag(e, c)}>
                    {selectedPart && <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} rx="9" className="selection-outline"/>}
                    <PartGraphic type={c.type} active={active} intensity={Math.abs(reading?.current || 0) / (c.type === 'led' ? .02 : .08)} effects={showEffects} heat={showHeat && (reading?.power || 0) > .02} value={c.value} color={c.color} position={c.position}
                      reading={running ? (c.type === 'ammeter' ? reading?.current : c.type === 'voltmeter' ? reading?.voltage : undefined) : undefined} pressed={pressed === c.id} blown={running && c.type === 'fuse' && reading?.state === true}/>
                  </g>
                  {part.pins.map((pinName, pin) => { const pos = terminalPosition(c, pin), key = `${c.id}:${pin}`; return <g key={pin} data-terminal={key} className={`terminal ${wireStart === key ? 'terminal-selected' : ''}`} onPointerDown={e => { if (mode === 'pan') { startPan(e); return; } e.stopPropagation(); connect(key); }}><circle cx={pos.x} cy={pos.y} r="10" fill="transparent"/><circle cx={pos.x} cy={pos.y} r="4.2" fill={wireStart === key ? '#c5ec5b' : '#dfe3d8'} stroke="#7c8873" strokeWidth="1.5"/><circle cx={pos.x} cy={pos.y} r="1.7" fill="#7e8c74"/><title>{`${part.name} · ${pinName} — click to wire`}</title></g>; })}
                  {showLabels && <g transform={`translate(${c.x},${c.y + labelY})`} className="canvas-component-label" onPointerDown={e => beginDrag(e, c)}>
                    <rect x={-labelWidth / 2} y="-15" width={labelWidth} height="24" rx="6"/>
                    <text textAnchor="middle" className={`part-label ${selectedPart ? 'selected' : ''}`}>{name}{value && <tspan className="part-value">{` · ${value}`}</tspan>}</text>
                  </g>}
                  {c.type === 'led' && running && showEffects && active && <g transform={`translate(${c.x + 53},${c.y - 27})`} className="led-badge"><rect x="-6" y="-13" width="50" height="23" rx="11"/><circle cx="5" cy="-1" r="3"/><text x="15" y="3">ON</text></g>}
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
            </>}
            {pendingStart && <path className="pending-wire" d={roundedPath([pendingStart, { x: pointer.x, y: pendingStart.y }, pointer], view === 'schematic' ? 0 : 12)} stroke={view === 'schematic' ? 'currentColor' : wireColor} strokeWidth={view === 'schematic' ? 2 : 3} strokeDasharray="6 4" fill="none" pointerEvents="none"/>}
            {!project.components.length && <g transform="translate(525 330)" pointerEvents="none" className="empty-canvas"><circle r="40"/><path d="m5-22-20 27h14l-4 20 22-29H3z"/><text y="76" textAnchor="middle" className="empty-title">Start with a part</text><text y="102" textAnchor="middle" className="empty-copy">Drag a component here, or drop in a KiCad, LTspice, Eagle, or SPICE file.</text></g>}
          </g>
        </svg>
        <div className="canvas-bottom">
          <div className="canvas-hint">{dragging ? <><Hand size={14}/>Release to place<kbd>esc</kbd><span>to cancel</span></> : mode === 'wire' ? <><MoveUpRight size={14}/>{wireStart ? 'Choose another terminal to connect' : 'Click a terminal to start a wire'}<kbd>esc</kbd><span>to cancel</span></> : mode === 'pan' ? <><Hand size={14}/>Drag the canvas to look around</> : selectedWire ? <><MoveUpRight size={14}/><span>Drag wire or handles to reshape</span><span className="hint-dot">·</span><span>Double-click to add a bend</span></> : view === 'schematic' ? <><MousePointer2 size={13}/><span>Drag symbols to arrange</span><span className="hint-dot">·</span><span>Wires route automatically</span></> : <><MousePointer2 size={13}/><span>Drag a part or its label to move</span><span className="hint-dot">·</span><span>Arrow keys to nudge</span></>}</div>
          <div className="canvas-controls"><div className="tool-dock"><ToolButton label="Select (V)" active={mode === 'select'} onClick={() => { setMode('select'); setWireStart(null); }}><MousePointer2 size={17}/></ToolButton><ToolButton label="Wire (W)" active={mode === 'wire'} onClick={() => setMode('wire')}><svg viewBox="0 0 20 20" width="18" height="18"><path d="M4 16V7q0-3 3-3h6q3 0 3 3v9" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="4" cy="16" r="2" fill="currentColor"/><circle cx="16" cy="16" r="2" fill="currentColor"/></svg></ToolButton><ToolButton label="Pan (H)" active={mode === 'pan'} onClick={() => { setMode('pan'); setWireStart(null); }}><Hand size={17}/></ToolButton><span className="tool-divider"/><ToolButton label="Rotate component (R)" onClick={rotateSelected} disabled={!component || component.type === 'breadboard'}><RotateCw size={17}/></ToolButton><ToolButton label="Delete selected (Backspace)" onClick={deleteSelected} disabled={!selected || selected.startsWith('net:')}><Trash2 size={16}/></ToolButton></div>
            <div className="zoom-dock"><ToolButton label="Zoom out" disabled={zoom <= .3} onClick={() => setZoom(z => Math.max(.25, +(z - .1).toFixed(2)))}><Minus size={16}/></ToolButton><button className="zoom-value" title="Reset zoom" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{Math.round(zoom * 100)}%</button><ToolButton label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom(z => Math.min(2, +(z + .1).toFixed(2)))}><Plus size={16}/></ToolButton><span className="tool-divider"/><ToolButton label="Fit circuit to view" onClick={() => { const camera = fitCamera(project, view, routing); setZoom(camera.zoom); setPan(camera.pan); }}><Expand size={15}/></ToolButton></div></div>
        </div>
        <section className={`readings-panel ${showReadings ? '' : 'collapsed'}`}>
          <div className="readings-top"><div><Activity size={15}/><h2>Live readings</h2><span className={`reading-state ${connected ? 'live' : ''}`}>{running ? result.closed ? 'LIVE' : 'OPEN CIRCUIT' : 'SIMULATION OFF'}</span></div><button className="readings-collapse" aria-label={showReadings ? 'Collapse live readings' : 'Expand live readings'} onClick={() => setShowReadings(v => !v)}><ChevronDown size={16}/></button></div>
          {showReadings && <><div className="reading-cards">
            <div className="reading-card"><span><Zap size={13}/>Supply voltage</span><strong>{running ? result.voltage.toFixed(1) : '—'}<small>V</small></strong><p>{sourceCount || 'No'} power source{sourceCount === 1 ? '' : 's'}</p></div>
            <div className="reading-card"><span><Activity size={13}/>Total current</span><strong>{running ? primaryCurrent.toFixed(1) : '—'}<small>mA</small></strong><p>{running ? connected ? 'Current is flowing' : 'No closed path' : 'Waiting for simulation'}</p></div>
            <div className="reading-card"><span><Lightbulb size={13}/>Power used</span><strong>{running ? (result.power * 1000).toFixed(1) : '—'}<small>mW</small></strong><p>Across all components</p></div>
          </div>
          <div className={`circuit-health ${running && result.warnings.length ? 'warning' : ''}`}><span>{running && result.warnings.length ? <Thermometer size={14}/> : <span className="health-check"><Check size={10}/></span>}{running ? result.warnings[0] || (connected ? 'Looking good. Your circuit is connected and working.' : 'Close the switch or complete a loop to let current flow.') : 'Run the simulation to see your circuit come alive.'}</span><button onClick={() => setModal('diagnostics')}>Circuit details<ArrowUpRight size={13}/></button></div></>}
        </section>
      </section>

      <Inspector className={mobilePanel === 'inspector' ? 'mobile-open' : ''} tab={inspectorTab} setTab={setInspectorTab} view={view} component={component} selectedWire={selectedWire} selectedNet={selectedNet} selectedWirePoints={selectedWirePoints} project={project} designators={designators} result={result} running={running}
        showFlow={showFlow} setShowFlow={setShowFlow} showEffects={showEffects} setShowEffects={setShowEffects} showHeat={showHeat} setShowHeat={setShowHeat} flowSpeed={flowSpeed} setFlowSpeed={setFlowSpeed} mode={mode} wireColor={wireColor} setWireColor={setWireColor} colors={COLORS}
        patchComponent={patchComponent} onDuplicate={duplicateSelected} onDelete={deleteSelected} onPress={setPressed} onWireColor={color => update(p => ({ ...p, wires: p.wires.map(w => w.id === selected ? { ...w, color } : w) }))} onAddBend={() => addWireBend(selectedWire)} onResetRoute={() => editWire(selectedWire.id, undefined)} onDiagnostics={() => setModal('diagnostics')}/>
    </main>
    <input ref={importRef} type="file" accept={ACCEPTED_EXTENSIONS.join(',')} hidden onChange={e => { importFile(e.target.files?.[0]); e.target.value = ''; }}/>
    {toast && <div className="toast" role="status"><span><Check size={14}/></span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={14}/></button></div>}
    {mobilePanel && <button className="mobile-backdrop" aria-label="Close panel" onClick={() => setMobilePanel(null)}/>}
    {fileDrag && <div className="file-drop-overlay" aria-hidden="true"><div><Upload size={30}/><strong>Drop to import</strong><span>{FORMATS.map(([name]) => name).slice(0, 4).join(' · ')} · SPICE</span></div></div>}
    <Modals modal={modal} modalRef={modalRef} close={() => setModal(null)} setModal={setModal} running={running} result={result} project={project} designators={designators} importState={importState}
      actions={{ template, save: saveCircuit, export: exportCircuit, load: p => loadCircuit(p), chooseFile: () => importRef.current.click(), importFile, run: toggleSimulation }}/>
  </div>;
}
