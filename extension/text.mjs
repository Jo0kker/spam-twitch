// SPAM uses TextMeshPro sprites, not web image URLs. Keep their meaning as readable text.
const labels = { precision: 'Précision', critdamage: 'Critique', critchance: 'Chance de critique', hp: 'PV', health: 'PV' };
function spriteLabel(value) {
  const name = value.toLowerCase().replace(/^sprite[_-]?textmeshpro[_-]?/, '').replace(/^sprite[_-]?/, '');
  if (/^(line|separator|decoration)(_|$)/.test(name)) return '';
  if (labels[name]) return ` ${labels[name]} `;
  // Unknown named symbols stay legible without exposing engine identifiers.
  return ` ${name.replace(/[_-]+/g, ' ').trim()} `;
}
export function plainGameText(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<sprite\b[^>]*\bname\s*=\s*["']?([^"'\s>]+)[^>]*>/gi, (_, name) => spriteLabel(name))
    .replace(/\[sprite[_-][^\]]+\]/gi, token => spriteLabel(token.slice(1, -1)))
    .replace(/<[^>]+>/g, '')
    .replace(/(Précision|Critique)\s+\1/gi, '$1')
    .replace(/Critique\s+coup critique/gi, 'coup critique')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
