import React from 'react';

export function GraphicDefs() {
  return <defs>
    <linearGradient id="boardBody" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff"/><stop offset="1" stopColor="#ebece5"/></linearGradient>
    <linearGradient id="metal" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#dce0df"/><stop offset=".4" stopColor="#929d9c"/><stop offset=".55" stopColor="#eef0ed"/><stop offset="1" stopColor="#818b8a"/></linearGradient>
    <linearGradient id="resistorBody" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#efddbb"/><stop offset=".4" stopColor="#e8cea0"/><stop offset="1" stopColor="#bda179"/></linearGradient>
    <linearGradient id="batteryBody" x1="0" x2="1"><stop stopColor="#323735"/><stop offset=".5" stopColor="#454a47"/><stop offset="1" stopColor="#222825"/></linearGradient>
    <linearGradient id="copper" x1="0" x2="1"><stop stopColor="#bd8054"/><stop offset=".35" stopColor="#dfae7e"/><stop offset="1" stopColor="#b5764e"/></linearGradient>
    <linearGradient id="ledBody" x1="0" x2="1"><stop stopColor="#b9382f"/><stop offset=".4" stopColor="#f88972"/><stop offset="1" stopColor="#d44736"/></linearGradient>
    <linearGradient id="capacitorBody" x1="0" x2="1"><stop stopColor="#263c58"/><stop offset=".5" stopColor="#51759a"/><stop offset="1" stopColor="#233c5b"/></linearGradient>
    <radialGradient id="lightGlow"><stop stopColor="#ffbb62" stopOpacity=".65"/><stop offset=".35" stopColor="#ffcb6f" stopOpacity=".3"/><stop offset="1" stopColor="#ffcc6c" stopOpacity="0"/></radialGradient>
    <radialGradient id="heatGlow"><stop stopColor="#ef724b" stopOpacity=".45"/><stop offset="1" stopColor="#ff9e55" stopOpacity="0"/></radialGradient>
    <filter id="boardShadow" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#353c29" floodOpacity=".12"/><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#444932" floodOpacity=".09"/></filter>
    <filter id="partShadow" x="-60%" y="-80%" width="220%" height="280%"><feDropShadow dx="1" dy="5" stdDeviation="3" floodColor="#182015" floodOpacity=".2"/></filter>
  </defs>;
}

