// Optional integration check using the running local game. Nothing is sent to Twitch.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createEbs } from '../server/ebs.mjs';
import { signJwt } from '../server/auth.mjs';

const local = await fetch('http://127.0.0.1:8787/api/local/state').then(response => response.json());
const snapshot = local.frames.at(-1);
assert.ok(snapshot?.source === 'game' && snapshot.cards.length > 0, 'Ouvre des cartes dans SPAM avec le connecteur chargé.');
const directory = await mkdtemp(join(tmpdir(), 'spam-live-smoke-'));
const secret = randomBytes(32);
const { server } = await createEbs({ secret, ownerId: '123', clientId: 'localtest', dataPath: join(directory, 'state.json'), disablePubSub: true });
try {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const jwt = role => signJwt({ channel_id: '123', role, exp: Math.floor(Date.now() / 1000) + 60 }, secret);
  const post = (path, token, value, headers = {}) => fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value) });
  const issued = await (await post('/api/pair-code', jwt('broadcaster'), {})).json();
  const paired = await (await post('/api/pair', '', { code: issued.code })).json();
  const published = await post('/api/publish', paired.publisherToken, snapshot, { 'x-channel-id': '123' }); assert.equal(published.status, 200);
  const viewer = await fetch(base + '/api/state', { headers: { Authorization: `Bearer ${jwt('viewer')}` } }).then(response => response.json());
  assert.deepEqual(viewer.frames.at(-1).cards, snapshot.cards);
  console.log(`Jeu réel → compagnon local → EBS de test → viewer authentifié : ${snapshot.cards.length} cartes, données identiques.`);
} finally { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
