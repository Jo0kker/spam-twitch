// Stage large public artifacts through small ZIP builds without changing proxy limits.
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve('.');
const output = join(root, '.runtime/desktop-deploy');
await mkdir(output, { recursive: true });
const image = 'spam-twitch-spamtwitchebs-ekxvp1:latest';
const manifest = JSON.parse(await readFile(join(root, 'server/site/downloads.json'), 'utf8'));
const stages = [];
const sourceParts = [];
const quote = value => `'${value.replaceAll("'", "''")}'`;
async function zip(directory, name) {
  const destination = join(output, name + '.zip');
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path ${quote(join(directory, '*'))} -DestinationPath ${quote(destination)} -CompressionLevel NoCompression -Force`], { windowsHide: true, stdio: 'pipe' });
  stages.push(destination);
}
for (const [kind, artifact] of [['setup', manifest], ['portable', manifest.portable]]) {
  const bytes = await readFile(join(root, 'downloads', artifact.filename));
  const parts = [];
  for (let offset = 0, index = 0; offset < bytes.length; offset += 64000000, index++) {
    const name = `${kind}-${String(index).padStart(3, '0')}.part`;
    parts.push(`/input/${name}`);
    const stageName = `part-${String(stages.length + 1).padStart(2, '0')}`;
    const directory = join(output, stageName);
    await mkdir(join(directory, 'chunks'), { recursive: true });
    await writeFile(join(directory, 'chunks', name), bytes.subarray(offset, offset + 64000000));
    await writeFile(join(directory, 'Dockerfile'), `FROM ${image}\nUSER root\nCOPY chunks/${name} /release-chunks/${name}\nUSER node\n`);
    await zip(directory, stageName);
  }
  sourceParts.push({ artifact, parts });
}
const finalDirectory = join(output, 'final');
await mkdir(finalDirectory, { recursive: true });
for (const file of ['server', 'extension', 'package.json']) await cp(join(root, file), join(finalDirectory, file), { recursive: true });
const assembly = sourceParts.map(({ artifact, parts }) => `cat ${parts.join(' ')} > /app/downloads/${artifact.filename} && echo '${artifact.sha256}  /app/downloads/${artifact.filename}' | sha256sum -c -`).join(' && ');
await writeFile(join(finalDirectory, 'Dockerfile'), `# syntax=docker/dockerfile:1\nFROM ${image} AS archive\nFROM node:24-alpine\nWORKDIR /app\nENV NODE_ENV=production HOST=0.0.0.0 PORT=8788 EBS_DATA_PATH=/data/credentials.json\nCOPY package.json ./\nCOPY server ./server\nCOPY extension ./extension\nCOPY --from=archive /release-chunks /release-chunks\nRUN --mount=type=bind,from=archive,source=/release-chunks,target=/input mkdir /app/downloads && ${assembly}\nRUN mkdir /data && chown node:node /data\nUSER node\nVOLUME ["/data"]\nEXPOSE 8788\nHEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8788/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"\nCMD ["node", "server/ebs.mjs"]\n`);
await zip(finalDirectory, 'final');
await writeFile(join(output, 'sequence.json'), JSON.stringify({ stages, installerSha256: manifest.sha256, portableSha256: manifest.portable.sha256 }, null, 2));
console.log(JSON.stringify({ stages, installerSha256: manifest.sha256 }, null, 2));
