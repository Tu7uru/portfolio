// ARCHIVE.SYS content system: content/ folder <-> DATA/CATS/noscript inside docs/index.html
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const CONTENT = path.join(ROOT, 'content');
export const SITE = path.join(ROOT, 'docs');            // GitHub Pages root (static site)
export const INDEX = path.join(SITE, 'index.html');
export const M = {
  dataStart: '/*@CONTENT-START: generated from content/ by tools/build.mjs — edit the files in content/, not this block*/',
  dataEnd: '/*@CONTENT-END*/',
  nsStart: '<!--@NOSCRIPT-START: generated from content/-->',
  nsEnd: '<!--@NOSCRIPT-END-->',
};
const FIELDS = ['title','label','period','role','tags','link','linkLabel','plain','note','order','draft'];
const ITEM_KEYS = ['id','label','title','period','role','tags','desc','detail','link','linkLabel','note'];

// ---------- parse ----------
export function parseFrontMatter(text, file) {
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const meta = {}; let body = text;
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4);
    if (end < 0) throw new Error(`${file}: front matter starts with --- but never closes with ---`);
    const head = text.slice(4, end); body = text.slice(end + 4).replace(/^[^\n]*\n?/, '');
    head.split('\n').forEach((line, i) => {
      if (!line.trim() || line.trim().startsWith('#')) return;
      const m = line.match(/^([A-Za-z]+)\s*:\s*(.*)$/);
      if (!m) throw new Error(`${file}: front matter line ${i + 2} is not "key: value": ${line}`);
      const k = m[1]; let v = m[2].trim();
      if (!FIELDS.includes(k) && !['drive'].includes(k)) throw new Error(`${file}: unknown field "${k}" (allowed: ${FIELDS.join(', ')}, drive)`);
      meta[k] = v;
    });
  }
  return { meta, body };
}
function parseBody(body) {
  const desc = [], detail = []; let inBullets = false;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-*]\s+/.test(line)) { detail.push(line.replace(/^[-*]\s+/, '')); inBullets = true; }
    else if (inBullets && detail.length) detail[detail.length - 1] += ' ' + line; // wrapped bullet
    else desc.push(line);
  }
  return { desc: desc.join(' '), detail };
}
const tagsOf = v => v ? (v.startsWith('[') ? v.slice(1, -1) : v).split(',').map(s => s.trim()).filter(Boolean) : undefined;
const ord = (o, name) => [o === undefined || o === '' ? 1e9 : Number(o), name];
const cmp = (a, b) => a.k[0] - b.k[0] || (a.k[1] < b.k[1] ? -1 : a.k[1] > b.k[1] ? 1 : 0);

function readDir(dir, rel) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(e => !e.name.startsWith('.'));
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name), r = rel + '/' + e.name;
    if (e.isDirectory()) {
      const fm = fs.existsSync(path.join(full, '_folder.md')) ? parseFrontMatter(fs.readFileSync(path.join(full, '_folder.md'), 'utf8'), r + '/_folder.md').meta : {};
      if (/^(true|yes)$/i.test(fm.draft || '')) continue;
      const it = { id: e.name, label: fm.label || e.name.toUpperCase(), folder: true, items: readDir(full, r) };
      if (fm.plain) it._plain = fm.plain;
      out.push({ k: ord(fm.order, e.name), it });
    } else if (e.name.endsWith('.md') && !e.name.startsWith('_')) {
      const id = e.name.slice(0, -3);
      const { meta, body } = parseFrontMatter(fs.readFileSync(full, 'utf8'), r);
      if (/^(true|yes)$/i.test(meta.draft || '')) continue;
      const { desc, detail } = parseBody(body);
      const it = { id };
      it.label = meta.label || id.toUpperCase();
      it.title = meta.title || it.label;
      if (meta.period) it.period = meta.period;
      if (meta.role) it.role = meta.role;
      const tags = tagsOf(meta.tags); if (tags && tags.length) it.tags = tags;
      if (desc) it.desc = desc;
      if (detail.length) it.detail = detail;
      if (meta.link) it.link = meta.link;
      if (meta.linkLabel) it.linkLabel = meta.linkLabel;
      if (meta.note) it.note = meta.note;
      if (meta.plain) it._plain = meta.plain;
      out.push({ k: ord(meta.order, id), it });
    }
  }
  return out.sort(cmp).map(x => x.it);
}

