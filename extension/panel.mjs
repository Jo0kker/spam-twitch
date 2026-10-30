import {plainGameText, gameTextTokens, GAME_ICONS} from './text.mjs';
import {elementKey} from './presentation.mjs';
const en={'Carte':'Card','Talent':'Talent','Votre équipe':'Your team','Adversaire':'Opponent','Collection':'Collection','Effets passifs':'Passive effects','Talents':'Talents','Disponibles':'Available','Résistances':'Resistances','Réduction des dégâts':'Damage reduction','Précision':'Accuracy','Critique':'Critical','PV':'HP','Revenu':'Income','Feu':'Fire','Eau':'Water','Terre':'Earth','Nature':'Nature','Ombre':'Shadow','Lumière':'Light','Fermer la fiche':'Close card details','Aucune capacité visible.':'No visible abilities.','Survolez une autre carte pour changer de fiche.':'Hover over another card to change details.','Cliquez sur une carte pour changer de fiche.':'Click a card to change details.','Fiche longue : faites défiler sur la carte.':'Long details: scroll while pointing at the card.'};
export function viewerLanguage(settings,browserLanguage=navigator.language){return settings.language==='auto'?(browserLanguage.toLowerCase().startsWith('fr')?'fr':'en'):settings.language;}
export const panelText=(value,language)=>language==='en'?en[value]||value:value;
const node=(tag,className,value)=>{const e=document.createElement(tag);if(className)e.className=className;if(value!==undefined)e.textContent=plainGameText(value);return e;};
function icon(name,label='',large=false){
  const image=node('img',large?'element-portrait':'game-icon');
  image.src=new URL(`./assets/game/${name==='multiplier'?'card_multiplicator':`${large?'element_':'sprite_textmeshpro_'}${name}`}.png`,import.meta.url).href;
  image.alt=label;image.draggable=false;return image;
}
function description(value,tokens){
  const p=node('p','ability-description');
  let precedingIcon='';
  for(const token of tokens || gameTextTokens(value)){
    if(GAME_ICONS.includes(token.icon)){p.append(icon(token.icon,{precision:'Précision',critdamage:'Critique',gold:'Revenu'}[token.icon]||''));precedingIcon=token.icon;}
    else if(typeof token.text==='string'){
      if(['fire','water','earth','nature','shadow','light'].includes(token.tone)&&precedingIcon!==token.tone)p.append(icon(token.tone));
      const span=node('span',token.tone?'game-term':'',token.text);
      // Preserve the original spacing around rich-text runs.
      span.textContent=token.text;
      if(token.tone)span.dataset.tone=token.tone;p.append(span);
      if(token.text.trim())precedingIcon='';
    }
  }
  return p;
}
export function renderPanel(panel,card,settings,onClose){
  const language=viewerLanguage(settings),t=value=>panelText(value,language),element=elementKey(card.element);
  const sidebar=settings.panelStyle==='sidebar';
  const previous=panel.dataset.card===card.instanceId?panel.querySelector('.detail-body')?.scrollTop||0:0;
  panel.dataset.card=card.instanceId;panel.dataset.element=settings.theme==='element'?element:'neutral';panel.dataset.mode=settings.mode;panel.dataset.interaction=settings.activation;panel.dataset.side=settings.side;panel.dataset.panelStyle=sidebar?'sidebar':'card';
  panel.style.setProperty('--panel-opacity',settings.opacity/100);panel.style.setProperty('--text-size',{small:'12px',normal:'14px',large:'16px'}[settings.textSize]);panel.lang=language;
  let art, pinnedResistance;
  if(sidebar&&settings.theme==='element'&&['fire','water','earth','nature','shadow','light'].includes(element)){
    art=node('img','panel-art');art.src=new URL(`./assets/game/element_watermark_${element}.png`,import.meta.url).href;art.alt='';art.setAttribute('aria-hidden','true');art.draggable=false;
  }
  const head=node('header','detail-head');
  if(['fire','water','earth','nature','shadow','light'].includes(element)){
    const portrait=node('div','portrait-frame');portrait.append(icon(element,'',true));head.append(portrait);
  }
  const heading=node('div','detail-heading'),badges=node('div','detail-badges');
  badges.append(node('span','element-badge',t(card.element||'Talent')),node('span','side-badge',t(card.side==='ally'?'Votre équipe':card.side==='opponent'?'Adversaire':'Collection')));
  heading.append(badges,node('h1','',card.name));
  if(sidebar&&card.details?.rarity)heading.append(node('span','card-rarity',card.details.rarity));
  head.append(heading);
  if(settings.activation==='click'){
    const close=node('button','detail-close','×');close.type='button';close.setAttribute('aria-label',t('Fermer la fiche'));close.addEventListener('click',onClose);head.append(close);
  }
  const body=node('div','detail-body'),content=node('div','detail-content');body.append(content);
  if(settings.showStats&&!card.instanceId.startsWith('talent:')){
    const stats=node('div','card-stats'),track=node('div','hp-track'),fill=node('div','hp-fill');
    fill.style.width=`${card.maxHp>0?Math.max(0,Math.min(100,card.hp/card.maxHp*100)):0}%`;track.append(fill);
    stats.append(node('span','stat-label',t('PV')),track,node('strong','hp-value',`${card.hp} / ${card.maxHp}`));
    const income=node('span','income');income.setAttribute('aria-label',t('Revenu'));income.append(icon('gold'),node('strong','',`+${card.income}`));stats.append(income);content.append(stats);
  }
  if(settings.mode==='complete'&&settings.showDescription){
    if(card.description)content.append(node('p','card-description',card.description));
    const origin=[card.details?.rarity,card.details?.species,card.details?.region].filter(Boolean).join(' · ');
    if(origin)content.append(node('p','card-origin',origin));
  }
  for(const [kind,title] of [['active',''],['passive','Effets passifs']]){
    if(kind==='passive'&&!settings.showPassives)continue;
    const abilities=card.abilities.filter(a=>a.kind===kind);if(!abilities.length)continue;
    const section=node('section',`ability-group ${kind}`);
    if(title)section.append(node('h2','section-heading',t(title)));
    for(const ability of abilities){
      const article=node('article','ability'),top=node('div','ability-title');
      if(sidebar&&kind==='active'&&['fire','water','earth','nature','shadow','light'].includes(element)){const symbol=icon(element);symbol.classList.add('skill-element');top.append(symbol);}
      top.append(node('h3','',ability.name));
      if(kind==='active'&&settings.showCooldowns){const cooldown=node('span','cooldown');cooldown.append(icon('cooldown'),node('span','',`${ability.cooldown}/${ability.maxCooldown}`));cooldown.setAttribute('aria-label',`${language==='fr'?'Recharge':'Cooldown'} ${ability.cooldown}/${ability.maxCooldown}`);top.append(cooldown);}
      const row=node('div','ability-row');row.append(description(ability.description,ability.descriptionTokens));
      if(kind==='active'&&settings.mode==='complete'){
        const metrics=node('dl','ability-metrics');
        if(Number.isFinite(ability.precision)){
          const metric=node('div','metric-base');metric.append(node('dt','','Base'));const value=node('dd');value.append(icon('precision',t('Précision')),node('strong','',`${Math.round(ability.precision*100)/100}%`));metric.append(value);metrics.append(metric);
        }
        if(Number.isFinite(ability.criticalChance)||Number.isFinite(ability.criticalMultiplier)){
          const metric=node('div','metric-critical');metric.append(node('dt','',t('Critique')));
          for(const [key,name,suffix] of [['criticalChance','critdamage','%'],['criticalMultiplier','multiplier','×']])if(Number.isFinite(ability[key])){
            const value=node('dd');value.append(icon(name),node('strong','',suffix==='×'?`×${ability[key]}`:`${ability[key]}%`));metric.append(value);
          }
          metrics.append(metric);
        }
        if(metrics.children.length)row.append(metrics);
      }
      article.append(top,row);section.append(article);
    }
    content.append(section);
  }
  if(!card.abilities.length)content.append(node('p','empty-detail',t('Aucune capacité visible.')));
  if(settings.mode==='complete'&&settings.showPassives&&card.side==='collection'&&card.details?.talents?.length){
    const section=node('section','talent-section'),label=node('div','section-label');label.append(node('h2','section-heading',t('Talents')),node('span','',t('Disponibles')));section.append(label);
    for(const talent of card.details.talents){const item=node('article','talent');item.append(node('h3','',talent.name),description(talent.description,talent.descriptionTokens));section.append(item);}content.append(section);
  }
  if(settings.mode==='complete'&&Object.keys(card.details?.resistances||{}).length){
    const section=node('section','resistance-section');section.append(node('h2','section-heading',t('Résistances')));const grid=node('dl','resistance-grid');
    for(const [key,label] of Object.entries({fire:'Feu',water:'Eau',earth:'Terre',nature:'Nature',shadow:'Ombre',light:'Lumière'})){
      const value=card.details.resistances[key];if(!Number.isFinite(value))continue;const item=node('div','resistance');item.dataset.element=key;const name=node('dt');name.append(icon(key,t(label)));item.append(name,node('dd','',`${Math.round(value*100)/100}%`));grid.append(item);
    }
    section.append(grid);
    if(sidebar){section.classList.add('panel-resistances');section.append(node('p','resistance-caption',t('Réduction des dégâts')));pinnedResistance=section;}else content.append(section);
  }
  const footer=node('footer','detail-footer',t(settings.activation==='click'?'Cliquez sur une carte pour changer de fiche.':'Survolez une autre carte pour changer de fiche.'));
  panel.replaceChildren(...(art?[art]:[]),head,body,...(pinnedResistance?[pinnedResistance]:[]),footer);body.scrollTop=previous;return{body,footer,language};
}
