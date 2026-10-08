import React from 'react';
import { PARTS } from './parts.js';

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
    <linearGradient id="metalX" x1="0" x2="1" y1="0" y2="0"><stop stopColor="#dce0df"/><stop offset=".4" stopColor="#929d9c"/><stop offset=".55" stopColor="#eef0ed"/><stop offset="1" stopColor="#818b8a"/></linearGradient>
    <linearGradient id="darkPlastic" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#4a514c"/><stop offset=".45" stopColor="#30362f"/><stop offset="1" stopColor="#222824"/></linearGradient>
    <linearGradient id="phenolic" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#77604a"/><stop offset="1" stopColor="#4c3b2c"/></linearGradient>
    <radialGradient id="coinFace" cx=".42" cy=".36" r=".72"><stop stopColor="#fbfcfb"/><stop offset=".45" stopColor="#d9dedd"/><stop offset=".85" stopColor="#abb4b3"/><stop offset="1" stopColor="#8e9897"/></radialGradient>
    <linearGradient id="supplyCase" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#f1f2ec"/><stop offset="1" stopColor="#d2d5cb"/></linearGradient>
    <linearGradient id="supplyPanel" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#3d4540"/><stop offset="1" stopColor="#2a302c"/></linearGradient>
    <linearGradient id="lcdDark" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#1f2620"/><stop offset="1" stopColor="#111612"/></linearGradient>
    <radialGradient id="knobCap" cx=".4" cy=".35" r=".75"><stop stopColor="#6d756f"/><stop offset=".55" stopColor="#3b423d"/><stop offset="1" stopColor="#232925"/></radialGradient>
    <radialGradient id="postRed" cx=".4" cy=".35" r=".75"><stop stopColor="#f19a86"/><stop offset=".6" stopColor="#cc5341"/><stop offset="1" stopColor="#8f3226"/></radialGradient>
    <radialGradient id="postBlack" cx=".4" cy=".35" r=".75"><stop stopColor="#646c66"/><stop offset=".6" stopColor="#2d332f"/><stop offset="1" stopColor="#161a17"/></radialGradient>
    <linearGradient id="gndPost" x1="0" x2="1" y1="0" y2="0"><stop stopColor="#56743f"/><stop offset=".38" stopColor="#a1c27a"/><stop offset=".7" stopColor="#6f8f52"/><stop offset="1" stopColor="#465f35"/></linearGradient>
    <radialGradient id="ldrDisc" cx=".42" cy=".38" r=".7"><stop stopColor="#fbf6ea"/><stop offset=".7" stopColor="#ebdfc4"/><stop offset="1" stopColor="#cbb68e"/></radialGradient>
    <radialGradient id="ntcBody" cx=".36" cy=".3" r=".8"><stop stopColor="#68716b"/><stop offset=".5" stopColor="#2f3632"/><stop offset="1" stopColor="#181c19"/></radialGradient>
    <linearGradient id="copperY" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#a1643c"/><stop offset=".3" stopColor="#ebc192"/><stop offset=".58" stopColor="#cf915d"/><stop offset="1" stopColor="#87502e"/></linearGradient>
    <linearGradient id="ferrite" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#7a807d"/><stop offset=".4" stopColor="#474c4a"/><stop offset="1" stopColor="#232726"/></linearGradient>
    <linearGradient id="glassTube" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#ffffff" stopOpacity=".95"/><stop offset=".3" stopColor="#dcebe8" stopOpacity=".65"/><stop offset=".72" stopColor="#b9d0cc" stopOpacity=".65"/><stop offset="1" stopColor="#89a6a1" stopOpacity=".9"/></linearGradient>
    <radialGradient id="scorch"><stop stopColor="#2e241c" stopOpacity=".75"/><stop offset=".55" stopColor="#4c3b2c" stopOpacity=".35"/><stop offset="1" stopColor="#4c3b2c" stopOpacity="0"/></radialGradient>
    <linearGradient id="diodeBody" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#5c625e"/><stop offset=".35" stopColor="#2c312e"/><stop offset=".75" stopColor="#1b1f1d"/><stop offset="1" stopColor="#303532"/></linearGradient>
    <linearGradient id="diodeBand" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#f4f5f1"/><stop offset=".45" stopColor="#c5cbc8"/><stop offset="1" stopColor="#8d9593"/></linearGradient>
    <linearGradient id="zenerGlass" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#fad3a0" stopOpacity=".95"/><stop offset=".35" stopColor="#e88f45" stopOpacity=".9"/><stop offset=".8" stopColor="#b85b24" stopOpacity=".92"/><stop offset="1" stopColor="#cc7a3c" stopOpacity=".95"/></linearGradient>
    <linearGradient id="to92Face" x1="0" x2="1" y1="0" y2="0"><stop stopColor="#252a27"/><stop offset=".3" stopColor="#424844"/><stop offset=".7" stopColor="#2e3330"/><stop offset="1" stopColor="#1d211f"/></linearGradient>
    <linearGradient id="to92Top" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#4d5450"/><stop offset="1" stopColor="#5f6762"/></linearGradient>
    <radialGradient id="tactCap" cx=".4" cy=".34" r=".75"><stop stopColor="#f3a08b"/><stop offset=".55" stopColor="#d05946"/><stop offset="1" stopColor="#9a392b"/></radialGradient>
    <radialGradient id="tactCapPressed" cx=".5" cy=".55" r=".7"><stop stopColor="#b9513f"/><stop offset=".7" stopColor="#923628"/><stop offset="1" stopColor="#6f271d"/></radialGradient>
    <radialGradient id="speakerSurround"><stop stopColor="#232925"/><stop offset=".84" stopColor="#232925"/><stop offset=".92" stopColor="#5d655f"/><stop offset="1" stopColor="#1e2320"/></radialGradient>
    <radialGradient id="speakerCone" cx=".45" cy=".42" r=".6"><stop stopColor="#5a625c"/><stop offset=".55" stopColor="#363d38"/><stop offset=".9" stopColor="#2a302c"/><stop offset="1" stopColor="#3b423d"/></radialGradient>
    <radialGradient id="dustCap" cx=".38" cy=".32" r=".75"><stop stopColor="#8a928c"/><stop offset=".55" stopColor="#424a44"/><stop offset="1" stopColor="#262c28"/></radialGradient>
    <linearGradient id="holsterAmber" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#e6c06e"/><stop offset="1" stopColor="#b98a36"/></linearGradient>
    <linearGradient id="holsterSage" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#afc68a"/><stop offset="1" stopColor="#7b9658"/></linearGradient>
    <linearGradient id="meterFace" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#3e4640"/><stop offset="1" stopColor="#262c28"/></linearGradient>
    <linearGradient id="meterLcd" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#d9e2c3"/><stop offset="1" stopColor="#b4c198"/></linearGradient>
  </defs>;
}

