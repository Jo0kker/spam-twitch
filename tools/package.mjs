import { cp, mkdir, readFile, writeFile, stat, rename, unlink } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const dist = join(root, 'dist'); await mkdir(dist, { recursive: true });
const folder = join(dist, `SPAM-Twitch-Companion-${version}`); await mkdir(folder, { recursive: true });
for (const file of ['companion', 'extension', 'server', 'tools/Start-Companion.ps1', 'tools/Launch-Companion.ps1', 'tools/Install-Connector.ps1', 'tools/Build-Connector.ps1', 'tools/Apply-Update.ps1', 'connector/SpamTwitchPlugin.cs', 'Start-Spam-Twitch.cmd', 'Stop-Spam-Twitch.cmd', 'LICENSE', 'README.md', 'THIRD-PARTY-NOTICES.md', 'docs/TWITCH-SETUP.md', 'docs/DOKPLOY.md']) {
  await mkdir(dirname(join(folder, file)), { recursive: true }); await cp(join(root, file), join(folder, file), { recursive: true });
}
// Connector compilation uses the player's own game references on first installation.
await unlink(join(folder, 'connector/bin/SpamTwitchConnector.dll')).catch(error => { if (error.code !== 'ENOENT') throw error; });
await mkdir(join(folder, 'runtime'), { recursive: true });
// Remove the old standalone Node binary from the managed staging folder only.
await unlink(join(folder, 'runtime/node.exe')).catch(error => { if (error.code !== 'ENOENT') throw error; });
await cp(join(root, 'third-party/NODE-LICENSE.txt'), join(folder, 'runtime/NODE-LICENSE.txt'));
await cp(join(root, '.tools/bepinex'), join(folder, '.tools/bepinex'), { recursive: true });
await cp(join(root, 'third-party/BEPINEX-LICENSE.txt'), join(folder, '.tools/bepinex/BEPINEX-LICENSE.txt'));
await cp(join(root, '.tools/electron'), folder, { recursive: true });
await rename(join(folder, 'electron.exe'), join(folder, 'SpamCardInspector.exe'));
await cp(join(root, 'desktop'), join(folder, 'resources/app'), { recursive: true });
const extensionFolder = join(dist, 'extension-assets'); await cp(join(root, 'extension'), extensionFolder, { recursive: true });
const backendArgument = process.argv.find(argument => argument.startsWith('--backend-url='));
if (backendArgument) {
  const url = new URL(backendArgument.slice('--backend-url='.length));
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/') throw new Error('Le backend doit être une origine HTTPS.');
  await writeFile(join(extensionFolder, 'runtime-config.json'), JSON.stringify({ backendUrl: url.origin }));
}
const quote = value => `'${value.replaceAll("'", "''")}'`;
function archiveFolder(source, destination) {
  const archive = join(dist, destination);
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path ${quote(join(source, '*'))} -DestinationPath ${quote(archive)} -Force`], { windowsHide: true, stdio: 'pipe' });
  return archive;
}
const companionArchive = archiveFolder(folder, `SPAM-Twitch-Companion-${version}.zip`);
const extensionArchive = archiveFolder(extensionFolder, `SPAM-Twitch-Extension-${version}.zip`);
execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'tools/Build-Installer.ps1'), '-SourceFolder', folder, '-OutputFolder', dist], { windowsHide: true, stdio: 'pipe' });
const installer = join(dist, `SPAM-Twitch-Setup-${version}.exe`);
const downloadDirectory = join(root, 'downloads'); await mkdir(downloadDirectory, { recursive: true });
await cp(companionArchive, join(downloadDirectory, `SPAM-Twitch-Companion-${version}.zip`));
await cp(installer, join(downloadDirectory, `SPAM-Twitch-Setup-${version}.exe`));
const artifact = async (filename) => { const bytes = await readFile(join(downloadDirectory, filename)); return { filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; };
await writeFile(join(root, 'server/site/downloads.json'), JSON.stringify({ version, ...await artifact(`SPAM-Twitch-Setup-${version}.exe`), portable: await artifact(`SPAM-Twitch-Companion-${version}.zip`) }, null, 2));
if (process.argv.includes('--skip-ebs')) {
  for (const archive of [companionArchive, installer, extensionArchive]) console.log(`${archive} (${Math.round((await stat(archive)).size / 1024)} Ko)`);
  process.exit(0);
}
const ebsFolder = join(dist, 'ebs'); await mkdir(ebsFolder, { recursive: true });
for (const file of ['server', 'extension', 'downloads', 'package.json', '.env.example', 'Dockerfile', '.dockerignore', 'README.md', 'THIRD-PARTY-NOTICES.md', 'docs/TWITCH-SETUP.md', 'docs/DOKPLOY.md']) {
  await mkdir(dirname(join(ebsFolder, file)), { recursive: true }); await cp(join(root, file), join(ebsFolder, file), { recursive: true });
}
const ebsArchive = archiveFolder(ebsFolder, `SPAM-Twitch-EBS-${version}.zip`);
for (const archive of [companionArchive, installer, extensionArchive, ebsArchive]) console.log(`${archive} (${Math.round((await stat(archive)).size / 1024)} Ko)`);
