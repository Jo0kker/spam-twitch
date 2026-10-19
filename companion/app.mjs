const $ = selector => document.querySelector(selector);
if (new URLSearchParams(location.search).get('desktop') === '1') $('#desktop-lifecycle').hidden = false;
let token = '', demo = false, busy = false, notifiedError = '';
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
    const connected = status.connector === 'connected';
    $('#game-status').textContent = connected ? 'SPAM connecté' : demo ? 'Mode démonstration' : 'En attente du jeu';
    $('#game-dot').classList.toggle('online', connected || demo);
    $('#game-detail').textContent = connected ? 'Le connecteur reçoit les cartes en direct.' : demo ? 'Cartes fictives · aperçu local uniquement.' : status.pluginInstalled ? 'Ouvrez SPAM et un écran avec des cartes.' : 'Installez le connecteur, puis relancez SPAM.';
    $('#card-count').textContent = status.cards;
    $('#scene-detail').textContent = connected ? `Écran : ${status.scene || 'SPAM'}` : demo ? 'Les exemples ne sont pas envoyés sur Twitch.' : 'Aucune donnée à afficher pour le moment.';
    $('#twitch-status').textContent = status.remote === 'connected' ? 'Transmission active' : status.remote === 'error' ? 'Connexion interrompue' : status.config.channelId ? 'Chaîne associée' : 'À associer';
    $('#twitch-dot').classList.toggle('online', status.remote === 'connected'); $('#twitch-dot').classList.toggle('error', status.remote === 'error');
    $('#twitch-detail').textContent = status.config.channelId ? `Chaîne ${status.config.channelId} · ${status.remote === 'connected' ? 'Les cartes sont envoyées à l’extension.' : 'En attente de transmission.'}` : 'Connectez votre chaîne pour diffuser les cartes.';
    $('#preview-source').textContent = demo ? 'DÉMONSTRATION' : connected ? 'DONNÉES DU JEU' : 'EN ATTENTE';
    $('#preview-source').classList.toggle('live', connected); $('#preview-source').classList.toggle('demo', demo);
    $('#demo-button').textContent = demo ? 'Revenir au jeu' : 'Essayer une démo';
    $('#last-sync').textContent = status.lastFrameAt ? `Dernière lecture : ${new Date(status.lastFrameAt).toLocaleTimeString('fr-FR')}` : 'En attente de données';
    $('#unpair').hidden = !status.config.channelId;
    $('#install-button').textContent = status.pluginInstalled ? 'Connecteur installé ✓' : 'Installer le connecteur'; $('#install-button').disabled = status.pluginInstalled;
    if (document.activeElement !== $('#game-path') && !$('#game-path').value) $('#game-path').value = status.config.gamePath;
    if (document.activeElement !== $('#backend-url') && !$('#backend-url').value) $('#backend-url').value = status.config.backendUrl;
    if (status.error && status.error !== notifiedError) { notifiedError = status.error; toast(status.error, true); }
    if (!status.error) notifiedError = '';
  } catch { $('#game-status').textContent = 'Application arrêtée'; $('#game-dot').classList.remove('online'); }
}
$('#demo-button').addEventListener('click', event => action(event.currentTarget, async () => { await api('/api/local/demo', 'POST', { enabled: !demo }); $('#preview').contentWindow.location.reload(); }));
$('#pair-form').addEventListener('submit', event => { event.preventDefault(); void action(event.submitter, async () => { await api('/api/local/pair', 'POST', { backendUrl: $('#backend-url').value.trim(), code: $('#pair-code').value.trim() }); $('#pair-code').value = ''; toast('Votre PC est associé à la chaîne Twitch.'); }); });
$('#unpair').addEventListener('click', event => action(event.currentTarget, async () => { await api('/api/local/unpair', 'POST', {}); toast('Ce PC est dissocié de la chaîne.'); }));
$('#game-form').addEventListener('submit', event => { event.preventDefault(); void action(event.submitter, async () => { await api('/api/local/settings', 'PUT', { gamePath: $('#game-path').value.trim() }); toast('Dossier du jeu enregistré.'); }); });
$('#install-button').addEventListener('click', event => action(event.currentTarget, async () => { await api('/api/local/settings', 'PUT', { gamePath: $('#game-path').value.trim() }); const result = await api('/api/local/install', 'POST', {}); toast(result.message); }));
try { const bootstrap = await api('/api/local/bootstrap'); token = bootstrap.token; $('#game-path').value = bootstrap.config.gamePath; $('#backend-url').value = bootstrap.config.backendUrl || 'https://spam-twitch.codible.net'; await refresh(); setInterval(refresh, 1500); }
catch (error) { toast(`Impossible de joindre l’application : ${error.message}`, true); }