const MONO = "'SFMono-Regular', Menlo, Consolas, monospace";
const BRAND = 'Manrope, sans-serif';

/** A round tinned lead along any path. Solid strokes (not a bounding-box gradient) so straight runs render too. */
function Lead({ d, w = 4 }) {
  return <g fill="none" strokeLinejoin="round">
    <path d={d} stroke="#808a89" strokeWidth={w}/>
    <path d={d} stroke="#c3cac8" strokeWidth={w * .6}/>
    <path d={d} stroke="#f5f6f3" strokeWidth={w * .22}/>
  </g>;
}

/** A flat solder lug pointing down whose tip ends exactly at (x, y). */
function Lug({ x, y, top, w = 6.6, hole }) {
  return <g>
    <path d={`M${x - w / 2} ${top}V${y - 5}L${x - w / 4} ${y}H${x + w / 4}L${x + w / 2} ${y - 5}V${top}Z`} fill="url(#metalX)" stroke="#76817f" strokeWidth=".5"/>
    {hole != null && <circle cx={x} cy={hole} r="1.4" fill="#363c38"/>}
  </g>;
}

/** Banana-socket binding post, hole centred on (x, y). */
function BindingPost({ x, y, red }) {
  const hex = [0, 60, 120, 180, 240, 300].map(a => `${(x + 7.4 * Math.cos(a * Math.PI / 180)).toFixed(2)} ${(y + 7.4 * Math.sin(a * Math.PI / 180)).toFixed(2)}`).join('L');
  return <g>
    <path d={`M${hex}Z`} fill="url(#metal)" stroke="#78827f" strokeWidth=".7"/>
    <circle cx={x} cy={y} r="5.5" fill={red ? 'url(#postRed)' : 'url(#postBlack)'} stroke={red ? '#7d2b20' : '#111412'} strokeWidth=".5"/>
    <ellipse cx={x - 1.7} cy={y - 2.3} rx="2.1" ry="1.2" fill="#fff" opacity=".35"/>
    <circle cx={x} cy={y} r="1.9" fill="#1b1714"/>
  </g>;
}

/** Multimeter-style input jack, hole centred on (x, y). */
function Jack({ x, y, red }) {
  return <g>
    <circle cx={x} cy={y} r="5.2" fill={red ? '#c9503f' : '#262b28'} stroke="#000" strokeOpacity=".3" strokeWidth=".6"/>
    <circle cx={x} cy={y} r="3.3" fill="url(#metal)"/>
    <circle cx={x} cy={y} r="1.7" fill="#161a17"/>
  </g>;
}

// Serpentine CdS track of a photoresistor, centred on the origin.
const LDR_TRACK = (() => {
  const ys = [-12, -8, -4, 0, 4, 8, 12], hw = y => Math.sqrt(15 ** 2 - y ** 2) - 1.5;
  let d = '', side = -1;
  ys.forEach((y, i) => {
    const start = i ? Math.min(hw(y), hw(ys[i - 1])) : hw(y), end = i < ys.length - 1 ? Math.min(hw(y), hw(ys[i + 1])) : hw(y);
    if (!i) d += `M${(side * start).toFixed(2)} ${y}`;
    d += `H${(-side * end).toFixed(2)}`;
    if (i < ys.length - 1) d += `A2 2 0 0 ${side < 0 ? 1 : 0} ${(-side * end).toFixed(2)} ${ys[i + 1]}`;
    side = -side;
  });
  return d;
})();

