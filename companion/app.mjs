const $ = selector => document.querySelector(selector);
if (new URLSearchParams(location.search).get('desktop') === '1') $('#desktop-lifecycle').hidden = false;
let token = '', demo = false, busy = false, notifiedError = '', associationView = '';
const date = value => value ? new Date(value).toLocaleString('fr-FR') : 'Non disponible';
const toast = (message, error = false) => { const node = $('#toast'); node.textContent = message; node.hidden = false; node.classList.toggle('error', error); clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.hidden = true; }, 7000); };
async function api(path, method = 'GET', data) {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'x-local-token': token }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || `Erreur ${response.status}`); return result;
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
    $('#game-status').textContent = connected ? 'SPAM connecté' : demo ? 'Mode démonstration' : 'En attente du jeu';
    $('#game-dot').classList.toggle('online', connected || demo);
    $('#game-detail').textContent = connected ? 'Le connecteur reçoit les cartes en direct.' : demo ? 'Cartes et talents fictifs · aperçu local uniquement.' : status.pluginInstalled ? 'Ouvrez SPAM et un écran avec des cartes.' : 'Installez le connecteur, puis relancez SPAM.';
    $('#card-count').textContent = status.cards;
    $('#scene-detail').textContent = connected ? `Écran : ${status.scene || 'SPAM'}` : demo ? 'Les exemples ne sont pas envoyés sur Twitch.' : 'Aucune donnée à afficher pour le moment.';
    const connection = status.connection || { state: 'checking' }, device = connection.device;
    const paired = !!status.config.channelId;
    const labels = { unpaired: 'À associer', checking: 'Vérification de l’accès…', active: device?.transmitting && !demo && connected ? 'Transmission active' : 'Association active', unreachable: 'Connexion indisponible', revoked: 'Accès révoqué ou remplacé' };
    $('#twitch-status').textContent = labels[connection.state] || 'Chaîne associée';
    $('#twitch-dot').classList.toggle('online', connection.state === 'active'); $('#twitch-dot').classList.toggle('error', ['unreachable', 'revoked'].includes(connection.state));
    $('#twitch-detail').textContent = paired ? `Chaîne ${status.config.channelId} · ${connection.state === 'revoked' ? 'Un nouveau code est nécessaire.' : device?.transmitting && !demo && connected ? 'Les cartes sont envoyées à l’extension.' : 'L’association reste enregistrée quand le jeu est fermé.'}` : 'Connectez votre chaîne pour diffuser les cartes.';
    $('#association-title').textContent = paired ? labels[connection.state] : 'Aucun PC associé depuis cette application';
    $('#association-card').classList.toggle('connected', connection.state === 'active');
    $('#association-detail').textContent = paired ? `${device?.name || status.config.deviceName || 'Ce PC'} · chaîne Twitch ${status.config.channelId}` : 'Saisissez un code généré dans la configuration Twitch. Après validation, l’association restera visible ici.';
    $('#association-date').textContent = paired ? `Associé le : ${date(device?.pairedAt)} · Dernier contact confirmé : ${date(connection.checkedAt)}` : '';
    $('#association-error').textContent = connection.error || '';
    $('#last-publish').textContent = device?.lastPublishAt ? `Dernier envoi accepté : ${date(device.lastPublishAt)} · ${device.cards} carte(s)` : paired ? 'Aucune donnée du jeu reçue pour le moment.' : '';
    const nextView = `${status.config.channelId}:${connection.state === 'revoked'}`;
    if (associationView !== nextView) { $('#pair-more').open = !paired || connection.state === 'revoked'; associationView = nextView; }
    $('#preview-source').textContent = demo ? 'DÉMONSTRATION' : connected ? 'DONNÉES DU JEU' : 'EN ATTENTE';
    $('#preview-source').classList.toggle('live', connected); $('#preview-source').classList.toggle('demo', demo);
    $('#demo-button').textContent = demo ? 'Revenir au jeu' : 'Tester cartes et talents';
    $('#last-sync').textContent = status.lastFrameAt ? `Dernière lecture : ${new Date(status.lastFrameAt).toLocaleTimeString('fr-FR')}` : 'En attente de données';
    $('#unpair').hidden = !status.config.channelId;
    $('#unpair').textContent = connection.state === 'revoked' ? 'Effacer cette ancienne association' : 'Révoquer l’accès de ce PC';
    $('#install-button').textContent = status.pluginInstalled ? 'Actualiser le module SPAM' : 'Préparer SPAM'; $('#install-button').disabled = busy;
    if (document.activeElement !== $('#game-path') && !$('#game-path').value) $('#game-path').value = status.config.gamePath;
    if (document.activeElement !== $('#device-name') && !$('#device-name').value) $('#device-name').value = status.config.deviceName || 'PC de stream';
    if (status.error && status.error !== notifiedError) { notifiedError = status.error; toast(status.error, true); }
    if (!status.error) notifiedError = '';
    const data = await api('/api/local/state');
    const rows = (data.frames.at(-1)?.cards || []).map(card => {
      const row = document.createElement('tr');
      for (const value of [card.name, card.side === 'ally' ? 'Allié' : card.side === 'opponent' ? 'Adversaire' : 'Collection', card.abilities.map(ability => ability.name).join('\n')]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      return row;
    });
    if (!rows.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 3; cell.textContent = 'Aucune donnée. Ouvrez la collection ou une partie dans SPAM.'; row.append(cell); rows.push(row); }
    $('#cards-data').replaceChildren(...rows);
  } catch { $('#game-status').textContent = 'Application arrêtée'; $('#game-dot').classList.remove('online'); }
}
$('#demo-button').addEventListener('click', event => action(event.currentTarget, async () => { await api('/api/local/demo', 'POST', { enabled: !demo }); $('#preview').contentWindow.location.reload(); }));
$('#pair-form').addEventListener('submit', event => { event.preventDefault(); void action(event.submitter, async () => { await api('/api/local/pair', 'POST', { code: $('#pair-code').value.replace(/\s/g, '').toUpperCase(), deviceName: $('#device-name').value.trim() }); $('#pair-code').value = ''; $('#pair-more').open = false; $('#revoke-confirm').hidden = true; toast('PC associé à Twitch. Vous pouvez lancer SPAM et votre live.'); }); });
$('#unpair').addEventListener('click', () => { $('#revoke-confirm').hidden = false; });
$('#cancel-revoke').addEventListener('click', () => { $('#revoke-confirm').hidden = true; });
$('#confirm-revoke').addEventListener('click', event => action(event.currentTarget, async () => { await api('/api/local/unpair', 'POST', {}); $('#revoke-confirm').hidden = true; toast('Accès révoqué : ce PC ne peut plus transmettre à la chaîne.'); }));
$('#game-form').addEventListener('submit', event => { event.preventDefault(); void action(event.submitter, async () => { await api('/api/local/settings', 'PUT', { gamePath: $('#game-path').value.trim() }); toast('Dossier du jeu enregistré.'); }); });
$('#install-button').addEventListener('click', event => action(event.currentTarget, async () => { await api('/api/local/settings', 'PUT', { gamePath: $('#game-path').value.trim() }); const result = await api('/api/local/install', 'POST', {}); toast(result.message); }));
try { const bootstrap = await api('/api/local/bootstrap'); token = bootstrap.token; $('#device-name').value = bootstrap.config.deviceName || 'PC de stream'; $('#game-path').value = bootstrap.config.gamePath; await refresh(); setInterval(refresh, 1500); }
catch (error) { toast(`Impossible de joindre l’application : ${error.message}`, true); }
