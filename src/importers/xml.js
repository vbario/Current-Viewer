// A tiny, tolerant XML reader for Eagle/Fusion files. It builds a tree of
// { name, attrs, children } elements, decodes entities, and skips comments,
// processing instructions, doctypes, and CDATA. Mismatched closing tags are
// tolerated rather than rejected.

const NAMED = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e] ?? m;
  });
}

const ATTR = /([^\s=/>]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parseAttrs(src) {
  const attrs = {};
  ATTR.lastIndex = 0;
  let m;
  while ((m = ATTR.exec(src))) attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

/** Parse XML text into a document element { name: '#document', children }. */
export function parseXml(text) {
  const doc = { name: '#document', attrs: {}, children: [] };
  const stack = [doc];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const lt = text.indexOf('<', i);
    if (lt < 0) break;
    if (lt > i) {
      const t = text.slice(i, lt);
      if (t.trim()) stack.at(-1).text = (stack.at(-1).text || '') + decodeEntities(t);
    }
    if (text.startsWith('<!--', lt)) { const end = text.indexOf('-->', lt + 4); i = end < 0 ? n : end + 3; continue; }
    if (text.startsWith('<![CDATA[', lt)) { const end = text.indexOf(']]>', lt + 9); i = end < 0 ? n : end + 3; continue; }
    if (text.startsWith('<?', lt)) { const end = text.indexOf('?>', lt + 2); i = end < 0 ? n : end + 2; continue; }
    if (text.startsWith('<!', lt)) {
      // DOCTYPE, possibly with an internal subset in [ … ].
      let j = lt + 2, depth = 0;
      while (j < n) { const c = text[j]; if (c === '[') depth++; else if (c === ']') depth--; else if (c === '>' && depth <= 0) break; j++; }
      i = j + 1;
      continue;
    }
    // Find the end of the tag, respecting quoted attribute values.
    let j = lt + 1, quote = null;
    while (j < n) {
      const c = text[j];
      if (quote) { if (c === quote) quote = null; } else if (c === '"' || c === "'") quote = c; else if (c === '>') break;
      j++;
    }
    const body = text.slice(lt + 1, j);
    i = j + 1;
    if (body[0] === '/') {
      const name = body.slice(1).trim();
      const at = stack.findLastIndex(el => el.name === name);
      if (at > 0) stack.length = at;
      continue;
    }
    const selfClosing = body.endsWith('/');
    const inner = selfClosing ? body.slice(0, -1) : body;
    const m = /^([^\s/>]+)/.exec(inner);
    if (!m) continue;
    const el = { name: m[1], attrs: parseAttrs(inner.slice(m[1].length)), children: [] };
    stack.at(-1).children.push(el);
    if (!selfClosing) stack.push(el);
  }
  return doc;
}

export const children = (el, name) => (el?.children || []).filter(c => c.name === name);
export const child = (el, name) => (el?.children || []).find(c => c.name === name);

/** Follow a path of child element names, e.g. path(doc, 'eagle', 'drawing'). */
export function path(el, ...names) {
  let cur = el;
  for (const name of names) { cur = child(cur, name); if (!cur) return undefined; }
  return cur;
}

/** All descendants with the given name (depth-first). */
export function descendants(el, name, out = []) {
  for (const c of el?.children || []) {
    if (c.name === name) out.push(c);
    descendants(c, name, out);
  }
  return out;
}
