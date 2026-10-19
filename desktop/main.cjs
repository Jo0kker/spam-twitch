const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const runFile = promisify(execFile);
const { Updater } = require('./updater.cjs');
const updateConfig = require('./update-config.json');
const { version } = require('./package.json');
const root = app.isPackaged ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
const lifecycleTest = process.argv.includes('--lifecycle-test');
const testDirectory = lifecycleTest && process.env.SPAM_DESKTOP_TEST_DIR;
if (lifecycleTest && !testDirectory) { app.exit(2); return; }
const runtime = testDirectory ? path.resolve(testDirectory) : path.join(root, '.runtime');
app.setName('SPAM Card Inspector');
app.setAppUserModelId('net.codible.spam.inspector');
if (testDirectory) app.setPath('userData', path.join(runtime, 'profile'));
const quitRequested = process.argv.includes('--quit');
const ownsLock = app.requestSingleInstanceLock({ quit: quitRequested });
let window, server, stopping = false, origin = '';
let updater, updateLabel = { label: 'Recherche de mise à jour…', enabled: false };
function refreshMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Application', submenu: [updateLabel, { label: 'Rechercher une mise à jour', click: () => updater?.check() }, { type: 'separator' }, { label: 'Quitter', click: () => app.quit() }] },
    { label: 'Affichage', submenu: [{ role: 'resetZoom', label: 'Taille normale' }, { role: 'zoomIn', label: 'Agrandir' }, { role: 'zoomOut', label: 'Réduire' }] }
  ]));
}
const recordPath = path.join(runtime, 'desktop-process.json');
const report = { processId: process.pid, loaded: false, windowClosed: false, serverClosed: false, secondInstances: 0, quitRequested: false };
async function finish() {
  if (finish.started) return;
  finish.started = true;
  if (!testDirectory) {
    try { await updater?.installOnExit(); }
    catch (error) { dialog.showErrorBox('Mise à jour non installée', error.message + '\nLa version actuelle reste utilisable.'); }
  }
  try {
    const record = JSON.parse(await fs.readFile(recordPath, 'utf8'));
    if (record.processId === process.pid) await fs.unlink(recordPath);
  } catch {}
  if (testDirectory) await fs.writeFile(path.join(runtime, 'lifecycle-report.json'), JSON.stringify(report));
  app.exit(0);
}
app.on('before-quit', event => {
  if (!server) return;
  event.preventDefault();
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  server.close(() => { report.serverClosed = true; void finish(); });
  setTimeout(() => void finish(), 3000).unref();
});
app.on('window-all-closed', () => app.quit());
app.on('second-instance', (_event, _argv, _directory, data) => {
  report.secondInstances++;
  if (data?.quit) {
    report.quitRequested = true;
    // An installer/uninstaller already owns this shutdown; never start a second installer.
    if (updater) { updater.pending = null; updater.disabled = true; }
    app.quit(); return;
  }
  if (window && !testDirectory) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
});
if (!ownsLock || quitRequested) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    await fs.mkdir(runtime, { recursive: true });
    // Migrate only the old daemon owned by this installation, before registering this app.
    if (!testDirectory) await runFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'tools/Start-Companion.ps1'), '-Stop', '-LegacyOnly'], { windowsHide: true, timeout: 10000 });
    const { createLocal } = await import(pathToFileURL(path.join(root, 'server/local.mjs')).href);
    ({ server } = await createLocal({ runtimePath: runtime }));
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    origin = `http://127.0.0.1:${server.address().port}`;
    await fs.writeFile(recordPath, JSON.stringify({ processId: process.pid, executable: process.execPath, appRoot: root, port: server.address().port }));
    window = new BrowserWindow({ width: 1320, height: 940, minWidth: 900, minHeight: 650, show: false,
      title: 'SPAM Card Inspector', backgroundColor: '#101713',
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
    refreshMenu();
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
    window.webContents.on('render-process-gone', () => { if (!stopping) app.quit(); });
    window.on('closed', () => { report.windowClosed = true; window = null; });
    window.once('ready-to-show', () => { if (!testDirectory) window.show(); });
    await window.loadURL(origin + '/?desktop=1');
    if (!testDirectory && app.isPackaged) {
      updater = new Updater({ config: updateConfig, currentVersion: version, root,
        cache: path.join(app.getPath('userData'), 'updates'),
        notify: label => { updateLabel = { label, enabled: false }; refreshMenu(); } });
      void updater.check();
      setInterval(() => void updater.check(), 4 * 60 * 60 * 1000).unref();
    }
    if (testDirectory) {
      const response = await fetch(origin + '/api/local/status');
      report.loaded = response.ok;
      report.port = server.address().port;
      report.ownedProcessIds = app.getAppMetrics().map(item => item.pid);
      await fs.writeFile(path.join(runtime, 'lifecycle-ready.json'), JSON.stringify(report));
      setTimeout(() => window.close(), process.argv.includes('--lifecycle-hold') ? 10000 : 300);
    }
  }).catch(async error => {
    if (stopping) return;
    if (testDirectory) { await fs.mkdir(runtime, { recursive: true }); await fs.writeFile(path.join(runtime, 'lifecycle-error.txt'), error.stack || error.message); app.exit(1); }
    else { dialog.showErrorBox('SPAM Card Inspector', `Impossible de démarrer l’application.\n${error.message}`); app.quit(); }
  });
}