/** Multimeter display text. `reading` is in amperes (ammeter) or volts (voltmeter). */
function meterText(type, reading) {
  if (reading == null || Number.isNaN(reading)) return '--.-';
  if (!Number.isFinite(reading)) return 'OL';
  if (type === 'ammeter') {
    const a = Math.abs(reading);
    return a >= .99995 ? `${a.toFixed(2)} A` : `${(a * 1000).toFixed(1)} mA`;
  }
  return `${(Math.abs(reading) < .005 ? 0 : reading).toFixed(2)} V`;
}

function CoinCell({ value }) {
  const label = `${value}V`;
  return <>
    <path d="M-50-3.5H-38V3.5H-50Z" fill="url(#metal)" stroke="#7d8886" strokeWidth=".6"/>
    <path d="M50-3.5H38V3.5H50Z" fill="url(#metal)" stroke="#7d8886" strokeWidth=".6"/>
    <rect x="-42" y="-38" width="84" height="76" rx="18" fill="url(#darkPlastic)" stroke="#1c211e"/>
    <path d="M-36-20Q-36-34-22-34H22" stroke="#fff" strokeOpacity=".12" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <circle cx="2" cy="0" r="33" fill="#191e1b"/>
    <rect x="36" y="-6" width="6" height="12" rx="1.2" fill="#191e1b"/>
    <circle cx="2" cy="0" r="30.5" fill="url(#coinFace)" stroke="#87918f" strokeWidth=".8"/>
    <circle cx="2" cy="0" r="27" fill="none" stroke="#fff" strokeOpacity=".6"/>
    <circle cx="2" cy="0" r="26.2" fill="none" stroke="#8f9998" strokeOpacity=".55" strokeWidth=".6"/>
    <text x="14" y="-11" textAnchor="middle" fontSize="5.5" fontWeight="650" fill="#6f7977" letterSpacing=".6">CR2032</text>
    <text x="14" y="9" textAnchor="middle" fontSize={label.length > 3 ? 12 : 15} fontWeight="700" fill="#4d5756" fontFamily={BRAND}>{label}</text>
    <text x="14" y="16.5" textAnchor="middle" fontSize="3.6" fill="#7c8684" letterSpacing=".9">LITHIUM</text>
    <path d="M-46-7.5H-13Q-5-7.5-5 0Q-5 7.5-13 7.5H-46Z" fill="url(#metal)" stroke="#76817f" strokeWidth=".7"/>
    <path d="M-41-4.6H-13" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="-12" cy="0" r="2.2" fill="#a3acab" stroke="#76817f" strokeWidth=".5"/>
    <text x="-30" y="-15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#aeb7aa">+</text>
    <text x="36.5" y="-16" textAnchor="middle" fontSize="10" fontWeight="700" fill="#aeb7aa">−</text>
  </>;
}

