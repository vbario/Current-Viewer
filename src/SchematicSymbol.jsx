import React from 'react';
import { PARTS } from './parts.js';

const FONT = "'DM Sans', 'Helvetica Neue', Arial, sans-serif";
const r2 = n => Math.round(n * 100) / 100;

/** ANSI zig-zag along y = 0 from x1 to x2 with n peaks. */
const zigzag = (x1, x2, amp = 8, n = 6) => {
  const step = (x2 - x1) / n;
  return `M${x1} 0` + Array.from({ length: n }, (_, i) => `L${x1 + step * (i + .5)} ${i % 2 ? amp : -amp}`).join('') + `L${x2} 0`;
};
const leads = gap => `M-40 0H${-gap}M${gap} 0H40`;
const RESISTOR = leads(24) + zigzag(-24, 24);

/** Filled arrowhead with its tip at (x2, y2), pointing away from (x1, y1). */
function head(x1, y1, x2, y2, size = 7) {
  const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const bx = x2 - ux * size, by = y2 - uy * size, w = size * .45;
  return `M${r2(x2)} ${r2(y2)}L${r2(bx - uy * w)} ${r2(by + ux * w)}L${r2(bx + uy * w)} ${r2(by - ux * w)}Z`;
}

function Arrow({ from: [x1, y1], to: [x2, y2], size = 6, color, sw }) {
  const len = Math.hypot(x2 - x1, y2 - y1), k = (len - size * .6) / len;
  return <g stroke={color}>
    <path d={`M${x1} ${y1}L${r2(x1 + (x2 - x1) * k)} ${r2(y1 + (y2 - y1) * k)}`}/>
    <path d={head(x1, y1, x2, y2, size)} fill={color || 'currentColor'} strokeWidth={sw / 2}/>
  </g>;
}

/** Text that stays upright when the symbol is rotated. */
const Label = ({ x = 0, y = 0, rotation = 0, size = 12, weight = 600, children }) =>
  <text x={x} y={y} transform={rotation ? `rotate(${-rotation} ${x} ${y})` : undefined} fill="currentColor" stroke="none" fontFamily={FONT}
    fontSize={size} fontWeight={weight} textAnchor="middle" dominantBaseline="central">{children}</text>;

const Dot = ({ x, y, r = 2.5 }) => <circle cx={x} cy={y} r={r} fill="currentColor" stroke="none"/>;

const Meter = ({ letter, rotation, plus = false }) => <>
  <path d={leads(18)}/><circle r="18"/>
  <Label rotation={rotation} size={16}>{letter}</Label>
  {plus && <Label x={-29} y={-9} rotation={rotation} size={12}>+</Label>}
</>;

const diode = 'M-40 0H-10M10 0H40M-10 -12L10 0L-10 12Z';

