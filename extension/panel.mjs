import {plainGameText} from './text.mjs';
import {elementKey} from './presentation.mjs';
const en = {
  'Carte':'Card','Talent':'Talent','Votre équipe':'Your team','Adversaire':'Opponent','Collection':'Collection',
  'Capacités actives':'Active abilities','Effets passifs':'Passive abilities','Description':'Description',
  'Résistances':'Resistances','Réduction des dégâts par élément':'Damage reduction by element',
  'Précision':'Accuracy','Critique':'Critical','Multiplicateur':'Multiplier','PV':'HP','Revenu':'Income',
  'Feu':'Fire','Eau':'Water','Terre':'Earth','Nature':'Nature','Ombre':'Shadow','Lumière':'Light',
  'Fermer la fiche':'Close card details','Aucune capacité visible.':'No visible abilities.',
  'Les effets passifs sont masqués par le streamer.':'The streamer has hidden passive effects.',
  'Survolez une autre carte pour changer de fiche.':'Hover over another card to change details.',
  'Cliquez sur une carte pour changer de fiche.':'Click a card to change details.',
  'Fiche longue : faites défiler sur la carte.':'Long details: scroll while pointing at the card.',
  'Données enrichies disponibles après mise à jour du module SPAM.':'Update the SPAM module for additional card data.'
};
export function viewerLanguage(settings, browserLanguage = navigator.language) {
  return settings.language === 'auto' ? (browserLanguage.toLowerCase().startsWith('fr') ? 'fr' : 'en') : settings.language;
}
export const panelText = (value, language) => language === 'en' ? en[value] || value : value;
export function renderPanel(panel, card, settings, onClose) {
  const language = viewerLanguage(settings), t = value => panelText(value, language);
  const node = (tag, className, value) => {
    const element = document.createElement(tag); if (className) element.className = className;
    if (value !== undefined) element.textContent = plainGameText(value);
    return element;
  };
  const previousScroll = panel.dataset.card === card.instanceId ? panel.querySelector('.detail-body')?.scrollTop || 0 : 0;
  panel.dataset.card = card.instanceId;
  panel.dataset.element = settings.theme === 'element' ? elementKey(card.element) : 'neutral';
  panel.dataset.mode = settings.mode; panel.dataset.interaction = settings.activation;
  panel.dataset.side = settings.side;
  panel.style.setProperty('--panel-opacity', settings.opacity / 100);
  panel.style.setProperty('--text-size', {small:'12px',normal:'14px',large:'16px'}[settings.textSize]);
  panel.lang = language;
  const head = node('header', 'detail-head');
  const topline = node('div', 'detail-topline');
  topline.append(node('span', 'detail-brand', `SPAM / ${t(card.instanceId.startsWith('talent:') ? 'Talent' : 'Carte')}`));
  if (settings.activation === 'click') {
    const close = node('button', 'detail-close', '×'); close.type = 'button';
    close.setAttribute('aria-label', t('Fermer la fiche')); close.addEventListener('click', onClose); topline.append(close);
  }
  const badges = node('div', 'detail-badges');
  badges.append(node('span', 'element-badge', t(card.element || 'SPAM')));
  if (card.details?.rarity) badges.append(node('span', 'rarity-badge', card.details.rarity));
  badges.append(node('span', 'side-badge', t(card.side === 'ally' ? 'Votre équipe' : card.side === 'opponent' ? 'Adversaire' : 'Collection')));
  head.append(topline, node('h1', '', card.name), badges);
  const body = node('div', 'detail-body'), content = node('div', 'detail-content'); body.append(content);
  if (settings.showStats && !card.instanceId.startsWith('talent:')) {
    const stats = node('dl', 'card-stats');
    for (const [label, value] of [['PV', `${card.hp} / ${card.maxHp}`], ['Revenu',card.income]]) {
      const entry = node('div'); entry.append(node('dt','',t(label)),node('dd','',value)); stats.append(entry);
    }
    content.append(stats);
  }
  if (settings.mode === 'complete' && settings.showDescription && card.description) content.append(node('p', 'card-description', card.description));
  if (settings.mode === 'complete' && (card.details?.species || card.details?.region)) {
    content.append(node('p', 'card-origin', [card.details.species, card.details.region].filter(Boolean).join(' · ')));
  }
  for (const [kind, heading] of [['active','Capacités actives'],['passive','Effets passifs']]) {
    if (kind === 'passive' && !settings.showPassives) continue;
    const abilities = card.abilities.filter(ability => ability.kind === kind);
    if (!abilities.length) continue;
    const section = node('section', `ability-group ${kind}`);
    const label = node('div','group-heading'); label.append(node('h2','',t(heading)),node('span','',abilities.length)); section.append(label);
    for (const [index, ability] of abilities.entries()) {
      const article = node('article','ability');
      const top = node('div','ability-title'); top.append(node('span','ability-index',String(index + 1).padStart(2,'0')), node('h3','',ability.name));
      if (kind === 'active' && settings.showCooldowns) {
        const cooldown = node('span','cooldown',`${ability.cooldown} / ${ability.maxCooldown}`);
        cooldown.setAttribute('aria-label', `${language === 'fr' ? 'Recharge' : 'Cooldown'} ${ability.cooldown} / ${ability.maxCooldown}`); top.append(cooldown);
      }
      article.append(top,node('p','ability-description',ability.description));
      if (kind === 'active' && settings.mode === 'complete') {
        const metrics = node('dl','ability-metrics');
        for (const [key,label,suffix] of [['precision','Précision','%'],['criticalChance','Critique','%'],['criticalMultiplier','Multiplicateur','×']]) {
          if (!Number.isFinite(ability[key])) continue;
          const value = Math.round(ability[key]*100)/100;
          const item = node('div'); item.append(node('dt','',t(label)),node('dd','',suffix==='×'?`×${value}`:`${value}${suffix}`)); metrics.append(item);
        }
        if (metrics.children.length) article.append(metrics);
      }
      section.append(article);
    }
    content.append(section);
  }
  if (!card.abilities.length) content.append(node('p','empty-detail',t('Aucune capacité visible.')));
  if (!settings.showPassives && card.abilities.some(ability=>ability.kind==='passive')) content.append(node('p','detail-note',t('Les effets passifs sont masqués par le streamer.')));
  const resistanceNames = {fire:'Feu',water:'Eau',earth:'Terre',nature:'Nature',shadow:'Ombre',light:'Lumière'};
  if (settings.mode === 'complete' && Object.keys(card.details?.resistances || {}).length) {
    const resistances = node('section','resistance-section'); resistances.append(node('h2','',t('Résistances')),node('p','detail-note',t('Réduction des dégâts par élément')));
    const grid = node('dl','resistance-grid');
    for (const [key,label] of Object.entries(resistanceNames)) {
      const value = card.details.resistances[key]; if (!Number.isFinite(value)) continue;
      const item = node('div','resistance'); item.dataset.element = key; item.append(node('dt','',t(label)),node('dd','',`${Math.round(value*100)/100}%`)); grid.append(item);
    }
    resistances.append(grid); content.append(resistances);
  }
  const footer = node('footer','detail-footer',t(settings.activation === 'click' ? 'Cliquez sur une carte pour changer de fiche.' : 'Survolez une autre carte pour changer de fiche.'));
  panel.replaceChildren(head,body,footer); body.scrollTop = previousScroll;
  return {body,footer,language};
}
