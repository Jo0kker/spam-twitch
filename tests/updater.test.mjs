import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { Updater, validateManifest, isNewer, verifyInstaller } = createRequire(import.meta.url)('../desktop/updater.cjs');
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const installer = Buffer.from('fixture installer, never executed');
const manifest = { repository: 'Jo0kker/spam-twitch', version: '0.3.0', filename: 'SPAM-Twitch-Setup-0.3.0.exe', bytes: installer.length, sha256: createHash('sha256').update(installer).digest('hex') };
const encode = value => { const bytes = Buffer.from(JSON.stringify(value)); return [bytes, sign(null, bytes, privateKey).toString('base64')]; };
test('only a signed, correctly scoped, newer stable release can be installed', () => {
  const [bytes, signature] = encode(manifest);
  assert.deepEqual(validateManifest(bytes, signature, publicKey, manifest.repository, '0.2.0'), manifest);
  assert.equal(validateManifest(bytes, signature, publicKey, manifest.repository, '0.3.0'), null);
  assert.equal(validateManifest(bytes, signature, publicKey, manifest.repository, '1.0.0'), null);
  assert.throws(() => validateManifest(Buffer.from(bytes.toString().replace('0.3.0', '9.0.0')), signature, publicKey, manifest.repository, '0.2.0'));
  assert.throws(() => validateManifest(bytes, signature, publicKey, 'attacker/repo', '0.2.0'));
  for (const bad of [{ ...manifest, filename: '../run.exe' }, { ...manifest, bytes: 9999999999 }, { ...manifest, version: '0.3.0-beta' }]) {
    assert.throws(() => validateManifest(...encode(bad), publicKey, manifest.repository, '0.2.0'));
  }
  assert.throws(() => verifyInstaller(Buffer.from('tampered'), manifest));
  verifyInstaller(installer, manifest);
  assert.equal(isNewer('0.10.0', '0.9.9'), true);
});
test('download is verified and staged; closing opts out of future work; bad payload never staged', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spam-updater-'));
  try {
    const cache = join(directory, 'cache');
    await mkdir(join(directory, 'tools'));
    await writeFile(join(directory, 'unins000.exe'), 'fixture');
    await writeFile(join(directory, 'tools/Apply-Update.ps1'), '# fixture');
    const [bytes, signature] = encode(manifest);
    const requested = [];
    const fakeFetch = async (url, options) => {
      assert.equal(options.headers.Accept, url.startsWith('https://api.github.com/') ? 'application/vnd.github+json' : 'application/octet-stream');
      requested.push(url);
      return new Response(url.endsWith('/latest') ? JSON.stringify({ tag_name: 'v0.3.0' }) : url.endsWith('/update.json') ? bytes : url.endsWith('/update.json.sig') ? signature : installer);
    };
    const labels = [];
    const updater = new Updater({ config: { repository: manifest.repository, publicKey }, currentVersion: '0.2.0', cache, root: directory, notify: value => labels.push(value), fetchImpl: fakeFetch });
    await updater.check();
    assert.deepEqual(await readFile(updater.pending.filename), installer);
    assert.match(labels.at(-1), /installation à la fermeture/);
    assert.equal(requested.length, 4);
    const corrupted = new Updater({ config: { repository: manifest.repository, publicKey }, currentVersion: '0.2.0', cache, root: directory, notify() {}, fetchImpl: async (url, options) => url.endsWith('.exe') ? new Response('tampered') : fakeFetch(url, options) });
    await corrupted.check();
    assert.equal(corrupted.pending, null);
    const disabled = new Updater({ config: {}, root: directory, notify() {}, fetchImpl: () => assert.fail('fetch after quit') });
    await disabled.installOnExit();
    await disabled.check();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