function PowerSupply({ value, active }) {
  const volts = Number(value), shown = Number.isFinite(volts) ? volts.toFixed(1) : '--.-';
  const knob = -135 + 270 * Math.max(0, Math.min(1, (Number.isFinite(volts) ? volts : 0) / 30));
  return <>
    <rect x="-78" y="-56" width="156" height="112" rx="9" fill="url(#supplyCase)" stroke="#b1b6aa"/>
    <path d="M-69-54.3H69" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="-71" y="-49" width="142" height="68" rx="5" fill="url(#supplyPanel)" stroke="#232924"/>
    <rect x="-64" y="-42" width="88" height="36" rx="3" fill="url(#lcdDark)" stroke="#0b0e0c"/>
    <text x="12" y="-15" textAnchor="end" fontSize="21" fontWeight="700" fontFamily={MONO} fill="#c6ee7e" fillOpacity=".07">{shown.replace(/[0-9-]/g, '8')}</text>
    <text x="12" y="-15" textAnchor="end" fontSize="21" fontWeight="700" fontFamily={MONO} fill="#c6ee7e">{shown}</text>
    <text x="14" y="-15" fontSize="10" fontWeight="700" fontFamily={MONO} fill="#c6ee7e">V</text>
    <text x="-59" y="-34" fontSize="4.5" fontWeight="700" fill="#c6ee7e" fillOpacity=".6" letterSpacing=".5">CV</text>
    <path d="M-62-40.5H22" stroke="#fff" strokeOpacity=".06" strokeWidth="1.2"/>
    <circle cx="48" cy="-24" r="18" fill="#1b201c"/>
    {Array.from({ length: 28 }, (_, i) => <path key={i} d="M48-42V-38.5" transform={`rotate(${i * 360 / 28} 48 -24)`} stroke="#3c433e" strokeWidth="1.5"/>)}
    <circle cx="48" cy="-24" r="13.5" fill="url(#knobCap)" stroke="#141815" strokeWidth=".6"/>
    <path d="M48-28V-35" transform={`rotate(${knob} 48 -24)`} stroke="#e9ecdf" strokeWidth="2.2" strokeLinecap="round"/>
    <text x="-20" y="9" textAnchor="middle" fontSize="6.5" fontWeight="650" fill="#a1ab9c" letterSpacing="2.6">CURRENT</text>
    <text x="-20" y="15" textAnchor="middle" fontSize="3.8" fill="#7f8a7c" letterSpacing="1.2">DC POWER SUPPLY</text>
    <text x="48" y="9" textAnchor="middle" fontSize="4.2" fill="#8a9586" letterSpacing="1">VOLTAGE</text>
    <text x="48" y="15" textAnchor="middle" fontSize="3.8" fill="#7f8a7c" letterSpacing=".8">0–30 V</text>
    <text x="0" y="38" textAnchor="middle" fontSize="4.6" fontWeight="600" fill="#8a9285" letterSpacing="1.4">OUTPUT</text>
    <text x="-28" y="37.5" textAnchor="middle" fontSize="8" fontWeight="750" fill="#c0503f">+</text>
    <text x="28" y="37.5" textAnchor="middle" fontSize="8" fontWeight="750" fill="#3a403c">−</text>
    <rect x="-68" y="31" width="14" height="17" rx="2.2" fill="#2a302c"/>
    <path d="M-66 33H-56V39.5H-66Z" fill="#4c544f"/><path d="M-66 39.5H-56V46H-66Z" fill="#383f3a"/>
    <path d="M-61 34.5V38" stroke="#d6dccf" strokeWidth="1" strokeLinecap="round"/>
    {active && <circle cx="61" cy="39.5" r="6" fill="#bfeb70" opacity=".3"/>}
    <circle cx="61" cy="39.5" r="3" fill={active ? '#bfeb70' : '#9aa78e'} stroke="#6f7c63" strokeWidth=".5"/>
    <BindingPost x={-28} y={48} red/>
    <BindingPost x={28} y={48}/>
  </>;
}

function GroundPost() {
  return <>
    <rect x="-26" y="10" width="52" height="18" rx="5" fill="url(#darkPlastic)" stroke="#1c211e"/>
    <path d="M-21 13H21" stroke="#fff" strokeOpacity=".1" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M-15.5 13.2V16.5M-20.5 16.5h10M-18.6 19.5h6.2M-16.8 22.5h2.6" stroke="#b9cf95" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    <text x="5.5" y="22.6" textAnchor="middle" fontSize="9" fontWeight="750" fill="#e4e9dc" letterSpacing=".8" fontFamily={BRAND}>GND</text>
    <path d="M-13 2H13V10.5H-13Z" fill="url(#metal)" stroke="#76817f" strokeWidth=".6"/>
    <path d="M-6.5 2V10.5M6.5 2V10.5" stroke="#76817f" strokeWidth=".6"/>
    <path d="M-10.5-19V1.5Q-10.5 3-9 3H9Q10.5 3 10.5 1.5V-19Z" fill="url(#gndPost)" stroke="#4b6538" strokeWidth=".5"/>
    {[-7, -3.5, 0, 3.5, 7].map(x => <path key={x} d={`M${x}-16V0`} stroke="#2f4224" strokeOpacity=".28" strokeWidth="1"/>)}
    <ellipse cx="0" cy="-19" rx="10.5" ry="3.2" fill="#aecb8b" stroke="#6f8d52" strokeWidth=".5"/>
    <ellipse cx="0" cy="-19" rx="4" ry="1.3" fill="#3f5631"/>
    <rect x="-2.6" y="-30" width="5.2" height="11" fill="url(#metalX)"/>
    <circle cx="0" cy="-30" r="4.4" fill="url(#metal)" stroke="#76817f" strokeWidth=".6"/>
    <circle cx="0" cy="-30" r="1.7" fill="#2d332f"/>
  </>;
}

function Potentiometer({ position }) {
  const p = Number.isFinite(+position) ? Math.max(0, Math.min(100, +position)) : 50;
  return <>
    <rect x="-31" y="12" width="62" height="14" rx="3" fill="url(#phenolic)" stroke="#3b2e22" strokeWidth=".5"/>
    {[-24, 0, 24].map(x => <Lug key={x} x={x} y={42} top={20} hole={29}/>)}
    <circle cx="0" cy="-8" r="33" fill="url(#metal)" stroke="#7a8482"/>
    <circle cx="0" cy="-8" r="30.5" fill="none" stroke="#fff" strokeOpacity=".35"/>
    {Array.from({ length: 11 }, (_, i) => <path key={i} d="M0-39V-34.5" transform={`rotate(${-135 + i * 27} 0 -8)`} stroke="#4f5856" strokeWidth={i % 5 ? 1 : 1.7} strokeLinecap="round"/>)}
    <circle cx="0" cy="-8" r="23" fill="#202622"/>
    {Array.from({ length: 32 }, (_, i) => <path key={i} d="M0-31V-28" transform={`rotate(${i * 11.25} 0 -8)`} stroke="#4c544e" strokeWidth="1.4"/>)}
    <circle cx="0" cy="-8" r="18.5" fill="url(#knobCap)" stroke="#151916" strokeWidth=".6"/>
    <path d="M0-13V-23.5" transform={`rotate(${-135 + 2.7 * p} 0 -8)`} stroke="#f1eee2" strokeWidth="2.8" strokeLinecap="round"/>
  </>;
}

