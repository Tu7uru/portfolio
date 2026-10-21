#!/usr/bin/env node
// Local preview that mimics GitHub Pages: serves docs/ under the /portfolio/ sub-path.
//   node tools/serve.mjs [port]      -> http://127.0.0.1:<port>/portfolio/   (default port 8741)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'docs');
const BASE = '/portfolio';
const PORT = Number(process.argv[2] || process.env.PORT || 8741);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === BASE) { res.writeHead(301, { Location: BASE + '/' }); return res.end(); }
  if (!url.startsWith(BASE + '/')) { res.writeHead(404); return res.end('not found (the site lives under ' + BASE + '/)'); }
  let file = path.join(ROOT, path.normalize(url.slice(BASE.length)).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`serving docs/ at http://127.0.0.1:${PORT}${BASE}/`));
