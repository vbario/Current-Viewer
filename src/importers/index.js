// Diagram import entry point: decode bytes, detect the format, parse it, and
// build a Current project. Pure ES module — runs in the browser and in Node.

import { validProject } from '../project.js';
import { ImportError } from './errors.js';
import { buildProject, autoLayout, parseValue } from './build.js';
import { parseKicadSch } from './kicad.js';
import { parseKicadNetlist } from './kicadNetlist.js';
import { parseEagleSch } from './eagle.js';
import { parseAsc } from './ltspice.js';
import { parseSpice } from './spice.js';

export { ImportError };

export const ACCEPTED_EXTENSIONS = ['.json', '.kicad_sch', '.net', '.sch', '.asc', '.cir', '.sp', '.spice', '.ckt', '.txt'];

export const FORMAT_LABELS = {
  'current-json': 'Current project',
  'kicad-sch': 'KiCad schematic',
  'kicad-netlist': 'KiCad netlist',
  'kicad-legacy': 'KiCad 5 schematic',
  'eagle-sch': 'Eagle schematic',
  'eagle-brd': 'Eagle board',
  'ltspice-asc': 'LTspice schematic',
  'spice': 'SPICE netlist',
};

const SUGGEST = 'Export the circuit from your design tool as a KiCad schematic (.kicad_sch), LTspice schematic (.asc), Eagle schematic (.sch), or a SPICE netlist (.cir) and import that instead.';

function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return null;
}

function decodeUtf16(bytes, littleEndian, start = 0) {
  const chunks = [];
  let chunk = [];
  for (let i = start; i + 1 < bytes.length; i += 2) {
    chunk.push(littleEndian ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]);
    if (chunk.length === 8192) { chunks.push(String.fromCharCode(...chunk)); chunk = []; }
  }
  chunks.push(String.fromCharCode(...chunk));
  return chunks.join('');
}

function decodeLatin1(bytes, start = 0) {
  const chunks = [];
  for (let i = start; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + 8192))));
  return chunks.join('');
}

/**
 * Text from a string, ArrayBuffer or Uint8Array. Handles UTF-8 (with or without
 * BOM), UTF-16 LE/BE (with a BOM, or BOM-less detected by NUL bytes, as LTspice
 * writes), and falls back to Latin-1 for bytes that aren't valid UTF-8 (e.g.
 * LTspice's µ).
 */
export function decodeText(data) {
  if (typeof data === 'string') return data.replace(/^\uFEFF/, '');
  const bytes = toBytes(data);
  if (!bytes) return '';
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return decodeUtf8(bytes.subarray(3));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return decodeUtf16(bytes, true, 2);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return decodeUtf16(bytes, false, 2);
  // BOM-less UTF-16: lots of NULs on one side of each byte pair.
  const n = Math.min(bytes.length, 4096) & ~1;
  if (n >= 4) {
    let evenNul = 0, oddNul = 0;
    for (let i = 0; i < n; i += 2) { if (bytes[i] === 0) evenNul++; if (bytes[i + 1] === 0) oddNul++; }
    const pairs = n / 2;
    if (oddNul > pairs * 0.3 && evenNul < pairs * 0.05) return decodeUtf16(bytes, true);
    if (evenNul > pairs * 0.3 && oddNul < pairs * 0.05) return decodeUtf16(bytes, false);
  }
  return decodeUtf8(bytes);
}

function decodeUtf8(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return decodeLatin1(bytes); }
}

const extensionOf = name => (/\.[^./\\]+$/.exec(String(name || '').toLowerCase()) || [''])[0];

/** Magic-byte/extension check for pictures, PDFs and archives. */
function binaryKind(fileName, bytes, text) {
  const ext = extensionOf(fileName);
  const head = bytes ? bytes.subarray(0, 16) : Uint8Array.from(String(text).slice(0, 16), c => c.charCodeAt(0) & 0xff);
  const ascii = String.fromCharCode(...head);
  if (head[0] === 0x89 && ascii.slice(1, 4) === 'PNG') return 'image';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image';
  if (ascii.startsWith('GIF8')) return 'image';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image';
  if (ascii.startsWith('%PDF')) return 'pdf';
  if (ascii.startsWith('PK\x03\x04')) return ext === '.fzz' || ext === '.fzpz' ? 'fritzing' : 'zip';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.heic', '.heif', '.tif', '.tiff', '.svg', '.avif'].includes(ext)) return 'image';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.fzz' || ext === '.fz' || ext === '.fzpz') return 'fritzing';
  if (ext === '.zip') return 'zip';
  return null;
}

