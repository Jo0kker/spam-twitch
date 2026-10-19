import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {normalizeLanguage, translate, translateMessage} from '../server/site/translate.mjs';
import {createLocal} from '../server/local.mjs';
const dictionary = JSON.parse(await readFile(new URL('../server/site/en.json', import.meta.url), 'utf8'));

test('both languages preserve game text and user values while translating app messages', () => {
  assert.equal(normalizeLanguage('fr-CA'), 'fr');
  assert.equal(normalizeLanguage('en-GB'), 'en');
  assert.equal(normalizeLanguage('de-DE'), 'en');
  const device = '<My PC> {channel}';
  assert.equal(translate('{device} · chaîne Twitch {channel}', 'en', dictionary, {device, channel: '123'}), '<My PC> {channel} · Twitch channel 123');
  assert.equal(translate('Écran : {scene}', 'fr', dictionary, {scene: 'Collection'}), 'Écran : Collection');
  assert.equal(translate('Félin Errant', 'en', dictionary), 'Félin Errant');
  assert.equal(translateMessage('Transmission : Code incorrect ou expiré.', 'en', dictionary), 'Transmission: Incorrect or expired code.');
  assert.equal(translateMessage('Version 0.5.0 prête — installation à la fermeture', 'en', dictionary), 'Version 0.5.0 ready — installs when you close the app');
});

test('all static setup and legal page text has an English translation', async () => {
  const unchanged = new Set(['SPAM Card Inspector', 'Version', 'FR / EN', 'Français', 'English', '0', 'Collection', 'SpamCardInspector.exe', 'README', 'GitHub Releases', 'benjamin@codible.net', 'S', 'Twitch ↗', 'Hetzner ↗', 'CNIL ↗']);
  for (const file of ['companion/index.html', 'server/site/index.html', 'server/site/privacy.html', 'server/site/terms.html']) {
    const html = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    const missing = [...html.matchAll(/>([^<>]+)</g)].map(match => match[1].trim()).filter(text => text && !unchanged.has(text) && !Object.hasOwn(dictionary, text));
    assert.deepEqual(missing, [], file);
  }
});

test('language preference survives restart without changing the pairing or game folder', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'spam-language-'));
  const configPath = join(directory, 'companion.json');
  const original = {gamePath: join(directory, 'game'), channelId: '123', publisherToken: 'fixture-key-do-not-publish', backendUrl: '', deviceName: 'My stream PC'};
  await writeFile(configPath, JSON.stringify(original));
  const servers = [];
  t.after(async () => {
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await rm(directory, {recursive: true, force: true});
  });
  const changes = [];
  const start = async () => {
    const {server} = await createLocal({runtimePath: directory, language: 'fr-FR', onLanguageChange: value => changes.push(value)});
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
  };
  const origin = await start();
  const bootstrap = await fetch(origin + '/api/local/bootstrap').then(response => response.json());
  assert.equal(bootstrap.config.language, 'fr');
  const denied = await fetch(origin + '/api/local/settings', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({language: 'en'})});
  assert.equal(denied.status, 403);
  const saved = await fetch(origin + '/api/local/settings', {method: 'PUT', headers: {'Content-Type': 'application/json', 'x-local-token': bootstrap.token}, body: JSON.stringify({language: 'en'})});
  assert.equal(saved.status, 200);
  const persisted = JSON.parse(await readFile(configPath, 'utf8'));
  for (const [key, value] of Object.entries(original)) assert.equal(persisted[key], value, key);
  assert.equal(persisted.language, 'en');
  const restarted = await start();
  const status = await fetch(restarted + '/api/local/status').then(response => response.json());
  assert.equal(status.config.language, 'en');
  assert.deepEqual(changes, ['fr', 'en', 'en']);
  for (const path of ['/language.mjs', '/translate.mjs', '/en.json']) assert.equal((await fetch(restarted + path)).status, 200);
});
