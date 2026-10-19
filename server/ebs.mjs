import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { Timeline, DEFAULT_LAYOUT, validateLayout, sanitizeSnapshot } from './protocol.mjs';
import { bearer, tokenHash, secretToken, signJwt, verifyJwt } from './auth.mjs';
import { body, json, HttpError, fail, RateLimiter, staticFile, downloadFile } from './http.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function createEbs(options = {}) {
  const clientId = options.clientId ?? process.env.TWITCH_EXTENSION_CLIENT_ID;
  const ownerId = options.ownerId ?? process.env.TWITCH_EXTENSION_OWNER_ID;
  const secret = options.secret ?? Buffer.from(process.env.TWITCH_EXTENSION_SECRET || '', 'base64');
  if (!clientId || (ownerId && !/^\d+$/.test(ownerId)) || secret.length < 16) throw new Error('Renseigne TWITCH_EXTENSION_CLIENT_ID et TWITCH_EXTENSION_SECRET ; TWITCH_EXTENSION_OWNER_ID est facultatif et doit être numérique.');
  const sendRequest = options.fetch ?? fetch;
  const dataPath = options.dataPath ?? resolve(process.env.EBS_DATA_PATH || resolve(root, '.runtime/ebs-credentials.json'));
  const allowLocal = options.allowLocal ?? process.env.ALLOW_LOCAL_TESTING === 'true';
  const channels = new Map(); const pairing = new Map();
  let persisted = {};
  try { persisted = JSON.parse(await readFile(dataPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const [id, entry] of Object.entries(persisted)) if (/^\d+$/.test(id)) channels.set(id, { tokenHash: entry.tokenHash, layout: validateLayout(entry.layout), timeline: new Timeline(), lastPublish: 0, lastNotify: 0, online: false });
  let persistChain = Promise.resolve();
  const persist = () => {
    const value = JSON.stringify(Object.fromEntries([...channels].map(([id, ch]) => [id, { tokenHash: ch.tokenHash, layout: ch.layout }])));
    persistChain = persistChain.catch(() => {}).then(async () => { await mkdir(dirname(dataPath), { recursive: true }); await writeFile(dataPath + '.tmp', value, { mode: 0o600 }); await rename(dataPath + '.tmp', dataPath); });
    return persistChain;
  };
  const limiter = new RateLimiter(12, 60000);
  const pairGlobalLimiter = new RateLimiter(500, 60000);
  const getChannel = id => {
    if (!channels.has(id)) {
      if (channels.size >= 1000) throw new HttpError(503, 'Capacité du service atteinte.');
      channels.set(id, { tokenHash: '', layout: { ...DEFAULT_LAYOUT }, timeline: new Timeline(), lastPublish: 0, lastNotify: 0, online: false });
    }
    return channels.get(id);
  };
  const notify = async (id, channel) => {
    if (options.disablePubSub || Date.now() - channel.lastNotify < 1100) return;
    channel.lastNotify = Date.now();
    try {
      const token = signJwt({ exp: Math.floor(Date.now() / 1000) + 60, user_id: ownerId || id, role: 'external', channel_id: id, pubsub_perms: { send: ['broadcast'] } }, secret);
      const response = await sendRequest('https://api.twitch.tv/helix/extensions/pubsub', {
        method: 'POST', signal: AbortSignal.timeout(5000),
        headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcaster_id: id, target: ['broadcast'], message: JSON.stringify({ type: 'state-changed', revision: channel.timeline.revision }) })
      });
      if (!response.ok) console.error(`Twitch PubSub HTTP ${response.status}`);
    } catch (error) { console.error(`Twitch PubSub: ${error.name}`); }
  };
  const server = http.createServer(async (request, response) => {
    try {
      const origin = request.headers.origin;
      const twitchOrigin = `https://${clientId.toLowerCase()}.ext-twitch.tv`;
      if (origin) {
        const localOrigin = allowLocal && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        if (origin !== twitchOrigin && !localOrigin) throw new HttpError(403, 'Origine non autorisée.');
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
      }
      if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
      const url = new URL(request.url, 'http://ebs.local');
      if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true, service: 'SPAM Twitch EBS', version: '0.1.0' });
      if (['GET', 'HEAD'].includes(request.method) && ['/downloads.json', '/downloads/SPAM-Twitch-Setup-0.1.0.exe', '/downloads/SPAM-Twitch-Companion-0.1.0.zip'].includes(url.pathname)) {
        const asset = url.pathname.endsWith('.exe') ? '/download/SPAM-Twitch-Setup.exe' : url.pathname === '/downloads.json' ? '/download/update.json' : '';
        response.writeHead(302, { Location: 'https://github.com/Jo0kker/spam-twitch/releases/latest' + asset, 'Cache-Control': 'no-cache' });
        response.end(); return;
      }
      if (request.method === 'GET' && ['/', '/index.html', '/style.css', '/privacy.html', '/terms.html'].includes(url.pathname)) return await staticFile(response, resolve(root, 'server/site'), url.pathname === '/' ? '/index.html' : url.pathname);
      if (request.method === 'POST' && url.pathname === '/api/pair-code') {
        const claims = verifyJwt(bearer(request), secret, { broadcaster: true });
        limiter.check(`issue:${claims.channel_id}`);
        for (const [code, entry] of pairing) if (entry.expiresAt < Date.now() || entry.channel === claims.channel_id) pairing.delete(code);
        const code = randomBytes(5).toString('hex').toUpperCase();
        pairing.set(code, { channel: claims.channel_id, expiresAt: Date.now() + 300000 });
        return json(response, 200, { code, expiresInSeconds: 300 });
      }
      if (request.method === 'POST' && url.pathname === '/api/pair') {
        limiter.check(`redeem:${request.socket.remoteAddress}`); pairGlobalLimiter.check('all');
        const input = await body(request, 1024);
        const code = String(input.code || '').replace(/[\s-]/g, '').toUpperCase();
        const entry = pairing.get(code);
        if (!entry || entry.expiresAt < Date.now()) throw new HttpError(401, 'Code incorrect ou expiré.');
        pairing.delete(code);
        const token = secretToken(); const channel = getChannel(entry.channel);
        channel.tokenHash = tokenHash(token); await persist();
        return json(response, 200, { channelId: entry.channel, publisherToken: token });
      }
      if (request.method === 'POST' && url.pathname === '/api/publish') {
        const id = request.headers['x-channel-id'];
        const channel = channels.get(id);
        const token = bearer(request);
        if (!channel?.tokenHash || !token || tokenHash(token) !== channel.tokenHash) throw new HttpError(401, 'Application non associée à cette chaîne.');
        if (Date.now() - channel.lastPublish < 400) throw new HttpError(429, 'Envoi trop fréquent.');
        const snapshot = sanitizeSnapshot(await body(request));
        if (snapshot.source !== 'game') throw new HttpError(400, 'Les données de démonstration restent locales.');
        const previous = channel.timeline.frames.at(-1)?.frame;
        if (previous?.sessionId === snapshot.sessionId && snapshot.sequence <= previous.sequence) throw new HttpError(409, 'État déjà reçu ou ancien.');
        channel.lastPublish = Date.now(); channel.online = true;
        const frame = channel.timeline.add(snapshot, channel.layout);
        void notify(id, channel);
        return json(response, 200, { revision: frame.revision });
      }
      if (request.method === 'GET' && url.pathname === '/api/state') {
        const claims = verifyJwt(bearer(request), secret);
        const channel = getChannel(claims.channel_id);
        const result = channel.timeline.read(Number(url.searchParams.get('after')) || 0, Number(url.searchParams.get('delayMs')) || 0);
        return json(response, 200, { ...result, layout: channel.layout, online: channel.online && Date.now() - channel.lastPublish < 10000 });
      }
      if (url.pathname === '/api/layout' && ['GET', 'PUT'].includes(request.method)) {
        const claims = verifyJwt(bearer(request), secret, { broadcaster: true });
        const channel = getChannel(claims.channel_id);
        if (request.method === 'PUT') { channel.layout = validateLayout(await body(request, 4096)); await persist(); }
        return json(response, 200, { layout: channel.layout });
      }
      // Convenience only: Twitch's production frontend is uploaded as its own ZIP.
      if (request.method === 'GET' && url.pathname.startsWith('/extension/')) return await staticFile(response, resolve(root, 'extension'), url.pathname.slice('/extension'.length));
      throw new HttpError(404, 'Route introuvable.');
    } catch (error) {
      if (!(error instanceof HttpError) && /invalide|dupliqu/.test(error.message)) error = new HttpError(400, error.message);
      fail(response, error);
    }
  });
  const staleTimer = setInterval(() => {
    for (const [id, channel] of channels) {
      if (channel.online && Date.now() - channel.lastPublish > 7000) {
        channel.online = false;
        const previous = channel.timeline.frames.at(-1)?.frame;
        if (previous) channel.timeline.add({ ...previous, sessionId: `offline-${previous.sessionId}`, sequence: 0, cards: [], capturedAt: Date.now(), scene: 'Connecteur déconnecté' }, channel.layout);
        void notify(id, channel);
      }
    }
    for (const [code, entry] of pairing) if (entry.expiresAt < Date.now()) pairing.delete(code);
  }, 1000);
  staleTimer.unref();
  server.on('close', () => clearInterval(staleTimer));
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  return { server, channels, pairing };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = await createEbs();
  const port = Number(process.env.PORT || 8788); const host = process.env.HOST || '127.0.0.1';
  server.listen(port, host, () => console.log(`SPAM Twitch EBS: http://${host}:${port}`));
}