function Photoresistor({ lit }) {
  return <>
    <Lead d="M-7 6V20Q-7 34-19 34"/>
    <Lead d="M7 6V20Q7 34 19 34"/>
    <circle cx="0" cy="-10" r="22" fill="url(#ldrDisc)" stroke="#b7a37c"/>
    <circle cx="0" cy="-10" r="18.5" fill={lit ? '#e8e6dc' : '#d8d6cb'} stroke="#c3b693" strokeWidth=".6"/>
    <path d={LDR_TRACK} transform="translate(0 -10)" fill="none" stroke={lit ? '#e2733f' : '#c05d39'} strokeWidth="2.3" strokeLinecap="round"/>
    <path d="M-14-23Q-8-29 0-29.5" stroke="#fff" strokeOpacity=".75" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
    {lit && <circle cx="0" cy="-10" r="18.5" fill="#fff4cf" opacity=".22"/>}
  </>;
}

function Thermistor() {
  return <>
    <Lead d="M-3.5 0V14Q-3.5 34-19 34" w={3.4}/>
    <Lead d="M3.5 0V14Q3.5 34 19 34" w={3.4}/>
    <path d="M0-32C10-32 14.5-24 14.5-16C14.5-7 9-1.5 5.2 2.5Q4.2 4 4.2 7H-4.2Q-4.2 4-5.2 2.5C-9-1.5-14.5-7-14.5-16C-14.5-24-10-32 0-32Z" fill="url(#ntcBody)" stroke="#141815" strokeWidth=".6"/>
    <ellipse cx="-5.5" cy="-23" rx="4.6" ry="2.5" transform="rotate(-32 -5.5 -23)" fill="#fff" opacity=".38"/>
    <text x="0" y="-11" textAnchor="middle" fontSize="5.6" fontWeight="650" fill="#808a82">103</text>
  </>;
}

function Inductor() {
  return <>
    <Lead d="M-57 0H-36"/><Lead d="M36 0H57"/>
    <rect x="-38" y="-17" width="7.5" height="34" rx="2" fill="url(#ferrite)" stroke="#1f2321" strokeWidth=".5"/>
    <rect x="30.5" y="-17" width="7.5" height="34" rx="2" fill="url(#ferrite)" stroke="#1f2321" strokeWidth=".5"/>
    <path d="M-36.3-15V15M32.2-15V15" stroke="#fff" strokeOpacity=".18" strokeWidth="1.2"/>
    <rect x="-31" y="-14" width="62" height="28" rx="2.5" fill="url(#copperY)"/>
    {Array.from({ length: 21 }, (_, i) => <path key={i} d={`M${-30 + i * 3}-14L${-28.6 + i * 3} 14`} stroke="#743f22" strokeOpacity=".42" strokeWidth=".9"/>)}
    <path d="M-30-8.5H30" stroke="#fff" strokeOpacity=".3" strokeWidth="2.4"/>
    <path d="M-30 9.5H30" stroke="#5a2d16" strokeOpacity=".16" strokeWidth="3"/>
  </>;
}

function Fuse({ blown }) {
  return <>
    <Lead d="M-57 0H-42"/><Lead d="M42 0H57"/>
    <rect x="-30" y="-8" width="60" height="16" fill="url(#glassTube)" stroke="#86a09b" strokeOpacity=".9" strokeWidth=".7"/>
    {blown ? <g>
      <ellipse cx="0" cy=".5" rx="17" ry="7" fill="url(#scorch)"/>
      <path d="M-30 .6C-21-.3-13 1.2-5.5 .3M30 .6C21-.3 13 1 6 .1" stroke="#6f6658" strokeWidth="1" fill="none"/>
      <circle cx="-5" cy=".3" r="1.2" fill="#3b3128"/><circle cx="5.6" cy=".1" r="1" fill="#3b3128"/>
      <circle cx="-1.5" cy="-3.2" r=".7" fill="#2e241c" opacity=".55"/><circle cx="2.5" cy="3" r=".6" fill="#2e241c" opacity=".5"/>
    </g> : <path d="M-30 .6C-18-.6-10 1.4 0 0S18-.8 30 .6" stroke="#6f6658" strokeWidth="1" fill="none"/>}
    <path d="M-28.5-5H28.5" stroke="#fff" strokeOpacity=".75" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M-28.5 5.6H28.5" stroke="#fff" strokeOpacity=".3" strokeLinecap="round"/>
    <rect x="-44" y="-10" width="15" height="20" rx="2.5" fill="url(#metal)" stroke="#78837f" strokeWidth=".6"/>
    <rect x="29" y="-10" width="15" height="20" rx="2.5" fill="url(#metal)" stroke="#78837f" strokeWidth=".6"/>
    <path d="M-32.5-10V10M32.5-10V10" stroke="#7f8988" strokeWidth=".8"/>
  </>;
}

