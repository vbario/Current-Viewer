// A small, tolerant S-expression reader for KiCad files (.kicad_sch, .net).
// Lists become arrays whose first element is usually the head atom, e.g.
// `(at 1 2 90)` → ['at', '1', '2', '90']. Atoms and quoted strings are both
// returned as JS strings; numbers are converted on demand with `num`.

const ESCAPES = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", a: '\x07', b: '\b', f: '\f', v: '\v' };

/** Parse S-expression text. Returns the first top-level list (or null). Unbalanced
 * input is tolerated: missing closing parentheses are implied at the end. */
export function parseSexpr(text) {
  const all = parseSexprAll(text);
  return all.find(Array.isArray) || null;
}

/** Parse every top-level expression in the text. */
export function parseSexprAll(text) {
  const root = [], stack = [root];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '(') { const list = []; stack.at(-1).push(list); stack.push(list); i++; continue; }
    if (ch === ')') { if (stack.length > 1) stack.pop(); i++; continue; }
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f') { i++; continue; }
    if (ch === '"') {
      let out = '';
      i++;
      while (i < n && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < n) {
          const next = text[i + 1];
          if (next === 'x' && /^[0-9a-fA-F]{2}/.test(text.slice(i + 2, i + 4))) { out += String.fromCharCode(parseInt(text.slice(i + 2, i + 4), 16)); i += 4; continue; }
          out += ESCAPES[next] ?? next;
          i += 2;
          continue;
        }
        out += text[i++];
      }
      i++; // closing quote
      stack.at(-1).push(out);
      continue;
    }
    let start = i;
    while (i < n && !'() \n\t\r\f"'.includes(text[i])) i++;
    if (i > start) stack.at(-1).push(text.slice(start, i));
    else i++;
  }
  return root;
}

const isList = (node, name) => Array.isArray(node) && (name === undefined || node[0] === name);

/** First child list with the given head. */
export function find(node, name) {
  if (!Array.isArray(node)) return undefined;
  for (let i = 1; i < node.length; i++) if (isList(node[i], name)) return node[i];
  return undefined;
}

/** All child lists with the given head. */
export function findAll(node, name) {
  if (!Array.isArray(node)) return [];
  const out = [];
  for (let i = 1; i < node.length; i++) if (isList(node[i], name)) out.push(node[i]);
  return out;
}

/** The atom at index `i` of a child list, e.g. value(sym, 'lib_id') → 'Device:R'. */
export function value(node, name, i = 1) {
  const child = find(node, name);
  return child && typeof child[i] === 'string' ? child[i] : undefined;
}

export const num = (s, fallback = 0) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

/** True when a list contains the bare atom (e.g. `hide` in `(pin … hide)`) or a
 * `(name yes)` child. */
export function flag(node, name) {
  if (!Array.isArray(node)) return false;
  for (let i = 1; i < node.length; i++) {
    const c = node[i];
    if (c === name) return true;
    if (isList(c, name)) return c.length === 1 || c[1] === 'yes' || c[1] === 'true';
  }
  return false;
}
