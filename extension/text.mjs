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

// Bounded semantic tokens: game markup never becomes browser HTML or an arbitrary URL.
export const GAME_ICONS = Object.freeze(['fire','water','earth','nature','shadow','light','precision','critdamage','cooldown','gold','eternity','protection','random','luck','basedamage','temporality','heal']);
const elementWords = {Feu:'fire',Fire:'fire',Eau:'water',Water:'water',Terre:'earth',Earth:'earth',Nature:'nature',Ombre:'shadow',Shadow:'shadow','Lumière':'light',Light:'light'};
export function gameTextTokens(value) {
  const source = String(value || '').slice(0, 3000).replace(/<br\s*\/?>/gi,'\n')
    .replace(/<sprite\b[^>]*\bname\s*=\s*["']?([^"'\s>]+)[^>]*>/gi,(_,name)=>`[${name}]`).replace(/<[^>]+>/g,'');
  const pattern = /\[sprite[_-][^\]]+\]|\b(?:Feu|Fire|Eau|Water|Terre|Earth|Nature|Ombre|Shadow|Lumière|Light|aléatoirement|randomly|résistances?|resistances?|Précision|Accuracy|critiques?|critical)\b/giu;
  return tokenizeSpacing(source,pattern);
}
function tokenizeSpacing(source,pattern) {
  const tokens=[];let offset=0;
  const pushText=text=>{if(text)tokens.push({text:text.replace(/\[sprite[_-][^\]]+\]/gi,t=>plainGameText(t))});};
  for(const match of source.matchAll(pattern)) {
    pushText(source.slice(offset,match.index));const raw=match[0];
    if(raw.startsWith('[')) {
      const icon=raw.slice(1,-1).toLowerCase().replace(/^sprite[_-]textmeshpro[_-]/,'').replace(/^sprite[_-]/,'');
      if(GAME_ICONS.includes(icon)) tokens.push({icon});else pushText(plainGameText(raw));
    } else {
      const tone=Object.entries(elementWords).find(([word])=>word.toLowerCase()===raw.toLowerCase())?.[1] || 'keyword';
      tokens.push({text:raw,tone});
    }
    offset=match.index+raw.length;
  }
  pushText(source.slice(offset));return tokens.slice(0,180);
}

export function sanitizeGameTokens(tokens, fallback) {
  if (!Array.isArray(tokens)) return gameTextTokens(fallback);
  return tokens.slice(0,180).flatMap(token=>{
    if (!token || typeof token!=='object') return [];
    if(GAME_ICONS.includes(token.icon)) return [{icon:token.icon}];
    if(typeof token.text!=='string') return [];
    const text=token.text.replace(/<[^>]+>/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,3000);
    return [{text,...(['fire','water','earth','nature','shadow','light','keyword'].includes(token.tone)?{tone:token.tone}:{})}];
  }).reduce((result,token)=>{if(result.size+(token.text?.length||0)<=3000){result.tokens.push(token);result.size+=token.text?.length||0;}return result;},{tokens:[],size:0}).tokens;
}