function Diode() {
  return <>
    <Lead d="M-57 0H-20"/><Lead d="M20 0H57"/>
    <rect x="-22" y="-9" width="44" height="18" rx="4.5" fill="url(#diodeBody)" stroke="#111412" strokeWidth=".5"/>
    <rect x="11" y="-9" width="6" height="18" fill="url(#diodeBand)"/>
    <path d="M-18.5-5H18.5" stroke="#fff" strokeOpacity=".16" strokeWidth="2" strokeLinecap="round"/>
    <text x="-4" y="2" textAnchor="middle" fontSize="5.2" fontWeight="600" fill="#9aa29c" letterSpacing=".3">1N4001</text>
  </>;
}

function Zener() {
  return <>
    <Lead d="M-57 0H-14"/><Lead d="M14 0H57"/>
    <rect x="-18" y="-7.5" width="36" height="15" rx="5" fill="url(#zenerGlass)" stroke="#9c4c1d" strokeOpacity=".6" strokeWidth=".6"/>
    <path d="M-14 0H-3M3 0H9" stroke="#e1e4df" strokeOpacity=".7" strokeWidth="3"/>
    <rect x="-2.7" y="-2.7" width="5.4" height="5.4" rx=".6" fill="#4a3424"/>
    <rect x="8" y="-7.5" width="5" height="15" fill="#262a27"/>
    <path d="M-14.5-3.7H14.5" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round"/>
  </>;
}

function Transistor({ pnp }) {
  return <>
    <Lead d="M-9 8V16Q-9 21-14.5 24.5Q-20 28-20 33V42" w={3.4}/>
    <Lead d="M0 8V42" w={3.4}/>
    <Lead d="M9 8V16Q9 21 14.5 24.5Q20 28 20 33V42" w={3.4}/>
    <path d="M-22-24A22 9 0 0 1 22-24Z" fill="url(#to92Top)" stroke="#191d1a" strokeWidth=".6"/>
    <path d="M-22-24H22V9Q22 12 19 12H-19Q-22 12-22 9Z" fill="url(#to92Face)" stroke="#151916" strokeWidth=".6"/>
    <path d="M-20.5-23H20.5" stroke="#fff" strokeOpacity=".14"/>
    <text x="0" y="-9" textAnchor="middle" fontSize="7" fontWeight="650" fill="#a7afa4" letterSpacing=".2">{pnp ? '2N3906' : '2N2222'}</text>
    <text x="0" y="-1.5" textAnchor="middle" fontSize="4.4" fill="#7f877d" letterSpacing="1">{pnp ? 'PNP' : 'NPN'}</text>
    {[['E', -9], ['B', 0], ['C', 9]].map(([l, x]) => <text key={l} x={x} y="8.6" textAnchor="middle" fontSize="4.2" fontWeight="600" fill="#6b736b">{l}</text>)}
  </>;
}

function ToggleSwitch({ value }) {
  return <>
    {[-30, 0, 30].map(x => <Lug key={x} x={x} y={32} top={14} hole={21.5}/>)}
    <rect x="-38" y="2" width="76" height="16" rx="2.5" fill="url(#darkPlastic)" stroke="#1b201c"/>
    <text x="-30" y="14" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#b4bcaf">A</text>
    <text x="30" y="14" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#b4bcaf">B</text>
    <text x="0" y="13.4" textAnchor="middle" fontSize="4" fill="#8b9488" letterSpacing=".8">COM</text>
    <rect x="-35" y="-8" width="70" height="11" rx="1.5" fill="url(#metal)" stroke="#78837f" strokeWidth=".7"/>
    <path d="M-14-13H14V-8H-14Z" fill="url(#metal)" stroke="#76817f" strokeWidth=".6"/>
    <path d="M-7-13V-8M7-13V-8" stroke="#7f8988" strokeWidth=".6"/>
    <rect x="-8.5" y="-21" width="17" height="8" fill="url(#metalX)" stroke="#78837f" strokeWidth=".5"/>
    <path d="M-8.5-18.6H8.5M-8.5-16.4H8.5M-8.5-14.2H8.5" stroke="#6f7978" strokeOpacity=".6" strokeWidth=".6"/>
    <g transform={`rotate(${value ? 24 : -24} 0 -20)`}>
      <path d="M-3-20L-1.9-38H1.9L3-20Z" fill="url(#metalX)" stroke="#727c7a" strokeWidth=".5"/>
      <circle cx="0" cy="-38.5" r="3" fill="url(#metal)" stroke="#727c7a" strokeWidth=".5"/>
    </g>
    <ellipse cx="0" cy="-21" rx="6" ry="2.2" fill="#a7b0ae" stroke="#76817f" strokeWidth=".5"/>
  </>;
}

