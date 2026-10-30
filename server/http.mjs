import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve, sep, extname } from 'node:path';

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(data));
}
export async function body(request, maxBytes = 256 * 1024) {
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size > maxBytes) throw new HttpError(413, 'Requête trop volumineuse.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'JSON invalide.'); }
}
export async function staticFile(response, root, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { throw new HttpError(400, 'Chemin invalide.'); }
  const path = resolve(root, '.' + decoded);
  if (!path.startsWith(resolve(root) + sep)) throw new HttpError(403, 'Accès refusé.');
  let content;
  try { content = await readFile(path); } catch { throw new HttpError(404, 'Fichier introuvable.'); }
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf' };
  response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  response.end(content);
}
export async function downloadFile(response, path, filename, headOnly = false) {
  let info;
  try { info = await stat(path); } catch { throw new HttpError(404, 'Téléchargement indisponible.'); }
  if (!info.isFile()) throw new HttpError(404, 'Téléchargement indisponible.');
  response.writeHead(200, { 'Content-Type': filename.endsWith('.exe') ? 'application/octet-stream' : 'application/zip', 'Content-Length': info.size,
    'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  if (headOnly) return response.end();
  await pipeline(createReadStream(path), response);
}
export function fail(response, error) { if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'Erreur interne du service.' }); else response.end(); }
export class RateLimiter {
  constructor(limit, periodMs) { this.limit = limit; this.periodMs = periodMs; this.entries = new Map(); }
  check(key, now = Date.now()) {
    if (this.entries.size > 10000) for (const [id, entry] of this.entries) if (now > entry.until) this.entries.delete(id);
    let entry = this.entries.get(key);
    if (!entry || now > entry.until) { entry = { until: now + this.periodMs, count: 0 }; this.entries.set(key, entry); }
    if (++entry.count > this.limit) throw new HttpError(429, 'Trop de tentatives. Réessaie dans une minute.');
  }
}
