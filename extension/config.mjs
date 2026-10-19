const $ = selector => document.querySelector(selector);
let auth, backend = '', connection, revokeId = '', issuedAt = 0, expiresAt = 0, connectionBusy = false;
const date = value => value ? new Date(value).toLocaleString('fr-FR') : 'Non disponible';
const message = (value, error = false) => { $('#message').textContent = value; $('#message').classList.toggle('error', error); };
async function api(path, method = 'GET', input) {
  if (!auth) throw new Error('Ouvrez cette configuration depuis le tableau de bord Twitch.');
  const response = await fetch(backend + path, { method, headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' }, body: input === undefined ? undefined : JSON.stringify(input), signal: AbortSignal.timeout(10000) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || `Erreur ${response.status}`); return result;
}
async function connect() {
  const url = new URL($('#backend').value.trim());
  if (url.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:')) throw new Error('Le serveur doit utiliser HTTPS.');
  backend = url.origin;
  const result = await api('/api/layout');
  for (const [key, value] of Object.entries(result.layout)) { const input = $('#layout-form').elements.namedItem(key); if (input) input.value = key === 'delayOffsetMs' ? value / 1000 : value * 100; }
  window.Twitch.ext.configuration.set('broadcaster', '1', JSON.stringify({ backendUrl: backend }));
  $('#pair').disabled = false; $('#save-layout').disabled = false;
  await refreshConnection();
  message('Serveur connecté. L’état de votre PC est affiché ci-dessous.');
}
async function refreshConnection() {
  if (!backend || !auth || connectionBusy) return;
  connectionBusy = true;
  try {
    connection = await api('/api/connection');
    const device = connection.device;
    $('#connection-title').textContent = !device ? 'Aucun PC associé' : device.active ? device.transmitting ? 'PC connecté · transmission active' : 'PC connecté · en attente du jeu' : 'PC associé · hors ligne';
    $('#connection-card').classList.toggle('connected', !!device?.active);
    $('#connection-detail').textContent = device ? `${device.name} · chaîne ${connection.channelId}` : 'Aucun ordinateur ne possède actuellement d’accès à cette chaîne.';
    $('#connection-dates').textContent = device ? `Associé le : ${date(device.pairedAt)} · Dernier contact : ${date(device.lastSeenAt)}` : '';
    $('#connection-publish').textContent = device?.lastPublishAt ? `Dernier envoi : ${date(device.lastPublishAt)} · ${device.cards} carte(s) reçue(s)` : device ? 'Aucune donnée du jeu reçue depuis le démarrage du serveur.' : '';
    $('#revoke').hidden = !device; $('#revoke').disabled = false;
    $('#cancel-code').hidden = !connection.pendingCode;
    if (!connection.pendingCode || (expiresAt && connection.pendingCode.expiresAt !== expiresAt)) {
      if (expiresAt) $('#expiry').textContent = device?.pairedAt >= issuedAt ? 'Code utilisé : association enregistrée.' : Date.now() >= expiresAt ? 'Code expiré. Générez un nouveau code.' : 'Ce code a été annulé ou remplacé.';
      expiresAt = 0; $('#code').value = ''; $('#code').hidden = true;
    }
    if (connection.pendingCode && !expiresAt) $('#expiry').textContent = 'Un code est en attente dans un autre onglet. Vous pouvez l’annuler ou en générer un nouveau.';
  } catch (error) {
    $('#connection-title').textContent = 'Impossible de vérifier la connexion'; $('#connection-card').classList.remove('connected'); $('#revoke').disabled = true;
    message(error.message, true);
  } finally { connectionBusy = false; }
}
setInterval(() => { if (expiresAt) { const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)); $('#expiry').textContent = seconds ? `Code en attente · expire dans ${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s. Une seule utilisation.` : 'Code expiré. Générez un nouveau code.'; if (!seconds) { expiresAt = 0; $('#code').value = ''; $('#code').hidden = true; } } }, 1000);
setInterval(() => void refreshConnection(), 5000);
$('#backend-form').addEventListener('submit', async event => { event.preventDefault(); try { await connect(); } catch (error) { message(error.message, true); } });
$('#pair').addEventListener('click', async () => {
  $('#pair').disabled = true;
  try { const result = await api('/api/pair-code', 'POST', {}); issuedAt = Date.now(); expiresAt = result.expiresAt; $('#code').value = result.code; $('#code').hidden = false; $('#expiry').textContent = 'Code en attente · valable 5 minutes, utilisable une seule fois.'; $('#cancel-code').hidden = false; message('Saisissez ce code dans le compagnon. L’état changera automatiquement après validation.'); }
  catch (error) { message(error.message, true); }
  finally { $('#pair').disabled = false; }
});
$('#cancel-code').addEventListener('click', async () => { try { await api('/api/pair-code/cancel', 'POST', {}); await refreshConnection(); message('Code annulé. L’association existante est conservée.'); } catch (error) { message(error.message, true); } });
$('#revoke').addEventListener('click', () => { revokeId = connection?.device?.id || ''; $('#revoke-confirm').hidden = false; });
$('#cancel-revoke').addEventListener('click', () => { $('#revoke-confirm').hidden = true; });
$('#confirm-revoke').addEventListener('click', async () => {
  $('#confirm-revoke').disabled = true;
  try { await api('/api/connection/revoke', 'POST', { connectionId: revokeId }); $('#revoke-confirm').hidden = true; await refreshConnection(); message('Accès révoqué. Cet ordinateur ne peut plus transmettre. Les codes en attente sont annulés.'); }
  catch (error) { message(error.message, true); }
  finally { $('#confirm-revoke').disabled = false; }
});
$('#layout-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { const layout = Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, Number(value) * (key === 'delayOffsetMs' ? 1000 : .01)])); await api('/api/layout', 'PUT', layout); message('Alignement enregistré pour cette chaîne.'); }
  catch (error) { message(error.message, true); }
});
let initialized = false;
async function initialize() {
  if (!auth || initialized) return;
  let config = {};
  try { config = await fetch('runtime-config.json').then(response => response.json()); } catch {}
  for (const segment of ['global', 'broadcaster']) { try { config = { ...config, ...JSON.parse(window.Twitch.ext.configuration[segment]?.content || '{}') }; } catch {} }
  if (config.backendUrl) { initialized = true; $('#backend').value = config.backendUrl; try { await connect(); } catch (error) { message(error.message, true); } }
  else message('Renseignez l’adresse du serveur pour commencer.');
}
if (window.Twitch?.ext) {
  window.Twitch.ext.onAuthorized(async value => { auth = value; await initialize(); });
  window.Twitch.ext.configuration.onChanged(initialize);
} else message('Cette page se configure depuis Twitch. L’aperçu local des cartes est disponible dans l’application.', true);
