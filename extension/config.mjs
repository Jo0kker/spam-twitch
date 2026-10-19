const $ = selector => document.querySelector(selector);
let auth, backend = '';
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
  message('Serveur connecté. Vous pouvez associer votre PC.');
}
$('#backend-form').addEventListener('submit', async event => { event.preventDefault(); try { await connect(); } catch (error) { message(error.message, true); } });
$('#pair').addEventListener('click', async () => {
  $('#pair').disabled = true;
  try { const result = await api('/api/pair-code', 'POST', {}); $('#code').value = result.code; $('#code').hidden = false; $('#expiry').textContent = 'Code valable 5 minutes, utilisable une seule fois.'; message('Saisissez ce code dans l’application de votre PC.'); }
  catch (error) { message(error.message, true); }
  finally { $('#pair').disabled = false; }
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
