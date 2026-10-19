import { t, message, getLanguage, setLanguage } from './language.mjs';
const $ = selector => document.querySelector(selector);
if (new URLSearchParams(location.search).get('desktop') === '1') $('#desktop-lifecycle').hidden = false;
let token = '', demo = false, busy = false, notifiedError = '', associationView = '';
let languageSave = Promise.resolve();
const date = value => value ? new Date(value).toLocaleString(getLanguage()) : t('Non disponible');
const translateMessage = message;
const toast = (message, error = false) => { const node = $('#toast'); node.textContent = translateMessage(message); node.hidden = false; node.classList.toggle('error', error); clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.hidden = true; }, 7000); };
async function api(path, method = 'GET', data) {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'x-local-token': token }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json(); if (!response.ok) throw new Error(message(result.error || '') || `${t('Erreur ')}${response.status}`); return result;
}
async function action(button, callback) {
  if (busy) return; busy = true; if (button) button.disabled = true;
  try { await callback(); await refresh(); } catch (error) { toast(error.message, true); }
  finally { busy = false; if (button) button.disabled = false; }
}
async function refresh() {
  try {
    const status = await api('/api/local/status'); demo = status.demo;
    $('#app-version').textContent = status.version || '';
    const connected = status.connector === 'connected';
    $('#game-status').textContent = connected ? t('SPAM connecté') : demo ? t('Mode démonstration') : t('En attente du jeu');
    $('#game-dot').classList.toggle('online', connected || demo);
    $('#game-detail').textContent = connected ? t('Le connecteur reçoit les cartes en direct.') : demo ? t('Cartes et talents fictifs · aperçu local uniquement.') : status.pluginInstalled ? t('Ouvrez SPAM et un écran avec des cartes.') : t('Installez le connecteur, puis relancez SPAM.');
    $('#card-count').textContent = status.cards;
    $('#scene-detail').textContent = connected ? t('Écran : {scene}', {scene: status.scene || 'SPAM'}) : demo ? t('Les exemples ne sont pas envoyés sur Twitch.') : t('Aucune donnée à afficher pour le moment.');
    const connection = status.connection || { state: 'checking' }, device = connection.device;
    const paired = !!status.config.channelId;
    const labels = { unpaired: t('À associer'), checking: t('Vérification de l’accès…'), active: device?.transmitting && !demo && connected ? t('Transmission active') : t('Association active'), unreachable: t('Connexion indisponible'), revoked: t('Accès révoqué ou remplacé') };
    $('#twitch-status').textContent = labels[connection.state] || t('Chaîne associée');
    $('#twitch-dot').classList.toggle('online', connection.state === 'active'); $('#twitch-dot').classList.toggle('error', ['unreachable', 'revoked'].includes(connection.state));
    $('#twitch-detail').textContent = paired ? t('Chaîne {channel} · {detail}', {channel: status.config.channelId, detail: connection.state === 'revoked' ? t('Un nouveau code est nécessaire.') : device?.transmitting && !demo && connected ? t('Les cartes sont envoyées à l’extension.') : t('L’association reste enregistrée quand le jeu est fermé.')}) : t('Connectez votre chaîne pour diffuser les cartes.');
    $('#association-title').textContent = paired ? labels[connection.state] : t('Aucun PC associé depuis cette application');
    $('#association-card').classList.toggle('connected', connection.state === 'active');
    $('#association-detail').textContent = paired ? t('{device} · chaîne Twitch {channel}', {device: device?.name || status.config.deviceName || t('Ce PC'), channel: status.config.channelId}) : t('Saisissez un code généré dans la configuration Twitch. Après validation, l’association restera visible ici.');
    $('#association-date').textContent = paired ? t('Associé le : {paired} · Dernier contact confirmé : {checked}', {paired: date(device?.pairedAt), checked: date(connection.checkedAt)}) : '';
    $('#association-error').textContent = message(connection.error || '');
    $('#last-publish').textContent = device?.lastPublishAt ? t('Dernier envoi accepté : {date} · {count} carte(s)', {date: date(device.lastPublishAt), count: device.cards}) : paired ? t('Aucune donnée du jeu reçue pour le moment.') : '';
    const nextView = `${status.config.channelId}:${connection.state === 'revoked'}`;
    if (associationView !== nextView) { $('#pair-more').open = !paired || connection.state === 'revoked'; associationView = nextView; }
    $('#preview-source').textContent = demo ? t('DÉMONSTRATION') : connected ? t('DONNÉES DU JEU') : t('EN ATTENTE');
    $('#preview-source').classList.toggle('live', connected); $('#preview-source').classList.toggle('demo', demo);
    $('#demo-button').textContent = demo ? t('Revenir au jeu') : t('Tester cartes et talents');
    $('#last-sync').textContent = status.lastFrameAt ? t('Dernière lecture : {time}', {time: new Date(status.lastFrameAt).toLocaleTimeString(getLanguage())}) : t('En attente de données');
    $('#unpair').hidden = !status.config.channelId;
    $('#unpair').textContent = connection.state === 'revoked' ? t('Effacer cette ancienne association') : t('Révoquer l’accès de ce PC');
    $('#install-button').textContent = status.pluginInstalled ? t('Actualiser le module SPAM') : t('Préparer SPAM'); $('#install-button').disabled = busy;
    if (document.activeElement !== $('#game-path') && !$('#game-path').value) $('#game-path').value = status.config.gamePath;
    if (document.activeElement !== $('#device-name') && !$('#device-name').value) $('#device-name').value = status.config.deviceName || 'PC de stream';
    if (status.error && status.error !== notifiedError) { notifiedError = status.error; toast(status.error, true); }
    if (!status.error) notifiedError = '';
    const data = await api('/api/local/state');
    const rows = (data.frames.at(-1)?.cards || []).map(card => {
      const row = document.createElement('tr');
      for (const value of [card.name, card.side === 'ally' ? t('Allié') : card.side === 'opponent' ? t('Adversaire') : 'Collection', card.abilities.map(ability => ability.name).join('\n')]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      return row;
    });
    if (!rows.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 3; cell.textContent = t('Aucune donnée. Ouvrez la collection ou une partie dans SPAM.'); row.append(cell); rows.push(row); }
    $('#cards-data').replaceChildren(...rows);
  } catch { $('#game-status').textContent = t('Application arrêtée'); $('#game-dot').classList.remove('online'); }
}
$('#demo-button').addEventListener('click', event => action(event.currentTarget, async () => { await api('/api/local/demo', 'POST', { enabled: !demo }); $('#preview').contentWindow.location.reload(); }));
$('#pair-form').addEventListener('submit', event => { event.preventDefault(); void action(event.submitter, async () => { await api('/api/local/pair', 'POST', { code: $('#pair-code').value.replace(/\s/g, '').toUpperCase(), deviceName: $('#device-name').value.trim() }); $('#pair-code').value = ''; $('#pair-more').open = false; $('#revoke-confirm').hidden = true; toast(t('PC associé à Twitch. Vous pouvez lancer SPAM et votre live.')); }); });
$('#unpair').addEventListener('click', () => { $('#revoke-confirm').hidden = false; });
$('#cancel-revoke').addEventListener('click', () => { $('#revoke-confirm').hidden = true; });
$('#confirm-revoke').addEventListener('click', event => action(event.currentTarget, async () => { await api('/api/local/unpair', 'POST', {}); $('#revoke-confirm').hidden = true; toast(t('Accès révoqué : ce PC ne peut plus transmettre à la chaîne.')); }));
$('#game-form').addEventListener('submit', event => { event.preventDefault(); void action(event.submitter, async () => { await api('/api/local/settings', 'PUT', { gamePath: $('#game-path').value.trim() }); toast(t('Dossier du jeu enregistré.')); }); });
$('#install-button').addEventListener('click', event => action(event.currentTarget, async () => { await api('/api/local/settings', 'PUT', { gamePath: $('#game-path').value.trim() }); const result = await api('/api/local/install', 'POST', {}); toast(result.message); }));
window.addEventListener('languagechange', async () => {
  if (!token) return;
  const language = getLanguage();
  // Rapid FR/EN changes must not race writes to the same settings file.
  languageSave = languageSave.catch(() => {}).then(() => api('/api/local/settings', 'PUT', {language}));
  try { await languageSave; } catch (error) { toast(error.message, true); }
  await refresh();
});
try { const bootstrap = await api('/api/local/bootstrap'); token = bootstrap.token; if (bootstrap.config.language) setLanguage(bootstrap.config.language, false); $('#device-name').value = bootstrap.config.deviceName || 'PC de stream'; $('#game-path').value = bootstrap.config.gamePath; await refresh(); setInterval(refresh, 1500); }
catch (error) { toast(t('Impossible de joindre l’application : {error}', {error: message(error.message)}), true); }