export function readContent() {
  if (!fs.existsSync(CONTENT)) throw new Error('content/ folder not found');
  const cats = [];
  for (const e of fs.readdirSync(CONTENT, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.') || e.name.startsWith('_')) continue;
    const fmFile = path.join(CONTENT, e.name, '_folder.md');
    const fm = fs.existsSync(fmFile) ? parseFrontMatter(fs.readFileSync(fmFile, 'utf8'), e.name + '/_folder.md').meta : {};
    if (/^(true|yes)$/i.test(fm.draft || '')) continue;
    cats.push({ k: ord(fm.order, e.name), id: e.name, drive: fm.drive, items: readDir(path.join(CONTENT, e.name), e.name) });
  }
  cats.sort(cmp);
  // auto drive letters for categories without one: next free letter
  const used = new Set(cats.map(c => c.drive).filter(Boolean));
  let next = 'A'.charCodeAt(0);
  for (const c of cats) if (!c.drive) { while (used.has(String.fromCharCode(next))) next++; c.drive = String.fromCharCode(next); used.add(c.drive); }
  return cats;
}

// ---------- validate ----------
export function validate(cats) {
  const errs = [], warns = [], ids = new Map(), drives = new Map();
  if (!cats.length) errs.push('content/ has no category folders');
  if (cats.length > 8) warns.push(`${cats.length} root disks — more than 8 will crowd the screen`);
  for (const c of cats) {
    if (!/^[A-Z]$/.test(c.drive)) errs.push(`${c.id}: drive must be one capital letter (got "${c.drive}")`);
    if (drives.has(c.drive)) errs.push(`${c.id}: drive ${c.drive} already used by ${drives.get(c.drive)}`); drives.set(c.drive, c.id);
    if (c.id.length > 13) warns.push(`${c.id}: root disk names longer than 13 characters get shrunk`);
    if (!c.items.length) warns.push(`${c.id}: empty category (an empty disk)`);
    const walk = (it, p) => {
      if (ids.has(it.id)) errs.push(`${p}: id "${it.id}" is used twice (also ${ids.get(it.id)}) — file and folder names must be unique across content/`);
      ids.set(it.id, p);
      if (!/^[a-z0-9][a-z0-9._-]*$/i.test(it.id)) errs.push(`${p}: file/folder name "${it.id}" — use letters, digits, - _ . only`);
      if ((it.label || '').length > 13) warns.push(`${p}: label "${it.label}" is ${it.label.length} chars (keep ≤ 13; it will be shrunk to fit)`);
      if (it.folder) { if (!it.items.length) warns.push(`${p}: empty folder`); it.items.forEach(x => walk(x, p + '/' + x.id)); }
    };
    c.items.forEach(it => walk(it, c.id + '/' + it.id));
  }
  return { errs, warns };
}

// ---------- generate ----------
const clean = it => { const o = {}; for (const k of ITEM_KEYS) if (it[k] !== undefined) o[k] = it[k]; if (it.folder) { o.folder = true; o.items = it.items.map(clean); } return o; };
export function genData(cats) {
  const lines = ['var DATA = {'];
  cats.forEach((c, ci) => {
    lines.push(JSON.stringify(c.id) + ':{ drive:' + JSON.stringify(c.drive) + ', items:[');
    c.items.forEach((it, i) => lines.push(JSON.stringify(clean(it)) + (i < c.items.length - 1 ? ',' : '')));
    lines.push(']}' + (ci < cats.length - 1 ? ',' : ''));
  });
  lines.push('};');
  lines.push('var CATS = ' + JSON.stringify(cats.map(c => c.id)) + ';');
  return lines.join('\n');
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plainOf = it => it._plain || [it.role || it.title, it.period].filter(Boolean).join(' · ');
export function genNoscript(cats) {
  const li = it => {
    if (it.folder) return `<li>${esc(it.label)} <span class="ns-dir">&lt;DIR&gt;</span>\n<ul>${it.items.map(li).join('\n')}</ul>\n</li>`;
    const name = it.linkLabel && it.link ? `<a href="${esc(it.link)}">${esc(it.label)}</a>` : esc(it.label);
    const p = plainOf(it);
    return `<li>${name}${p ? ' — ' + esc(p) : ''}</li>`;
  };
  return cats.map(c => `<h2>Drive ${esc(c.drive)} · ${esc(c.id)}</h2>\n<ul>${c.items.map(li).join('\n')}</ul>`).join('\n');
}

export function inject(html, cats) {
  const d0 = html.indexOf(M.dataStart), d1 = html.indexOf(M.dataEnd);
  const n0 = html.indexOf(M.nsStart), n1 = html.indexOf(M.nsEnd);
  if (d0 < 0 || d1 < 0 || n0 < 0 || n1 < 0) throw new Error('index.html is missing the @CONTENT / @NOSCRIPT markers');
  let out = html.slice(0, d0 + M.dataStart.length) + '\n' + genData(cats) + '\n' + html.slice(d1);
  const m0 = out.indexOf(M.nsStart), m1 = out.indexOf(M.nsEnd);
  out = out.slice(0, m0 + M.nsStart.length) + '\n' + genNoscript(cats) + '\n' + out.slice(m1);
  return out;
}