export function Breadboard({ onTerminal, id, miniature = false, wireMode = false }) {
  const rowYs = [-93, -77, -61, -45, -29, 23, 39, 55, 71, 87];
  const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  return <g>
    <rect x="-326" y="-164" width="652" height="334" rx="12" fill="#d8dbd1" filter={miniature ? undefined : 'url(#boardShadow)'}/>
    <rect x="-326" y="-168" width="652" height="334" rx="12" fill="url(#boardBody)" stroke="#d9ddd2"/>
    <path d="M-310 -155H310M-310 152H310" stroke="white" strokeWidth="3"/>
    <rect x="-301" y="-17" width="602" height="27" rx="4" fill="#dfe2d9"/>
    <rect x="-299" y="-14" width="598" height="24" rx="3" fill="#e7e9e1"/>
    <line x1="-299" y1="-14" x2="299" y2="-14" stroke="#d1d5c9"/>
    {[[-145, '#d77a72'], [-99, '#7c9ba6'], [102, '#d77a72'], [143, '#7c9ba6']].map(([y, color]) => <line key={y} x1="-286" y1={y} x2="303" y2={y} stroke={color} strokeWidth="1.5" opacity=".75"/>)}
    {[[-125, 'topPlus', '+', '#cc7770'], [-109, 'topMinus', '−', '#7497a2'], [112, 'bottomPlus', '+', '#cc7770'], [128, 'bottomMinus', '−', '#7497a2']].map(([y, row, sign, color]) => <g key={row}>
      <text x="-304" y={y + 4} fontSize="13" fill={color} textAnchor="middle">{sign}</text>
      {Array.from({ length: 30 }, (_, col) => <circle key={col} cx={-247 + col * 19} cy={y} r="3" fill="#6e756b" stroke="#d5d8cd" strokeWidth="1.6" className={wireMode ? 'board-hole connectable' : 'board-hole'} onPointerDown={e => { if (wireMode) { e.stopPropagation(); onTerminal?.(`${id}:${row}:${col}`); } }}/>)}</g>)}
    {rows.map((row, ri) => <g key={row}>
      <text x="-279" y={rowYs[ri] + 3} fill="#9ca393" fontSize="9" fontFamily="monospace">{row}</text>
      <text x="312" y={rowYs[ri] + 3} fill="#9ca393" fontSize="9" fontFamily="monospace">{row}</text>
      {Array.from({ length: 30 }, (_, col) => <g key={col} className={wireMode ? 'board-hole connectable' : 'board-hole'} onPointerDown={e => { if (wireMode) { e.stopPropagation(); onTerminal?.(`${id}:${row}:${col}`); } }}>
        <rect x={-250.5 + col * 19} y={rowYs[ri] - 3.5} width="7" height="7" rx="1.8" fill="#d5d8cf"/>
        <rect x={-249 + col * 19} y={rowYs[ri] - 2} width="4" height="4" rx=".9" fill="#737b6d"/>
        <rect x={-253 + col * 19} y={rowYs[ri] - 7} width="12" height="14" fill="transparent"/>
      </g>)}
    </g>)}
    {[0, 4, 9, 14, 19, 24, 29].map(col => <g key={col}><text x={-247 + col * 19} y="-151" textAnchor="middle" fontSize="9" fill="#9aa18e" fontFamily="monospace">{col + 1}</text><text x={-247 + col * 19} y="158" textAnchor="middle" fontSize="9" fill="#9aa18e" fontFamily="monospace">{col + 1}</text></g>)}
    <text x="0" y="3" textAnchor="middle" fontSize="9" fontWeight="600" letterSpacing="4" fill="#a3ab98">CURRENT · BB-30</text>
  </g>;
}