const SYMBOLS = {
  battery: ({ rotation, sw }) => <>
    <path d="M0 -40V-12M0 12V40M-16 -12H16M-16 4H16"/>
    <path d="M-8 -4H8M-8 12H8" strokeWidth={sw * 2} strokeLinecap="butt"/>
    <Label x={16} y={-22} rotation={rotation}>+</Label>
  </>,
  cell: ({ rotation, sw }) => <>
    <path d="M0 -40V-4M0 4V40M-16 -4H16"/>
    <path d="M-8 4H8" strokeWidth={sw * 2} strokeLinecap="butt"/>
    <Label x={16} y={-14} rotation={rotation}>+</Label>
  </>,
  supply: ({ rotation }) => <>
    <path d="M0 -40V-20M0 20V40"/><circle r="20"/>
    <Label y={-9} rotation={rotation} size={16}>+</Label>
    <Label y={9} rotation={rotation} size={16}>−</Label>
  </>,
  ground: () => <path d="M0 -20V0M-16 0H16M-10 6H10M-4 12H4"/>,
  resistor: () => <path d={RESISTOR}/>,
  potentiometer: ({ position, sw }) => {
    const x = r2(Math.max(-16, Math.min(16, ((position ?? 50) - 50) * .32)));
    return <>
      <path d={RESISTOR}/>
      <path d={`M0 -40V-26H${x}`}/>
      <Arrow from={[x, -26]} to={[x, -10]} size={7} sw={sw}/>
    </>;
  },
  ldr: ({ sw }) => <>
    <path d={RESISTOR}/>
    <Arrow from={[-18, -32]} to={[-8, -15]} sw={sw}/>
    <Arrow from={[-4, -32]} to={[6, -15]} sw={sw}/>
  </>,
  thermistor: ({ rotation }) => <>
    <path d={RESISTOR}/>
    <path d="M-26 17H-17L17 -19"/>
    <Label x={-25} y={-15} rotation={rotation} size={10} weight={500}>−t°</Label>
  </>,
  capacitor: () => <path d="M-40 0H-4M4 0H40M-4 -16V16M4 -16V16"/>,
  inductor: () => <path d={`M-40 0H-28${'a7 7 0 0 1 14 0'.repeat(4)}H40`}/>,
  fuse: ({ blown }) => <>
    <rect x="-20" y="-6" width="40" height="12" rx="1"/>
    <path d={blown ? 'M-40 0H-6L-2 -4M40 0H6L2 4' : 'M-40 0H40'}/>
  </>,
  diode: () => <path d={`${diode}M10 -12V12`}/>,
  zener: () => <path d={`${diode}M5 -14L10 -12V12L15 14`}/>,
  led: ({ active, color, sw }) => {
    const glow = active ? color : undefined;
    return <>
      <path d={diode} fill={glow || 'none'}/>
      <path d="M10 -12V12"/>
      <Arrow from={[-1, -16]} to={[11, -30]} color={glow} sw={sw}/>
      <Arrow from={[7, -16]} to={[19, -30]} color={glow} sw={sw}/>
    </>;
  },
  npn: ({ sw }) => <Transistor sw={sw}/>,
  pnp: ({ sw }) => <Transistor sw={sw} pnp/>,
  switch: ({ value }) => <>
    <path d={`${leads(18)}M-18 0L${value ? '18.5 -3.5' : '12 -18'}`}/>
    <Dot x={-18} y={0}/><Dot x={18} y={0}/>
  </>,
  spdt: ({ value }) => <>
    <path d={`M-40 0H-16M16 -20H40M16 20H40M-16 0L${value ? '14 17' : '14 -17'}`}/>
    <Dot x={-16} y={0}/><Dot x={16} y={-20}/><Dot x={16} y={20}/>
  </>,
  pushbutton: ({ pressed }) => {
    const y = pressed ? -4 : -11;
    return <>
      <path d={`${leads(16)}M-20 ${y}H20M0 ${y}V${y - 12}M-7 ${y - 12}H7`}/>
      <Dot x={-16} y={0}/><Dot x={16} y={0}/>
    </>;
  },
  lamp: ({ active }) => <>
    <path d={leads(18)}/>
    <circle r="18" fill={active ? '#ffd27a' : 'none'} fillOpacity={active ? .5 : undefined}/>
    <path d="M-12.73 -12.73L12.73 12.73M12.73 -12.73L-12.73 12.73"/>
  </>,
  motor: ({ rotation }) => <Meter letter="M" rotation={rotation}/>,
  buzzer: () => <path d="M-40 0H-8V-8M40 0H8V-8M-20 -8H20M-15 -8A15 15 0 0 1 15 -8"/>,
  speaker: () => <path d={`${leads(6)}M-6 -8H6V8H-6ZM-6 -8L-19 -26H19L6 -8`}/>,
  ammeter: ({ rotation }) => <Meter letter="A" rotation={rotation} plus/>,
  voltmeter: ({ rotation }) => <Meter letter="V" rotation={rotation} plus/>,
};

/** BJT matching the 20-unit grid: C (20,-40), B (-40,0), E (20,40). */
function Transistor({ pnp = false, sw }) {
  return <>
    <circle cx="10" r="22"/>
    <path d="M-40 0H5M5 -5L20 -20V-40M5 5L20 20V40"/>
    <path d="M5 -14V14" strokeWidth={sw * 1.75}/>
    <path d={pnp ? head(15, 15, 7, 7, 8) : head(7, 7, 17, 17, 8)} fill="currentColor" strokeWidth={sw / 2}/>
  </>;
}

/** Classic schematic symbol for a part, centred on the origin. Colour follows CSS `color`. */
export function SchematicSymbol({ type, value, color, position, active = false, pressed = false, blown = false, rotation = 0, strokeWidth = 2 }) {
  const Symbol = SYMBOLS[type];
  if (!Symbol) return null;
  return <g fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Symbol value={value} color={color ?? PARTS[type]?.color} position={position} active={active} pressed={pressed} blown={blown} rotation={rotation} sw={strokeWidth}/>
  </g>;
}

const BOARD_DOTS = Array.from({ length: 24 }, (_, i) => [-25 + (i % 6) * 10, [-21, -11, 11, 21][Math.floor(i / 6)]]);

/** Thumbnails fit the padded symbol box; the stroke scales with it so line weight looks even across a ~3:2 card. */
export function SchematicThumbnail({ type, large = false, value, color }) {
  const [x1, y1, x2, y2] = PARTS[type]?.schematic?.box || [-50, -42, 50, 42];
  const w = Math.max(x2 - x1, 40) + 20, h = Math.max(y2 - y1, 30) + 20, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const strokeWidth = r2(2.75 * Math.max(w, h * 1.5) / 150);
  return <svg className={`part-thumbnail schematic ${large ? 'large' : ''}`} viewBox={`${cx - w / 2} ${cy - h / 2} ${w} ${h}`} aria-hidden="true">
    {type === 'breadboard'
      ? <g fill="currentColor"><rect x="-38" y="-32" width="76" height="64" rx="4" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray="5 4"/>{BOARD_DOTS.map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r="2.4"/>)}</g>
      : <SchematicSymbol type={type} value={value} color={color} strokeWidth={strokeWidth}/>}
  </svg>;
}