function PushButton({ pressed }) {
  return <>
    <rect x="-36" y="-2.2" width="13" height="4.4" fill="url(#metal)" stroke="#78837f" strokeWidth=".4"/>
    <rect x="23" y="-2.2" width="13" height="4.4" fill="url(#metal)" stroke="#78837f" strokeWidth=".4"/>
    <rect x="-24" y="-24" width="48" height="48" rx="3.5" fill="url(#darkPlastic)" stroke="#191e1a"/>
    <rect x="-21.5" y="-21.5" width="43" height="43" rx="2" fill="url(#metal)" stroke="#76817f" strokeWidth=".6"/>
    {[[-16, -16], [16, -16], [-16, 16], [16, 16]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" fill="#8c9694" stroke="#6f7977" strokeWidth=".4"/>)}
    <circle cx="0" cy="0" r="15" fill="#1e2420"/>
    <circle cx="0" cy="0" r="14" fill="#2f3632"/>
    {pressed ? <>
      <circle cx="0" cy=".8" r="11.2" fill="url(#tactCapPressed)"/>
      <circle cx="0" cy=".8" r="10.6" fill="none" stroke="#000" strokeOpacity=".25" strokeWidth="1.4"/>
    </> : <>
      <circle cx=".5" cy="1.6" r="12.4" fill="#000" opacity=".28"/>
      <circle cx="0" cy="0" r="12.4" fill="url(#tactCap)" stroke="#8a3427" strokeWidth=".5"/>
      <path d="M-7.6-5.4Q-4-9.6 1-9.6" stroke="#fff" strokeOpacity=".5" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
    </>}
  </>;
}

function Speaker({ waves }) {
  return <>
    {[-20, 20].map(x => <Lug key={x} x={x} y={46} top={30} hole={41}/>)}
    <rect x="-29" y="30" width="58" height="11.5" rx="2" fill="url(#phenolic)" stroke="#3b2e22" strokeWidth=".5"/>
    <circle cx="-11.5" cy="39.6" r="1.4" fill="#d0533f"/>
    <rect x="-43" y="-48" width="86" height="86" rx="16" fill="url(#metal)" stroke="#7b8583"/>
    {[[-35, -40], [35, -40], [-35, 30], [35, 30]].map(([x, y]) => <g key={`${x}${y}`}><circle cx={x} cy={y} r="2.6" fill="#5b6461"/><path d={`M${x - 1.6} ${y + 1.4}a2.3 2.3 0 0 0 3.4 0`} stroke="#fff" strokeOpacity=".5" strokeWidth=".6" fill="none"/></g>)}
    <circle cx="0" cy="-5" r="38.5" fill="url(#speakerSurround)"/>
    <circle cx="0" cy="-5" r="32" fill="url(#speakerCone)"/>
    <circle cx="0" cy="-5" r="25" fill="none" stroke="#fff" strokeOpacity=".07"/>
    <circle cx="0" cy="-5" r="18" fill="none" stroke="#fff" strokeOpacity=".07"/>
    <circle cx="0" cy="-5" r="11.5" fill="url(#dustCap)" stroke="#1b201c" strokeWidth=".5"/>
    <ellipse cx="-3.5" cy="-10" rx="4.4" ry="2.3" transform="rotate(-25 -3.5 -10)" fill="#fff" opacity=".22"/>
    {waves && <g className="sound-wave" stroke="#91ac5a" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M-50-24q-9 19 0 38M50-24q9 19 0 38M-57-34q-15 29 0 58M57-34q15 29 0 58"/></g>}
  </>;
}

function Meter({ type, reading }) {
  const amps = type === 'ammeter', text = meterText(type, reading);
  return <>
    <rect x="-47" y="-43" width="94" height="93" rx="12" fill={amps ? 'url(#holsterAmber)' : 'url(#holsterSage)'} stroke={amps ? '#9c742c' : '#66804a'}/>
    <rect x="-44.5" y="-40.5" width="89" height="88" rx="10" fill="none" stroke="#fff" strokeOpacity=".28"/>
    <rect x="-40" y="-36" width="80" height="70" rx="7" fill="url(#meterFace)" stroke="#1d221e"/>
    <rect x="-35" y="-31" width="70" height="27" rx="3" fill="#1a201c"/>
    <rect x="-33" y="-29" width="66" height="23" rx="2" fill="url(#meterLcd)"/>
    <text x="30.5" y="-12.5" textAnchor="end" fontSize={Math.min(13, 60 / (text.length * .6))} fontWeight="700" fontFamily={MONO} fill="#27311f">{text}</text>
    <circle cx="0" cy="15" r="11" fill="#20261f" stroke="#5d665f"/>
    <text x="0" y="20" textAnchor="middle" fontSize="14" fontWeight="750" fill="#eef1e6" fontFamily={BRAND}>{amps ? 'A' : 'V'}</text>
    <text x="-25" y="17" textAnchor="middle" fontSize="5.5" fontWeight="600" fill="#8d988a" letterSpacing=".6">DC</text>
    <text x="25" y="17" textAnchor="middle" fontSize="4.6" fontWeight="600" fill="#8d988a" letterSpacing=".6">{amps ? 'AMPS' : 'VOLTS'}</text>
    <Jack x={-24} y={44} red/>
    <Jack x={24} y={44}/>
    <text x="-37" y="47" textAnchor="middle" fontSize="8" fontWeight="750" fill="#fff" fillOpacity=".85">+</text>
    <text x="37" y="47" textAnchor="middle" fontSize="8" fontWeight="750" fill="#fff" fillOpacity=".85">−</text>
  </>;
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

export function PartGraphic({ type, active = false, effects = true, heat = false, intensity = 1, value = 1, color = '#e95f49', miniature = false, position = 50, reading, pressed = false, blown = false, ...props }) {
  if (type === 'breadboard') return <Breadboard miniature={miniature} {...props}/>;
  const bandColors = ['#383832', '#765037', '#b94938', '#d87537', '#d7b845', '#739059', '#50799a', '#9873a5', '#92958e', '#e5e6d9'];
  const exponent = Math.floor(Math.log10(Math.max(.01, value))) - 1;
  const digits = Math.round(value / 10 ** exponent).toString().padStart(2, '0');
  const bands = [bandColors[+digits[0]], bandColors[+digits[1]], exponent < 0 ? '#b39449' : bandColors[Math.min(9, exponent)]];
  return <g>
    {heat && active && <ellipse cx="0" cy="0" rx="68" ry="50" fill="url(#heatGlow)" className="heat-haze"/>}
    {(type === 'led' || type === 'lamp') && active && effects && <g opacity={Math.max(.05, Math.min(1, intensity))}><circle cx="0" cy="-13" r={type === 'lamp' ? 86 : 68} fill="url(#lightGlow)" className="light-glow"/></g>}
    {type === 'resistor' && <g filter={miniature ? undefined : 'url(#partShadow)'}>
      <rect x="-57" y="-2.5" width="114" height="5" fill="url(#metal)"/>
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
      <rect x="-38" y="-2.5" width="76" height="5" fill="url(#metal)"/>
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
      <rect x="-40" y="17.5" width="80" height="5" fill="url(#metal)"/>
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
    {NEW_ART[type] && <g filter={miniature ? undefined : 'url(#partShadow)'}>{NEW_ART[type]({ type, value, active, effects, position, reading, pressed, blown })}</g>}
  </g>;
}

const NEW_ART = {
  cell: p => <CoinCell value={p.value}/>,
  supply: p => <PowerSupply value={p.value} active={p.active}/>,
  ground: () => <GroundPost/>,
  potentiometer: p => <Potentiometer position={p.position}/>,
  ldr: p => <Photoresistor lit={p.active && p.effects}/>,
  thermistor: () => <Thermistor/>,
  inductor: () => <Inductor/>,
  fuse: p => <Fuse blown={p.blown}/>,
  diode: () => <Diode/>,
  zener: () => <Zener/>,
  npn: () => <Transistor/>,
  pnp: () => <Transistor pnp/>,
  spdt: p => <ToggleSwitch value={p.value}/>,
  pushbutton: p => <PushButton pressed={p.pressed}/>,
  speaker: p => <Speaker waves={p.active && p.effects}/>,
  ammeter: p => <Meter type="ammeter" reading={p.reading}/>,
  voltmeter: p => <Meter type="voltmeter" reading={p.reading}/>,
};

const LEGACY_VIEWBOXES = { breadboard: '-370 -220 740 440', battery: '-85 -95 170 205' };
const LEGACY_TYPES = new Set(['resistor', 'led', 'switch', 'capacitor', 'lamp', 'motor', 'buzzer']);

function thumbnailViewBox(type) {
  if (LEGACY_VIEWBOXES[type]) return LEGACY_VIEWBOXES[type];
  const box = PARTS[type]?.model?.box;
  if (LEGACY_TYPES.has(type) || !box) return '-77 -55 154 112';
  const [x1, y1, x2, y2] = box, padX = (x2 - x1) * .13, padY = (y2 - y1) * .13;
  return [x1 - padX, y1 - padY, x2 - x1 + 2 * padX, y2 - y1 + 2 * padY].map(n => +n.toFixed(2)).join(' ');
}

export function PartThumbnail({ type, large = false, color, value, ...props }) {
  return <svg className={`part-thumbnail ${large ? 'large' : ''}`} viewBox={thumbnailViewBox(type)} aria-hidden="true"><PartGraphic type={type} value={value ?? PARTS[type]?.value ?? 1} miniature color={color} {...props}/></svg>;
}