export function PartGraphic({ type, active = false, effects = true, heat = false, intensity = 1, value = 1, color = '#e95f49', miniature = false, ...props }) {
  if (type === 'breadboard') return <Breadboard miniature={miniature} {...props}/>;
  const bandColors = ['#383832', '#765037', '#b94938', '#d87537', '#d7b845', '#739059', '#50799a', '#9873a5', '#92958e', '#e5e6d9'];
  const exponent = Math.floor(Math.log10(Math.max(.01, value))) - 1;
  const digits = Math.round(value / 10 ** exponent).toString().padStart(2, '0');
  const bands = [bandColors[+digits[0]], bandColors[+digits[1]], exponent < 0 ? '#b39449' : bandColors[Math.min(9, exponent)]];
  return <g>
    {heat && active && <ellipse cx="0" cy="0" rx="68" ry="50" fill="url(#heatGlow)" className="heat-haze"/>}
    {(type === 'led' || type === 'lamp') && active && effects && <g opacity={Math.max(.05, Math.min(1, intensity))}><circle cx="0" cy="-13" r={type === 'lamp' ? 86 : 68} fill="url(#lightGlow)" className="light-glow"/></g>}
    {type === 'resistor' && <g filter={miniature ? undefined : 'url(#partShadow)'}>
      <path d="M-57 0H57" stroke="url(#metal)" strokeWidth="5"/>
      <path d="M-30-10Q-36-10-36 0Q-36 10-30 10L-20 8H20L30 10Q36 10 36 0Q36-10 30-10L20-8H-20Z" fill="url(#resistorBody)" stroke="#bda67d" strokeWidth=".8"/>
      <path d="M-22-8V8" stroke={bands[0]} strokeWidth="6"/>
      <path d="M-11-8V8" stroke={bands[1]} strokeWidth="6"/>
      <path d="M2-8V8" stroke={bands[2]} strokeWidth="6"/>
      <path d="M24-9V9" stroke="#b39449" strokeWidth="4"/>
      <path d="M-28-6H29" stroke="#fff" opacity=".25" strokeWidth="2"/>
    </g>}
    {type === 'battery' && <g filter={miniature ? undefined : 'url(#partShadow)'}>
      <rect x="-44" y="-75" width="16" height="20" rx="3" fill="url(#metal)"/>
      <path d="M29-74h18l5 7-5 8H29l-5-8z" fill="url(#metal)" stroke="#828c87"/>
      <rect x="-52" y="-60" width="105" height="148" rx="10" fill="url(#batteryBody)" stroke="#222924"/>
      <path d="M-52-48q0-12 12-12h81q12 0 12 12v35H-52Z" fill="url(#copper)"/>
      <path d="M-48-43V75q0 8 8 8" stroke="white" strokeOpacity=".13" strokeWidth="2" fill="none"/>
      <text x="-33" y="-29" fill="#583d29" textAnchor="middle" fontSize="15" fontWeight="700">+</text><text x="34" y="-29" fill="#583d29" textAnchor="middle" fontSize="17">−</text>
      <text x="0" y="10" textAnchor="middle" fill="#c2cabc" fontSize="8" letterSpacing="3">CURRENT</text>
      <text x="0" y="46" textAnchor="middle" fill="#f3f4e9" fontSize="35" fontWeight="650" fontFamily="Manrope, sans-serif">{value}V</text>
      <text x="0" y="67" textAnchor="middle" fill="#929e90" fontSize="7" letterSpacing="2">POWER YOUR IDEAS</text>
    </g>}
    {type === 'led' && <g filter={miniature ? undefined : 'url(#partShadow)'}>
      <path d="M-9 6v16q0 10-10 10M9 6v16q0 10 10 10" stroke="url(#metal)" strokeWidth="4" fill="none"/>
      <path d="M-20 4v-22a20 20 0 0 1 40 0V4z" fill={color} stroke={color} strokeWidth="2"/>
      <path d="M-20 4v-22a20 20 0 0 1 40 0V4z" fill="url(#ledBody)" opacity={color === '#e95f49' ? 1 : .3}/>
      <rect x="-24" y="3" width="48" height="9" rx="4" fill={color} stroke="#ac463b" strokeWidth=".7"/>
      <path d="M-12-12q0-15 12-16" stroke="white" strokeWidth="5" opacity=".5" fill="none" strokeLinecap="round"/>
      <path d="M-7 4V-8L5-2V4M7-15V4" stroke="#853627" opacity=".35" strokeWidth="2" fill="none"/>
      {active && effects && <g opacity={Math.max(.03, Math.min(.85, intensity * .75))}><ellipse cx="0" cy="-12" rx="13" ry="16" fill="#ffe3a6" className="led-center"/></g>}
    </g>}
    {type === 'switch' && <g filter={miniature ? undefined : 'url(#partShadow)'}>
      <path d="M-38 0H38" stroke="url(#metal)" strokeWidth="5"/>
      <rect x="-32" y="-18" width="64" height="36" rx="5" fill="#c0c4bb" stroke="#a2aaa0"/>
      <rect x="-28" y="-15" width="56" height="30" rx="3" fill="#353c35"/>
      <rect x="-21" y="-9" width="42" height="18" rx="3" fill="#1a211b"/>
      <rect x={value ? 1 : -21} y="-12" width="24" height="24" rx="3" fill="#575e55" stroke="#71786b"/>
      {[7, 12, 17].map(x => <line key={x} x1={value ? x : x - 22} y1="-7" x2={value ? x : x - 22} y2="7" stroke="#8c9485" strokeWidth="1.5"/>)}
      <circle cx={value ? -13 : 13} cy="0" r="3" fill={value ? '#bfeb70' : '#a0a79b'}/>
    </g>}
    {type === 'capacitor' && <g filter={miniature ? undefined : 'url(#partShadow)'}>
      <path d="M-12 7v17l-7 8M12 7v17l7 8" fill="none" stroke="url(#metal)" strokeWidth="4"/>
      <path d="M-24-27h48v42c0 14-48 14-48 0z" fill="url(#capacitorBody)"/>
      <path d="M12-27h8v52h-8z" fill="#abb8bd"/><ellipse cy="-27" rx="24" ry="8" fill="url(#metal)" stroke="#7f9096"/><path d="m-13-31 26 8m-26 0 26-8" stroke="#9da7a6"/>
      <text x="-4" y="0" fill="#d6e4e8" fontSize="10" textAnchor="middle">{value}</text><text x="-4" y="12" fill="#d6e4e8" fontSize="8" textAnchor="middle">μF</text>
    </g>}
    {type === 'lamp' && <g filter={miniature ? undefined : 'url(#partShadow)'}>
      <path d="M-24 40V24H24V40" fill="none" stroke="url(#metal)" strokeWidth="4"/>
      <path d="M-14 13C-14 0-29-7-29-26a29 29 0 0 1 58 0c0 19-15 26-15 39z" fill={active && effects ? '#ffe6a3' : '#eee7cf'} fillOpacity=".8" stroke="#c7bfa3" strokeWidth="1.5"/>
      <path d="M-8 14-12-23l8 7 4-7 4 7 8-7-8 37" fill="none" stroke={active && effects ? '#eea435' : '#9e8c65'} strokeWidth="2"/>
      <path d="M-17-31q0-10 10-13" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <rect x="-16" y="10" width="32" height="23" rx="5" fill="url(#metal)"/>
      {[14, 20, 26].map(y => <path key={y} d={`M-16 ${y}h32`} stroke="#89938b" strokeWidth="2"/>)}
    </g>}
    {type === 'motor' && <g filter={miniature ? undefined : 'url(#partShadow)'}>
      <path d="M-40 20H40" stroke="url(#metal)" strokeWidth="5"/>
      <rect x="-32" y="-25" width="64" height="55" rx="15" fill="url(#metal)" stroke="#8c9992"/>
      <ellipse cx="0" cy="-24" rx="32" ry="11" fill="#d1d8ce" stroke="#a3ada2"/>
      <path d="M-20-2v17M20-2v17" stroke="#7b8881" strokeWidth="5"/>
      <rect x="-4" y="-43" width="8" height="23" rx="2" fill="#7d8880"/>
      <g className={active && effects ? 'motor-spin' : ''} style={{ transformOrigin: '0px -43px' }}><ellipse cy="-43" rx="29" ry="5" fill="#a9c36c" stroke="#7c954c"/><circle cy="-43" r="5" fill="#758458"/></g>
    </g>}
    {type === 'buzzer' && <g filter={miniature ? undefined : 'url(#partShadow)'}>
      <path d="M-24 28V9H24v19" stroke="url(#metal)" strokeWidth="4" fill="none"/>
      <path d="M-31-18v32c0 17 62 17 62 0v-32" fill="#303a34"/><ellipse cy="-18" rx="31" ry="18" fill="#465149" stroke="#253129"/><ellipse cy="-18" rx="9" ry="6" fill="#1c251e"/><text x="15" y="-10" fontSize="12" fill="#8a968b">+</text>
      {active && effects && <g className="sound-wave" stroke="#91ac5a" strokeWidth="2" fill="none"><path d="M-42-31q-14 14 0 28M42-31q14 14 0 28M-51-39q-22 22 0 44M51-39q22 22 0 44"/></g>}
    </g>}
  </g>;
}

export function PartThumbnail({ type, large = false, color, value }) {
  return <svg className={`part-thumbnail ${large ? 'large' : ''}`} viewBox={type === 'breadboard' ? '-370 -220 740 440' : type === 'battery' ? '-85 -95 170 205' : '-77 -55 154 112'} aria-hidden="true"><PartGraphic type={type} value={value ?? (type === 'battery' ? 9 : type === 'capacitor' ? 100 : type === 'resistor' ? 330 : 1)} miniature color={color}/></svg>;
}
