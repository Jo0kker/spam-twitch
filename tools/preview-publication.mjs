import http from 'node:http';
import { resolve } from 'node:path';
import { staticFile, fail } from '../server/http.mjs';
const root = resolve('publication/site');
http.createServer(async (request, response) => {
  try {
    if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
    const url = new URL(request.url, 'http://127.0.0.1:8791');
    await staticFile(response, root, url.pathname === '/' ? '/index.html' : url.pathname);
  } catch (error) { fail(response, error); }
}).listen(8791, '127.0.0.1', () => console.log('Publication draft preview: http://127.0.0.1:8791'));
