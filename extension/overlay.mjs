import { FrameBuffer, mapBounds } from './core.mjs';
import { plainGameText } from './text.mjs';
import {validatePresentation, panelGeometry} from './presentation.mjs';
import {renderPanel, panelText} from './panel.mjs';

const hotspots = document.querySelector('#hotspots'), tooltip = document.querySelector('#tooltip');
const notice = document.querySelector('#notice');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('local') === '1';
const buffer = new FrameBuffer(); const nodes = new Map();
let auth, backend = '', visible = true, latencyMs = 0, aspect = 16 / 9, frame, hoveredId = '', pinned = false;
let polling = false, pendingFetch = false, timer, renderTimer, adjustmentMs = 0, lastFailure = '', needsHistory = true;
const make = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = plainGameText(value); return node; };
const setNotice = value => { notice.textContent = value; notice.hidden = !value; };
const hideTooltip = () => { tooltip.hidden = true; hoveredId = ''; pinned = false; };
let settings = validatePresentation(), presentationSignature = '';
// Hover closes on leaving the card; a click pins it for reading and talent navigation.
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.hotspot') && !event.target.closest('#tooltip')) hideTooltip();
});
function showTooltip(card, node) {
  hoveredId = card.instanceId;
  const displaySettings = pinned ? {...settings,activation:'click'} : settings;
  const signature = JSON.stringify([card, displaySettings]);
  let view;
  if (tooltip.dataset.signature !== signature) {
    tooltip.dataset.signature = signature;
    view = renderPanel(tooltip, card, displaySettings, hideTooltip);
  }
  tooltip.hidden = false;
  const geometry = panelGeometry(settings, innerWidth, innerHeight);
  Object.assign(tooltip.style, {width: `${geometry.width}px`, height: `${geometry.height}px`, top: `${geometry.top}px`, left: `${geometry.left}px`});
  tooltip.classList.toggle('compact', geometry.height < 620);
  const body = view?.body || tooltip.querySelector('.detail-body');
  if (body) {
    // Measure without the hint first, so it cannot cause its own overflow.
    tooltip.classList.remove('has-overflow');
    const overflow = body.scrollHeight > body.clientHeight + 2;
    tooltip.classList.toggle('has-overflow', overflow);
    const footer = tooltip.querySelector('.detail-footer');
    if(displaySettings.activation==='hover')footer.textContent=panelText(card.side==='collection'&&card.details?.talents?.length&&settings.mode==='complete'&&settings.showPassives?'Cliquez sur la carte pour consulter les talents.':overflow?'Fiche longue : faites défiler sur la carte.':'Survolez une autre carte pour changer de fiche.',tooltip.lang);
  }
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
      button.addEventListener('pointerenter', () => { if(settings.activation === 'hover' && !pinned) showTooltip(entry.card, button); });
      button.addEventListener('focus', () => { if(settings.activation === 'hover' && !pinned) showTooltip(entry.card, button); });
      button.addEventListener('pointerleave', () => { if(settings.activation === 'hover' && !pinned) hideTooltip(); });
      button.addEventListener('blur', () => { if(settings.activation === 'hover' && !pinned) hideTooltip(); });
      button.addEventListener('click', () => {pinned=true;showTooltip(entry.card, button);});
      button.addEventListener('wheel', event => {
        if(settings.activation !== 'hover' || pinned || tooltip.hidden || hoveredId !== entry.card.instanceId) return;
        const scroll = tooltip.querySelector('.detail-body');
        if(scroll && scroll.scrollHeight > scroll.clientHeight) { scroll.scrollTop += event.deltaY; event.preventDefault(); }
      }, {passive:false});
      if (local) { entry.mock = make('div', 'mock-card'); hotspots.append(entry.mock); }
      hotspots.append(button);
    }
    entry.card = card;
    entry.button.setAttribute('aria-label', `${card.name}. ${settings.language === 'en' ? 'Show card details.' : 'Afficher les détails.'}`);
    entry.button.hidden = !mapped;
    entry.button.classList.toggle('highlighted', settings.highlight && hoveredId === card.instanceId && !tooltip.hidden);
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
    const nextSettings = validatePresentation(data.presentation), nextSignature = JSON.stringify(nextSettings);
    if (nextSignature !== presentationSignature) {
      if (nextSettings.activation !== settings.activation) hideTooltip();
      settings = nextSettings; presentationSignature = nextSignature;
    }
    const nextAdjustment = data.layout?.delayOffsetMs || 0;
    if (Math.abs(nextAdjustment - adjustmentMs) > 500) { needsHistory = true; pendingFetch = true; }
    adjustmentMs = nextAdjustment;
    lastFailure = ''; if (!local) setNotice(''); render();
  } catch (error) { needsHistory ||= historyRequested; lastFailure = error.message; if (local) setNotice('Connexion à l’application interrompue'); }
  finally { polling = false; if (pendingFetch && visible) { pendingFetch = false; void fetchState(); } }
}
function start() { clearInterval(timer); clearInterval(renderTimer); if (visible) { void fetchState(); timer = setInterval(fetchState, local ? 700 : 5000); renderTimer = setInterval(render, 150); } }
async function backendConfig() {
  let config = {backendUrl:'https://spam-twitch.codible.net'};
  try { const supplied = await fetch('runtime-config.json').then(response => response.json()); if(supplied.backendUrl) config.backendUrl=supplied.backendUrl; } catch {}
  for (const segment of ['global', 'broadcaster']) { try { const supplied=JSON.parse(window.Twitch?.ext?.configuration?.[segment]?.content || '{}'); if(supplied.backendUrl) config.backendUrl=supplied.backendUrl; } catch {} }
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
