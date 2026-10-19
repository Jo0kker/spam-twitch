import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Timeline, DEFAULT_LAYOUT, sanitizeSnapshot, validateLayout } from './protocol.mjs';
import { secretToken } from './auth.mjs';
import { body, json, HttpError, fail, staticFile } from './http.mjs';
import { demoSnapshot } from './demo.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runFile = promisify(execFile);
export async function discoverGame() {
  const candidates = [];
  if (process.env.SPAM_GAME_PATH) candidates.push(process.env.SPAM_GAME_PATH);
  for (const drive of ['C', 'D', 'E', 'F', 'G', 'H']) candidates.push(`${drive}:\\SteamLibrary\\steamapps\\common\\SPAM`);
  candidates.push('C:\\Program Files (x86)\\Steam\\steamapps\\common\\SPAM');
  for (const base of [process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(Boolean)) {
    try {
      const libraries = await readFile(join(base, 'Steam/steamapps/libraryfolders.vdf'), 'utf8');
      for (const match of libraries.matchAll(/"path"\s+"([^"]+)"/g)) candidates.push(join(match[1].replaceAll('\\\\', '\\'), 'steamapps/common/SPAM'));
    } catch {}
  }
  for (const candidate of candidates) { try { if ((await stat(join(candidate, 'SPAM.exe'))).isFile()) return candidate; } catch {} }
  return '';
}
export async function createLocal(options = {}) {
  const fetch = options.fetch || globalThis.fetch;
  const runtime = resolve(options.runtimePath || resolve(root, '.runtime'));
  const configPath = resolve(runtime, 'companion.json');
  await mkdir(runtime, { recursive: true });
  let config = { language: options.language?.toLowerCase().startsWith('fr') ? 'fr' : options.language ? 'en' : '', gamePath: '', backendUrl: '', channelId: '', publisherToken: '', deviceName: 'PC de stream', layout: { ...DEFAULT_LAYOUT } };
  try { config = { ...config, ...JSON.parse(await readFile(configPath, 'utf8')) }; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  config.gamePath ||= await discoverGame();
  config.layout = validateLayout(config.layout);
  const timeline = new Timeline(); const localToken = secretToken();
  let demo = false; let demoSequence = 0; let lastGameRead = 0; let lastFileTime = 0;
  let state = null; let lastPublished = ''; let publishing = false; let lastPublishAt = 0;
  let status = { connector: 'waiting', cards: 0, scene: '', lastFrameAt: null, remote: config.channelId ? 'waiting' : 'unpaired', error: '' };
  let tickRunning = false; let lastStale = false;
  let heartbeatRunning = false, lastHeartbeatAt = 0;
  let remoteConnection = { state: config.publisherToken ? 'checking' : 'unpaired', device: null, checkedAt: null, error: '' };
  const save = async () => { await writeFile(configPath + '.tmp', JSON.stringify(config, null, 2), { mode: 0o600 }); await rename(configPath + '.tmp', configPath); };
  const publicConfig = () => ({ language: config.language, gamePath: config.gamePath, backendUrl: config.backendUrl, channelId: config.channelId, deviceName: config.deviceName, layout: config.layout });
  const baseUrl = value => {
    let url;
    try { url = new URL(value); } catch { throw new HttpError(400, 'Adresse du serveur invalide.'); }
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new HttpError(400, 'Utilise une adresse de serveur sans chemin ni identifiants.');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new HttpError(400, 'Le serveur distant doit utiliser HTTPS.');
    return url.origin;
  };
  const publish = async snapshot => {
    if (publishing || demo || remoteConnection.state === 'revoked' || !config.publisherToken || !config.backendUrl || Date.now() - lastPublishAt < 550) return;
    const fingerprint = `${snapshot.sessionId}:${snapshot.sequence}`;
    if (fingerprint === lastPublished) return;
    publishing = true; lastPublishAt = Date.now();
    const credential = config.publisherToken;
    try {
      const response = await fetch(config.backendUrl + '/api/publish', { method: 'POST', signal: AbortSignal.timeout(5000), headers: { Authorization: `Bearer ${config.publisherToken}`, 'x-channel-id': config.channelId, 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
      if (config.publisherToken !== credential) return;
      if (!response.ok) { const result = await response.json().catch(() => ({})); if (response.status === 401) remoteConnection = { ...remoteConnection, state: 'revoked', device: null, checkedAt: Date.now(), error: result.error || 'Accès révoqué.' }; throw new Error(result.error || `Serveur HTTP ${response.status}`); }
      status.remote = 'connected'; status.error = ''; lastPublished = fingerprint;
    } catch (error) { if (config.publisherToken === credential) { status.remote = 'error'; status.error = `Transmission : ${error.message}`; } }
    finally { publishing = false; }
  };
  const heartbeat = async () => {
    if (heartbeatRunning || !config.publisherToken || !config.backendUrl || remoteConnection.state === 'revoked' || Date.now() - lastHeartbeatAt < 5000) return;
    heartbeatRunning = true; lastHeartbeatAt = Date.now(); const credential = config.publisherToken;
    try {
      const response = await fetch(config.backendUrl + '/api/publisher/heartbeat', { method: 'POST', signal: AbortSignal.timeout(5000), headers: { Authorization: `Bearer ${credential}`, 'x-channel-id': config.channelId } });
      const result = await response.json();
      if (config.publisherToken !== credential) return;
      if (!response.ok) {
        if (response.status === 401) remoteConnection = { state: 'revoked', device: null, checkedAt: Date.now(), error: result.error || 'Accès révoqué.' };
        throw new Error(result.error || `Serveur HTTP ${response.status}`);
      }
      remoteConnection = { state: 'active', device: result.device, checkedAt: Date.now(), error: '' };
    } catch (error) {
      if (config.publisherToken === credential && remoteConnection.state !== 'revoked') remoteConnection = { ...remoteConnection, state: 'unreachable', error: error.message };
    } finally { heartbeatRunning = false; }
  };
  const tick = async () => {
    if (tickRunning) return;
    tickRunning = true;
    try {
      void heartbeat();
      if (demo) {
        if (Date.now() - lastGameRead > 1000) { state = sanitizeSnapshot(demoSnapshot(++demoSequence)); timeline.add(state, config.layout); lastGameRead = Date.now(); status = { ...status, connector: 'demo', cards: state.cards.length, scene: state.scene, lastFrameAt: Date.now() }; }
        return;
      }
      if (config.gamePath) {
        const path = join(config.gamePath, 'BepInEx/spam-twitch/state.json');
        try {
          const fileStat = await stat(path);
          if (fileStat.mtimeMs !== lastFileTime) {
            const next = sanitizeSnapshot(JSON.parse(await readFile(path, 'utf8')));
            if (Math.abs(Date.now() - next.capturedAt) < 7000 && Date.now() - fileStat.mtimeMs < 7000) {
              state = next; timeline.add(state, config.layout); lastGameRead = Date.now(); lastStale = false;
              status = { ...status, connector: 'connected', cards: state.cards.length, scene: state.scene, lastFrameAt: Date.now() };
              if (status.error.startsWith('Lecture du jeu :')) status.error = '';
            }
            lastFileTime = fileStat.mtimeMs;
          }
        } catch (error) { if (!['ENOENT', 'EBUSY'].includes(error.code) && !(error instanceof SyntaxError)) status.error = `Lecture du jeu : ${error.message}`; }
      }
      if (Date.now() - lastGameRead > 5000) {
        status.connector = 'waiting'; status.cards = 0;
        if (!lastStale && state) {
          state = { ...state, cards: [], sessionId: 'offline-' + state.sessionId, sequence: 0, capturedAt: Date.now(), scene: 'En attente du jeu' };
          timeline.add(state, config.layout); lastStale = true;
          await publish(state);
        }
      } else if (state) await publish(state);
    } catch (error) { status.error = error.message; }
    finally { tickRunning = false; }
  };
  const server = http.createServer(async (request, response) => {
    try {
      const port = server.address()?.port;
      const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
      if (!allowedHosts.includes(request.headers.host)) throw new HttpError(403, 'Adresse locale invalide.');
      const origin = request.headers.origin;
      if (origin && !allowedHosts.some(host => origin === 'http://' + host)) throw new HttpError(403, 'Origine refusée.');
      const url = new URL(request.url, 'http://' + request.headers.host);
      if (request.method !== 'GET' && request.headers['x-local-token'] !== localToken) throw new HttpError(403, 'Recharge la page locale pour continuer.');
      if (request.method === 'GET' && url.pathname === '/api/local/bootstrap') return json(response, 200, { token: localToken, config: publicConfig(), status });
      if (request.method === 'GET' && url.pathname === '/api/local/status') return json(response, 200, { ...status, version: options.version || 'développement', demo, connection: remoteConnection, config: publicConfig(), pluginInstalled: !!config.gamePath && await stat(join(config.gamePath, 'BepInEx/plugins/SpamTwitchConnector/SpamTwitchConnector.dll')).then(() => true, () => false) });
      if (request.method === 'GET' && url.pathname === '/api/local/state') return json(response, 200, { ...timeline.read(Number(url.searchParams.get('after')) || 0, 0), layout: config.layout, online: status.connector === 'connected' || demo });
      if (request.method === 'POST' && url.pathname === '/api/local/demo') {
        const input = await body(request, 1024); demo = input.enabled === true; state = null; lastGameRead = 0; lastFileTime = 0;
        // A future-dated old frame must not survive a source change.
        timeline.frames = []; timeline.bytes = 0;
        await tick(); return json(response, 200, { demo });
      }
      if (request.method === 'PUT' && url.pathname === '/api/local/settings') {
        const input = await body(request, 4096);
        if (typeof input.gamePath === 'string') {
          if (!(await stat(join(input.gamePath, 'SPAM.exe')).then(value => value.isFile(), () => false))) throw new HttpError(400, 'Le dossier doit contenir SPAM.exe.');
          config.gamePath = input.gamePath; lastFileTime = 0;
        }
        if (['fr', 'en'].includes(input.language)) { config.language = input.language; options.onLanguageChange?.(config.language); }
        if (input.layout) config.layout = validateLayout(input.layout);
        await save(); if (state) timeline.add(state, config.layout);
        return json(response, 200, publicConfig());
      }
      if (request.method === 'POST' && url.pathname === '/api/local/pair') {
        const input = await body(request, 4096); const backend = baseUrl(input.backendUrl || config.backendUrl || 'https://spam-twitch.codible.net');
        let result;
        try { result = await fetch(backend + '/api/pair', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: String(input.code || '').replace(/\s/g, '').toUpperCase(), deviceName: String(input.deviceName || 'PC de stream').slice(0, 60) }) }); }
        catch { throw new HttpError(502, 'Connexion à SPAM indisponible. Vérifiez Internet puis réessayez.'); }
        const paired = await result.json();
        if (!result.ok) throw new HttpError(400, paired.error || 'Association refusée.');
        if (!/^\d+$/.test(paired.channelId) || typeof paired.publisherToken !== 'string' || paired.publisherToken.length < 32) throw new HttpError(400, 'Réponse du serveur invalide.');
        config.backendUrl = backend; config.channelId = paired.channelId; config.publisherToken = paired.publisherToken;
        config.deviceName = paired.connection?.device?.name || 'PC de stream';
        await save(); status.remote = 'waiting'; status.error = ''; lastPublished = '';
        remoteConnection = { state: 'checking', device: paired.connection?.device || null, checkedAt: null, error: '' }; lastHeartbeatAt = 0; void heartbeat();
        return json(response, 200, publicConfig());
      }
      if (request.method === 'POST' && url.pathname === '/api/local/unpair') {
        const credential = config.publisherToken;
        if (config.publisherToken && config.backendUrl) {
          let response;
          try { response = await fetch(config.backendUrl + '/api/publisher/revoke', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${config.publisherToken}`, 'x-channel-id': config.channelId } }); }
          catch { throw new HttpError(502, 'Serveur inaccessible : l’accès n’a pas pu être révoqué. Réessayez quand la connexion revient.'); }
          if (!response.ok && response.status !== 401) throw new HttpError(502, 'Le serveur n’a pas confirmé la révocation. Réessayez.');
        }
        if (config.publisherToken !== credential) throw new HttpError(409, 'L’association a changé pendant la révocation. Actualisez avant de réessayer.');
        config.publisherToken = ''; config.channelId = ''; config.backendUrl = ''; await save(); status.remote = 'unpaired'; status.error = '';
        remoteConnection = { state: 'unpaired', device: null, checkedAt: Date.now(), error: '' };
        return json(response, 200, { ok: true });
      }
      if (request.method === 'POST' && url.pathname === '/api/local/install') {
        if (!config.gamePath) throw new HttpError(400, 'Indique le dossier de SPAM.');
        const script = join(root, 'tools/Install-Connector.ps1');
        // Recompile the current shipped source: an old cached DLL must not survive an app update.
        await runFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'tools/Build-Connector.ps1'), '-GamePath', config.gamePath], { windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 });
        const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-GamePath', config.gamePath];
        if (existsSync(join(config.gamePath, 'BepInEx/spam-twitch-install.json'))) args.push('-Update');
        const result = await runFile('powershell.exe', args, { windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 });
        return json(response, 200, { message: result.stdout.trim() });
      }
      if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true, service: 'SPAM Twitch Companion', version: options.version || 'développement' });
      if (request.method === 'GET' && ['/language.mjs', '/translate.mjs', '/en.json'].includes(url.pathname)) return await staticFile(response, join(root, 'server/site'), url.pathname);
      if (request.method === 'GET' && url.pathname.startsWith('/extension/')) return await staticFile(response, join(root, 'extension'), url.pathname.slice(10));
      if (request.method === 'GET') return await staticFile(response, join(root, 'companion'), url.pathname === '/' ? '/index.html' : url.pathname);
      throw new HttpError(404, 'Route introuvable.');
    } catch (error) { fail(response, error); }
  });
  options.onLanguageChange?.(config.language);
  const timer = setInterval(() => void tick(), 250); timer.unref();
  server.on('close', () => clearInterval(timer));
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  await tick();
  return { server, timeline };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = await createLocal(); const port = Number(process.env.COMPANION_PORT || 8787);
  server.listen(port, '127.0.0.1', () => console.log(`SPAM Twitch Companion: http://127.0.0.1:${port}`));
}
