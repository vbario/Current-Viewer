import React, { memo } from 'react';
import { BookOpen, ChevronRight, Cpu, FolderOpen, Plus, Search, Sparkles, Upload } from 'lucide-react';
import { CATEGORIES, PARTS, formatValue } from './parts.js';
import { PartThumbnail } from './PartGraphic.jsx';
import { SchematicThumbnail } from './SchematicSymbol.jsx';

const SUBTITLES = { breadboard: '30 columns', switch: 'SPST · on / off', spdt: 'SPDT', pushbutton: 'Momentary', ground: '0 V reference', ammeter: 'In series', voltmeter: 'In parallel', led: 'Red · 2 V', npn: 'hFE 100', pnp: 'hFE 100', ldr: 'Light sensor', thermistor: '10 kΩ NTC' };
export const partSubtitle = type => SUBTITLES[type] || formatValue(PARTS[type].value, PARTS[type].unit);

// Memoized: thumbnails are detailed SVG and the library re-renders on every canvas edit.
const PartCard = memo(function PartCard({ type, view, onAdd }) {
  const p = PARTS[type];
  return <button className={`part-card part-${type}`} onClick={() => onAdd(type)} draggable onDragStart={e => { e.dataTransfer.setData('application/current-part', type); e.dataTransfer.effectAllowed = 'copy'; }} title={`${p.description}. Click or drag to add.`}>
    <span className="part-art">{view === 'schematic' ? <SchematicThumbnail type={type}/> : <PartThumbnail type={type}/>}</span>
    <span className="part-name">{p.name}</span>
    <span className="part-subtitle">{partSubtitle(type)}</span>
  </button>;
});

export default function Library({ className, tab, setTab, view, search, setSearch, category, setCategory, searchRef, saved, onAdd, onWire, onLoad, onNew, onSave, onImport, onStarters, onGuide }) {
  const query = search.trim().toLowerCase();
  const matches = Object.keys(PARTS).filter(type => (category === 'All' || PARTS[type].category === category) && `${PARTS[type].name} ${PARTS[type].description}`.toLowerCase().includes(query));
  const groups = query || category !== 'All' ? [[query ? 'Results' : category, matches]] : CATEGORIES.map(group => [group, matches.filter(type => PARTS[type].category === group)]);
  return <aside className={`library-panel ${className}`}>
    <div className="panel-tabs">
      <button className={tab === 'components' ? 'selected' : ''} onClick={() => setTab('components')}>Components<span className="count">{Object.keys(PARTS).length}</span></button>
      <button className={tab === 'circuits' ? 'selected' : ''} onClick={() => setTab('circuits')}>My circuits<span className="count">{saved.length}</span></button>
    </div>
    {tab === 'components' ? <>
      <div className="library-tools">
        <label className="search-field"><Search size={15}/><input ref={searchRef} placeholder="Search components" value={search} onChange={e => setSearch(e.target.value)}/><kbd>/</kbd></label>
        <div className="category-filters">{['All', ...CATEGORIES].map(c => <button key={c} onClick={() => setCategory(c)} className={category === c ? 'selected' : ''}>{{ Semiconductors: 'Semis', Prototyping: 'Boards' }[c] || c}</button>)}</div>
      </div>
      <div className="parts-scroll">
        {groups.filter(([, list]) => list.length).map(([name, list]) => <section key={name} className="parts-group">
          <h3 className="parts-heading">{name}<span>{list.length}</span></h3>
          <div className="parts-grid">{list.map(type => <PartCard key={type} type={type} view={view} onAdd={onAdd}/>)}</div>
        </section>)}
        {!matches.length && <div className="empty-library"><Search size={22}/><p>No components match “{search}”.</p><button className="button outline" onClick={() => { setSearch(''); setCategory('All'); }}>Clear filters</button></div>}
      </div>
      <button className="wire-library-button" onClick={onWire}><span className="wire-sample"><svg viewBox="0 0 34 24"><path d="M2 20V10q0-6 6-6h18q6 0 6 6v10" fill="none" stroke="currentColor" strokeWidth="2.6"/><circle cx="2" cy="20" r="2.2" fill="currentColor"/><circle cx="32" cy="20" r="2.2" fill="currentColor"/></svg></span><span>Connect with a wire<small>Click two terminals</small></span><kbd>W</kbd></button>
    </> : <div className="saved-library">
      <div className="saved-heading"><h2>Saved circuits</h2><button className="icon-button" aria-label="New circuit" title="New circuit" onClick={onNew}><Plus size={17}/></button></div>
      <p>Stored in this browser.</p>
      {saved.length ? saved.map(p => <button className="saved-circuit" key={p.saveId} onClick={() => onLoad(p)}><span className="saved-circuit-icon"><Cpu size={20}/></span><span><strong>{p.name}</strong><small>{p.components.length} parts · {new Date(p.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></span><ChevronRight size={15}/></button>)
        : <div className="saved-empty"><FolderOpen size={26}/><h3>Nothing saved yet</h3><p>Saved circuits show up here.</p><button className="button outline" onClick={onSave}>Save this circuit</button></div>}
      <button className="button outline import-button" onClick={onImport}><Upload size={15}/>Import a diagram</button>
    </div>}
    <div className="library-footer">
      <button onClick={onStarters}><Sparkles size={15}/>Starter circuits</button>
      <button onClick={onGuide}><BookOpen size={15}/>Guide</button>
    </div>
  </aside>;
}
