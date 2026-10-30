// Shared by the viewer, broadcaster configuration and backend. No executable remote UI.
export const DEFAULT_PRESENTATION = Object.freeze({
  panelStyle: 'sidebar', mode: 'complete', side: 'right', width: 'standard', textSize: 'normal',
  theme: 'element', activation: 'hover', showStats: false, showCooldowns: true,
  showPassives: true, showDescription: false, highlight: true, opacity: 100, language: 'auto'
});
const choices = {
  panelStyle: ['sidebar', 'card'], mode: ['simple', 'complete'], side: ['right', 'left'], width: ['narrow', 'standard', 'wide'],
  textSize: ['small', 'normal', 'large'], theme: ['element', 'neutral'],
  activation: ['hover', 'click'], language: ['auto', 'fr', 'en']
};
export function validatePresentation(input = {}, strict = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    if (strict) throw new Error('Réglages d’affichage invalides.');
    input = {};
  }
  const result = {...DEFAULT_PRESENTATION};
  for (const [key, values] of Object.entries(choices)) {
    if (values.includes(input[key])) result[key] = input[key];
    else if (strict && Object.hasOwn(input, key)) throw new Error('Réglage d’affichage invalide : ' + key);
  }
  for (const key of ['showStats', 'showCooldowns', 'showPassives', 'showDescription', 'highlight']) {
    if (typeof input[key] === 'boolean') result[key] = input[key];
    else if (strict && Object.hasOwn(input, key)) throw new Error('Réglage d’affichage invalide : ' + key);
  }
  if (Number.isFinite(input.opacity)) result.opacity = Math.round(Math.max(80, Math.min(100, input.opacity)));
  else if (strict && Object.hasOwn(input, 'opacity')) throw new Error('Opacité invalide.');
  return result;
}
export const elementKey = value => ({feu:'fire', fire:'fire', eau:'water', water:'water', terre:'earth', earth:'earth', nature:'nature', ombre:'shadow', shadow:'shadow', lumière:'light', lumiere:'light', light:'light', talent:'talent'}[String(value).trim().toLowerCase()] || 'neutral');
export function panelGeometry(settings, width, height) {
  const margin = settings.panelStyle === 'sidebar' ? 0 : width < 700 ? 8 : 18;
  const panelWidth = Math.round(Math.min(width - margin * 2, Math.max(Math.min(240, width * .55), Math.min({narrow:320,standard:390,wide:470}[settings.width] || 390, width * ({narrow:.28,standard:.34,wide:.42}[settings.width] || .34)))));
  return {width: Math.round(panelWidth), height: Math.max(1, height - margin * 2), top: margin,
    left: settings.side === 'left' ? margin : Math.max(margin, width - margin - panelWidth)};
}
