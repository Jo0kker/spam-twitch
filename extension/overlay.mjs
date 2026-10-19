import { FrameBuffer, mapBounds } from './core.mjs';

const hotspots = document.querySelector('#hotspots'), tooltip = document.querySelector('#tooltip');
const notice = document.querySelector('#notice');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('local') === '1';
const buffer = new FrameBuffer(); const nodes = new Map();
let auth, backend = '', visible = true, latencyMs = 0, aspect = 16 / 9, frame, hoveredId = '';
let polling = false, pendingFetch = false, timer, renderTimer, adjustmentMs = 0, lastFailure = '', needsHistory = true;
const make = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = value; return node; };
const setNotice = value => { notice.textContent = value; notice.hidden = !value; };
const hideTooltip = () => { tooltip.hidden = true; hoveredId = ''; };
// Only the card keeps its details open; the tooltip never extends the hover area.
document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTooltip(); });
document.addEventListener('pointerdown', event => { if (!event.target.closest('.hotspot')) hideTooltip(); });
function showTooltip(card, node) {
  hoveredId = card.instanceId;
  const signature = JSON.stringify(card);
  if (tooltip.dataset.signature !== signature) {
    tooltip.dataset.signature = signature; tooltip.replaceChildren();
    const head = make('header', 'tooltip-head'); head.append(make('div', 'eyebrow', `${card.element || 'SPAM'} · ${card.side === 'opponent' ? 'Adversaire' : card.side === 'ally' ? 'Votre équipe' : 'Collection'}`), make('h1', '', card.name));
    tooltip.append(head);
    const abilities = make('section', 'abilities');
    for (const ability of card.abilities) {
      const row = make('article', 'ability'); const top = make('div', 'ability-top');
      top.append(make('div', 'ability-kind', ability.kind === 'active' ? 'Capacité active' : 'Effet passif'));
      if (ability.kind === 'active') top.append(make('span', 'cooldown', `↻ ${ability.cooldown} / ${ability.maxCooldown}`));
      row.append(top, make('h2', '', ability.name), make('p', '', ability.description)); abilities.append(row);
    }
    if (!card.abilities.length) abilities.append(make('p', 'ability', 'Aucune capacité affichée sur cette carte.'));
    tooltip.append(abilities);
  }
  tooltip.hidden = false;
  const rect = node.getBoundingClientRect();
  let left = rect.right + 8;
  if (left + tooltip.offsetWidth > innerWidth - 8) left = rect.left - tooltip.offsetWidth - 8;
  tooltip.style.left = `${Math.max(8, Math.min(innerWidth - tooltip.offsetWidth - 8, left))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(innerHeight - tooltip.offsetHeight - 8, rect.top))}px`;
}
function render() {
  if (!visible) return;
  const selected = buffer.select(Date.now(), latencyMs, adjustmentMs);
  frame = selected;
  const cards = frame?.cards || [];
  const ids = new Set(cards.map(card => card.instanceId));
  for (const [id, entry] of nodes) if (!ids.has(id)) { entry.button.remove(); entry.mock?.remove(); nodes.delete(id); }
  if (!ids.has(hoveredId)) hideTooltip();
  for (const card of cards) {
    const mapped = mapBounds(card.bounds, frame.layout, innerWidth, innerHeight, aspect);
    let entry = nodes.get(card.instanceId);
    if (!entry) {
      const button = make('button', 'hotspot'); button.type = 'button';
      entry = { button, card }; nodes.set(card.instanceId, entry);
      button.addEventListener('pointerenter', () => showTooltip(entry.card, button));
      button.addEventListener('focus', () => showTooltip(entry.card, button));
      button.addEventListener('pointerleave', hideTooltip);
      button.addEventListener('blur', hideTooltip);
      button.addEventListener('click', () => showTooltip(entry.card, button));
      if (local) { entry.mock = make('div', 'mock-card'); hotspots.append(entry.mock); }
      hotspots.append(button);
    }
    entry.card = card;
    entry.button.setAttribute('aria-label', `${card.name}, ${card.hp} points de vie. Afficher les détails.`);
    entry.button.hidden = !mapped;
    if (!mapped) { if (entry.mock) entry.mock.hidden = true; continue; }
    const style = { left: `${mapped.x}px`, top: `${mapped.y}px`, width: `${mapped.w}px`, height: `${mapped.h}px`, zIndex: String(10 + (card.order || 0)) };
    Object.assign(entry.button.style, style);
    if (entry.mock) {
      entry.mock.hidden = false; Object.assign(entry.mock.style, { ...style, zIndex: String((card.order || 0)) });
      const mockSignature = JSON.stringify([card.name, card.hp, card.element, card.side, card.abilities.length]);
      if (entry.mock.dataset.signature !== mockSignature) { entry.mock.dataset.signature = mockSignature; entry.mock.classList.toggle('opponent', card.side === 'opponent'); entry.mock.replaceChildren(make('small', '', card.element), make('strong', '', card.name), make('div', 'card-symbol', '✦'), make('span', '', `${card.hp} PV · ${card.abilities.length} capacités`)); }
    }
    if (hoveredId === card.instanceId && !tooltip.hidden) showTooltip(card, entry.button);
  }
  if (local) setNotice(frame?.source === 'demo' ? 'DÉMONSTRATION · cartes fictives' : cards.length ? 'Données du jeu · disposition reconstituée' : 'En attente des cartes visibles dans SPAM');
}
async function fetchState() {
  if (!visible || (!local && (!auth || !backend))) return;
  if (polling) { pendingFetch = true; return; }
  polling = true;
  const historyRequested = needsHistory; needsHistory = false;
  const started = Date.now();
  try {
    const path = local ? '/api/local/state' : `${backend}/api/state`;
    const response = await fetch(`${path}?after=${historyRequested ? 0 : buffer.revision}&delayMs=${Math.max(0, latencyMs + adjustmentMs)}`, { headers: auth ? { Authorization: `Bearer ${auth.token}` } : {}, signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json(); buffer.ingest(data, started, Date.now());
    const nextAdjustment = data.layout?.delayOffsetMs || 0;
    if (Math.abs(nextAdjustment - adjustmentMs) > 500) { needsHistory = true; pendingFetch = true; }
    adjustmentMs = nextAdjustment;
    lastFailure = ''; if (!local) setNotice(''); render();
  } catch (error) { needsHistory ||= historyRequested; lastFailure = error.message; if (local) setNotice('Connexion à l’application interrompue'); }
  finally { polling = false; if (pendingFetch && visible) { pendingFetch = false; void fetchState(); } }
}
function start() { clearInterval(timer); clearInterval(renderTimer); if (visible) { void fetchState(); timer = setInterval(fetchState, local ? 700 : 5000); renderTimer = setInterval(render, 150); } }
async function backendConfig() {
  let config = {};
  try { config = await fetch('runtime-config.json').then(response => response.json()); } catch {}
  for (const segment of ['global', 'broadcaster']) { try { config = { ...config, ...JSON.parse(window.Twitch?.ext?.configuration?.[segment]?.content || '{}') }; } catch {} }
  try { const url = new URL(config.backendUrl); if (url.protocol === 'https:' || (local && url.hostname === '127.0.0.1')) backend = url.origin; } catch { backend = ''; }
  if (!backend && !local) setNotice('Le serveur SPAM n’est pas encore configuré.');
}
if (local) { document.body.classList.add('local-preview', 'debug'); start(); }
else if (window.Twitch?.ext) {
  const twitch = window.Twitch.ext;
  twitch.onAuthorized(async value => { auth = value; await backendConfig(); start(); });
  twitch.onContext(context => {
    if (Number.isFinite(context.hlsLatencyBroadcaster)) { const nextLatency = Math.max(0, context.hlsLatencyBroadcaster * 1000); const changed = Math.abs(nextLatency - latencyMs) > 500; latencyMs = nextLatency; if (changed) { needsHistory = true; void fetchState(); } }
    const resolution = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(context.videoResolution || '');
    if (resolution && Number(resolution[2]) > 0) aspect = Number(resolution[1]) / Number(resolution[2]);
    render();
  });
  twitch.onVisibilityChanged((isVisible, context) => { visible = isVisible; if (context?.hlsLatencyBroadcaster != null) latencyMs = context.hlsLatencyBroadcaster * 1000; if (!visible) { clearInterval(timer); clearInterval(renderTimer); hideTooltip(); } else { needsHistory = true; start(); } });
  twitch.configuration.onChanged(async () => { await backendConfig(); void fetchState(); });
  twitch.listen('broadcast', (_topic, _type, message) => { try { if (JSON.parse(message).type === 'state-changed') void fetchState(); } catch {} });
} else setNotice('Ouvre cet overlay dans Twitch, ou utilise l’aperçu local.');
window.addEventListener('resize', render);