/**
 * Identify a diagram format by content first and extension second. Returns
 * 'current-json' | 'kicad-sch' | 'kicad-netlist' | 'kicad-legacy' |
 * 'eagle-sch' | 'eagle-brd' | 'ltspice-asc' | 'spice' | null.
 */
export function detectFormat(fileName, text) {
  const t = String(text ?? '').replace(/^\uFEFF/, '');
  const head = t.slice(0, 4096).trimStart();
  const ext = extensionOf(fileName);
  if (head.startsWith('{')) {
    try { const p = JSON.parse(t); if (p && Array.isArray(p.components)) return 'current-json'; } catch { /* not JSON */ }
  }
  if (/^\(\s*kicad_sch\b/.test(head)) return 'kicad-sch';
  if (/^\(\s*export\b/.test(head)) return 'kicad-netlist';
  if (/^EESchema Schematic File/i.test(head)) return 'kicad-legacy';
  if (/^(<\?xml[^>]*\?>\s*)?(<!DOCTYPE\s+eagle[^>]*>\s*)?<eagle\b/i.test(head) || /<!DOCTYPE\s+eagle/i.test(head)) {
    if (/<schematic\b/i.test(t)) return 'eagle-sch';
    if (/<board\b/i.test(t)) return 'eagle-brd';
    return null;
  }
  if (/^Version\s+[\d.]+\s*[\r\n]+\s*SHEET\s+\d+/i.test(head) || (/^(Version\s+[\d.]+\s*[\r\n]+)?\s*(SHEET|WIRE|SYMBOL|FLAG)\s/m.test(head) && /^SYMBOL\s+\S+\s+-?\d+\s+-?\d+\s+[RM]\d+/m.test(t))) return 'ltspice-asc';
  if (looksLikeSpice(t)) return 'spice';
  // Extension fallback for files whose content is ambiguous.
  if (ext === '.kicad_sch') return 'kicad-sch';
  if (ext === '.asc' && /^\s*(WIRE|SYMBOL|FLAG)\s/m.test(t)) return 'ltspice-asc';
  if (['.cir', '.sp', '.spice', '.ckt', '.net'].includes(ext) && /^\s*[RCLVDQIXSEFGHBKMJ]\w*\s+\S+\s+\S+/im.test(t) && /^\s*\.(end|tran|op|ac|dc|model|subckt|include|lib|param)\b/im.test(t)) return 'spice';
  return null;
}

function looksLikeSpice(text) {
  // Lines after the title that are unmistakably circuit elements.
  const lines = text.split(/\r?\n/).slice(1, 2000).map(l => l.trim()).filter(l => l && !l.startsWith('*') && !l.startsWith('+'));
  const element = l => {
    const t = l.split(/\s+/);
    if (/^[RCL]\w*$/i.test(t[0]) && t.length >= 4) return Number.isFinite(parseValue(t[3].replace(/^[rcl]=/i, ''), { spice: true })) || /^\{.+\}$/.test(t[3]);
    if (/^V\w*$/i.test(t[0]) && t.length >= 4) return /^(dc|ac|pulse|sin|sine|pwl|exp|sffm)\b|^[-+.\d{]/i.test(t.slice(3).join(' '));
    if (/^D\w*$/i.test(t[0])) return t.length >= 4;
    if (/^Q\w*$/i.test(t[0])) return t.length >= 5;
    return false;
  };
  const elements = lines.filter(element).length;
  const dots = lines.filter(l => /^\.(end|tran|op|ac|dc|model|subckt|ends|param|include|inc|lib|title|control|options|save|probe|backanno|meas|step|print|plot)\b/i.test(l)).length;
  return elements >= 1 && (dots >= 1 || elements >= 2 && elements >= lines.length * 0.5);
}

const PARSERS = {
  'kicad-sch': parseKicadSch,
  'kicad-netlist': parseKicadNetlist,
  'eagle-sch': parseEagleSch,
  'ltspice-asc': parseAsc,
  'spice': parseSpice,
};

/**
 * Import a diagram file. `data` is a string, ArrayBuffer or Uint8Array.
 * Returns { project, format, summary: { parts, nets, wires }, skipped: [{ ref, reason }], warnings }.
 * Throws ImportError with a user-facing message for anything it can't import.
 */
export function importDiagram(fileName, data) {
  const bytes = typeof data === 'string' ? null : toBytes(data);
  const kind = binaryKind(fileName, bytes, typeof data === 'string' ? data : '');
  if (kind === 'image' || kind === 'pdf') {
    throw new ImportError(`Current can’t read circuits from ${kind === 'pdf' ? 'PDFs' : 'pictures'} yet — a ${kind === 'pdf' ? 'PDF' : 'picture'} of a schematic doesn’t say which parts are connected. ${SUGGEST}`);
  }
  if (kind === 'fritzing') throw new ImportError(`Fritzing files (.fzz) aren’t supported yet. In Fritzing, choose File › Export › as SPICE netlist, then import the .cir file.`);
  if (kind === 'zip') throw new ImportError(`This is a ZIP archive. Unzip it first and import the schematic file inside. ${SUGGEST}`);

  const text = decodeText(bytes ?? data);
  if (!text.trim()) throw new ImportError('This file is empty — we couldn’t find any components in it.');
  const format = detectFormat(fileName, text);
  if (format === 'current-json') {
    let project;
    try { project = JSON.parse(text); } catch { throw new ImportError('This Current project file is damaged and couldn’t be read.'); }
    if (!validProject(project)) throw new ImportError('This file looks like a Current project, but it isn’t valid. Try exporting it again.');
    return { project, format: FORMAT_LABELS[format], summary: summarize(project), skipped: [], warnings: [] };
  }
  if (format === 'kicad-legacy') throw new ImportError('This is a KiCad 5 (legacy) schematic. Open it in KiCad 6 or newer, save it, and import the resulting .kicad_sch file.');
  if (format === 'eagle-brd') throw new ImportError('This is an Eagle board layout (.brd). Please import the matching schematic (.sch) instead — it has the circuit’s parts and connections.');
  if (!format) {
    if (/^\s*<\s*module\b[^>]*fritzing/i.test(text)) throw new ImportError('Fritzing files aren’t supported yet. In Fritzing, choose File › Export › as SPICE netlist, then import the .cir file.');
    if (/^\s*\(\s*kicad_pcb\b/.test(text)) throw new ImportError('This is a KiCad PCB layout (.kicad_pcb). Please import the schematic (.kicad_sch) instead.');
    if (/^\s*<\s*eagle\b[\s\S]*<library\b/i.test(text.slice(0, 20000))) throw new ImportError('This is an Eagle library (.lbr), not a schematic. Please import a schematic (.sch).');
    throw new ImportError(`We couldn’t find any components in this file. ${SUGGEST}`);
  }

  let parsed;
  try { parsed = PARSERS[format](text, fileName); }
  catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError(`This ${FORMAT_LABELS[format]} couldn’t be read (${e.message}). It may be damaged or from an unsupported version.`);
  }
  const real = parsed.parts.filter(p => p.type !== 'ground');
  if (!real.length) {
    const left = parsed.skipped.length ? ` It contains ${parsed.skipped.length} part${parsed.skipped.length > 1 ? 's' : ''} Current can’t simulate yet (${[...new Set(parsed.skipped.map(s => s.reason))].slice(0, 3).join('; ')}).` : '';
    throw new ImportError(`We couldn’t find any components we can simulate in this ${FORMAT_LABELS[format]}.${left}`);
  }
  const groundNets = parsed.groundNets || [];
  const parts = parsed.layout === 'auto' ? autoLayout(parsed.parts, { groundNets }) : parsed.parts;
  const built = buildProject({ name: parsed.name, parts, groundNets, rails: parsed.rails || [], scale: parsed.scale, warnings: parsed.warnings || [] });
  return {
    project: built.project,
    format: FORMAT_LABELS[format],
    summary: { parts: built.project.components.length, nets: built.nets, wires: built.project.wires.length },
    skipped: parsed.skipped.map(({ ref, reason, value }) => ({ ref, reason, ...(value ? { value } : {}) })),
    warnings: built.warnings,
  };
}

function summarize(project) {
  const parent = new Map();
  const find = k => { if (!parent.has(k)) parent.set(k, k); while (parent.get(k) !== k) k = parent.get(k); return k; };
  for (const w of project.wires) { const a = find(w.from), b = find(w.to); if (a !== b) parent.set(b, a); }
  const nets = new Set(project.wires.map(w => find(w.from)));
  return { parts: project.components.length, nets: nets.size, wires: project.wires.length };
}
