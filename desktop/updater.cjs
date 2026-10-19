const { createHash, verify } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const MAX_BYTES = 512 * 1024 * 1024;
function versionParts(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error('Version de mise à jour invalide.');
  const parts = value.split('.').map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error('Version trop grande.');
  return parts;
}
function isNewer(candidate, current) {
  const a = versionParts(candidate), b = versionParts(current);
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
}
function validateManifest(bytes, signature, publicKey, repository, currentVersion) {
  if (!verify(null, bytes, publicKey, Buffer.from(signature.trim(), 'base64'))) throw new Error('Signature de mise à jour invalide.');
  const manifest = JSON.parse(bytes.toString('utf8'));
  versionParts(manifest.version);
  if (manifest.repository !== repository || !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
      !Number.isSafeInteger(manifest.bytes) || manifest.bytes <= 0 || manifest.bytes > MAX_BYTES ||
      manifest.filename !== `SPAM-Twitch-Setup-${manifest.version}.exe`) throw new Error('Manifeste de mise à jour invalide.');
  if (!isNewer(manifest.version, currentVersion)) return null;
  return manifest;
}
async function readBounded(response, limit) {
  if (!response.ok) throw new Error(`Serveur de mise à jour : HTTP ${response.status}`);
  let size = 0; const chunks = [];
  for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw new Error('Réponse de mise à jour trop volumineuse.'); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
function verifyInstaller(bytes, manifest) {
  if (bytes.length !== manifest.bytes || createHash('sha256').update(bytes).digest('hex') !== manifest.sha256) throw new Error('Installateur incomplet ou altéré.');
}
class Updater {
  constructor({ config, currentVersion, cache, root, notify, fetchImpl = fetch }) {
    Object.assign(this, { config, currentVersion, cache, root, notify, fetchImpl });
    this.pending = null; this.busy = false; this.disabled = false;
  }
  async check() {
    if (this.busy || this.disabled || this.pending) return;
    this.busy = true;
    try {
      // Portable copies do not have an installer registered for their directory.
      await fs.access(path.join(this.root, 'unins000.exe'));
      this.notify('Recherche de mise à jour…');
      const repository = this.config.repository;
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Dépôt de mise à jour invalide.');
      const get = (url, limit, timeout = 20000) => this.fetchImpl(url, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'SPAM-Card-Inspector-Updater', 'Accept': 'application/octet-stream' } }).then(response => readBounded(response, limit));
      const release = JSON.parse((await get(`https://api.github.com/repos/${repository}/releases/latest`, 256 * 1024)).toString('utf8'));
      if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) throw new Error('Publication de mise à jour invalide.');
      const base = `https://github.com/${repository}/releases/download/${release.tag_name}/`;
      // Construct URLs ourselves: release API asset URLs are never executable input.
      const [bytes, signature] = await Promise.all([get(base + 'update.json', 16384), get(base + 'update.json.sig', 1024)]);
      const manifest = validateManifest(bytes, signature.toString('utf8'), this.config.publicKey, repository, this.currentVersion);
      if (!manifest) { this.notify('Application à jour'); return; }
      if (release.tag_name !== `v${manifest.version}`) throw new Error('Version du manifeste différente de la publication.');
      this.notify(`Téléchargement de la version ${manifest.version}…`);
      const installer = await get(base + manifest.filename, MAX_BYTES, 300000);
      verifyInstaller(installer, manifest);
      if (this.disabled) return;
      await fs.mkdir(this.cache, { recursive: true });
      const filename = path.join(this.cache, manifest.filename);
      await fs.writeFile(filename + '.tmp', installer, { mode: 0o600 });
      await fs.rename(filename + '.tmp', filename);
      // Copy the helper outside the installation which it will replace.
      const helper = path.join(this.cache, 'Apply-Update.ps1');
      await fs.copyFile(path.join(this.root, 'tools/Apply-Update.ps1'), helper);
      this.pending = { filename, helper, manifest };
      this.notify(`Version ${manifest.version} prête — installation à la fermeture`);
    } catch (error) {
      this.notify(error.code === 'ENOENT' ? 'Mise à jour automatique disponible avec l’installateur Windows' : `Mise à jour indisponible : ${error.message}`);
    } finally { this.busy = false; }
  }
  async installOnExit() {
    this.disabled = true;
    if (!this.pending) return;
    const { filename, helper, manifest } = this.pending;
    // Recheck immediately before handing off. Helper checks again after this process exits.
    verifyInstaller(await fs.readFile(filename), manifest);
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helper,
      '-Installer', filename, '-InstallDirectory', this.root, '-Sha256', manifest.sha256, '-ParentId', String(process.pid)],
      { detached: true, windowsHide: true, stdio: 'ignore' });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
  }
}
module.exports = { Updater, validateManifest, isNewer, verifyInstaller };
