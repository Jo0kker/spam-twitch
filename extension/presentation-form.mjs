import {DEFAULT_PRESENTATION,validatePresentation} from './presentation.mjs';
import {renderPanel} from './panel.mjs';
const translations = {
  'Affichage pour vos viewers':'Viewer display', 'Choisissez les informations à afficher. L’aperçu ci-dessous utilise des données fictives.':'Choose which information to show. The preview below uses sample data.',
  'Présentation':'Presentation','Volet latéral · inspiré du jeu':'Sidebar · game style','Fiche compacte':'Compact card',
  'Niveau de détail':'Detail level','Simple · compétences seulement':'Simple · abilities only','Complet · fiche de collection':'Complete · collection details',
  'Côté du panneau':'Panel side','À droite':'Right','À gauche':'Left','Largeur':'Width','Étroite':'Narrow','Standard':'Standard','Large':'Wide',
  'Taille du texte':'Text size','Petite':'Small','Normale':'Normal','Grande':'Large','Couleurs':'Colors','Selon l’élément':'Match the element','Neutres':'Neutral',
  'Ouvrir la fiche':'Open details','Au survol · clic pour garder ouvert':'Hover · click to keep details open','Au clic · onglets et lecture libres':'Click · talent tabs and free reading',
  'Langue de l’interface viewer':'Viewer interface language','Automatique':'Automatic','Français':'Français','English':'English','Opacité du fond':'Background opacity',
  'PV et revenu':'HP and income','Temps de recharge':'Cooldowns','Effets passifs':'Passive effects','Effets passifs et talents':'Passive effects and talents','Histoire / description':'Lore / description','Contour de la carte survolée':'Highlight the selected card',
  'Enregistrer l’affichage':'Save display settings','Rétablir les réglages par défaut':'Restore defaults','Modifications non enregistrées':'Unsaved changes','Affichage enregistré pour cette chaîne.':'Display settings saved for this channel.',
  'Enregistrement…':'Saving…','Aperçu · données fictives':'Preview · sample data','Sans clic, la fiche se ferme dès que le pointeur quitte la carte. Cliquez sur la carte pour lire librement et consulter ses talents.':'Without a click, details close when the pointer leaves the card. Click the card to read freely and browse its talents.'
  ,'Les noms et descriptions restent dans la langue du jeu.':'Names and descriptions stay in the game’s language.'
  ,'Pour les résistances et les probabilités, actualisez le module SPAM depuis l’application puis relancez le jeu.':'For resistances and probabilities, update the SPAM module from the app and restart the game.'
};
export function createPresentationEditor(container, {initial, onSave, language = 'fr'}) {
  let draft = validatePresentation(initial), dirty = false, activeLanguage = language;
  const t = value => activeLanguage === 'en' ? translations[value] || value : value;
  const node = (tag,className,text) => {const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=t(text);return element;};
  const field = (key,label,choices) => {
    const wrap=node('label','presentation-field'), select=node('select');select.name=key;
    for(const [value,text] of choices){const option=node('option','',text);option.value=value;select.append(option);}
    select.value=draft[key]; wrap.append(node('span','',label),select);return wrap;
  };
  let form,preview,status,submit;
  const previewCard = () => ({instanceId:'preview-card',name:activeLanguage==='en'?'Example card · Light':'Carte exemple · Lumière',element:activeLanguage==='en'?'Light':'Lumière',side:'collection',hp:700,maxHp:700,income:5,
    description:activeLanguage==='en'?'Sample collection card. Real card text will be supplied by SPAM.':'Exemple de fiche de collection. Les vrais textes seront fournis par SPAM.',
    details:{talents:[{name:activeLanguage==='en'?'Example talent':'Talent exemple',description:activeLanguage==='en'?'Nature bonus (+2).':'Bonus Nature (+2).'}],rarity:activeLanguage==='en'?'Common':'Commune',resistances:{fire:5,water:5,earth:5,nature:5,shadow:5,light:5}},
    abilities:[{id:'a',kind:'active',name:activeLanguage==='en'?'First ability':'Première capacité',description:activeLanguage==='en'?'Attack 25 Light\nApplies a sample effect.':'Attaque 25 Lumière\nApplique un effet de démonstration.',cooldown:2,maxCooldown:2,precision:100,criticalChance:5,criticalMultiplier:2},{id:'b',kind:'passive',name:activeLanguage==='en'?'Passive ability':'Capacité passive',description:activeLanguage==='en'?'A separate section keeps passive effects easy to find.':'Une section distincte permet de retrouver facilement les effets passifs.'}]});
  const paint = () => {
    renderPanel(preview,previewCard(),{...draft,language:draft.language==='auto'?activeLanguage:draft.language},()=>{});
    preview.style.width=`${{narrow:320,standard:390,wide:470}[draft.width]}px`;
    preview.style.marginLeft=draft.side==='right'?'auto':'0';preview.style.marginRight=draft.side==='left'?'auto':'0';
    form.elements.namedItem('showDescription').disabled=draft.mode==='simple';
    preview.classList.add('compact');preview.hidden=false;
  };
  const build = () => {
    const heading=node('h2','','Affichage pour vos viewers'), intro=node('p','','Choisissez les informations à afficher. L’aperçu ci-dessous utilise des données fictives.');
    form=node('form','presentation-form');const grid=node('div','presentation-fields');
    for(const [key,label,values] of [
      ['panelStyle','Présentation',[['sidebar','Volet latéral · inspiré du jeu'],['card','Fiche compacte']]],
      ['mode','Niveau de détail',[['simple','Simple · compétences seulement'],['complete','Complet · fiche de collection']]],
      ['side','Côté du panneau',[['right','À droite'],['left','À gauche']]],
      ['width','Largeur',[['narrow','Étroite'],['standard','Standard'],['wide','Large']]],
      ['textSize','Taille du texte',[['small','Petite'],['normal','Normale'],['large','Grande']]],
      ['theme','Couleurs',[['element','Selon l’élément'],['neutral','Neutres']]],
      ['activation','Ouvrir la fiche',[['hover','Au survol · clic pour garder ouvert'],['click','Au clic · onglets et lecture libres']]],
      ['language','Langue de l’interface viewer',[['auto','Automatique'],['fr','Français'],['en','English']]]
    ]) grid.append(field(key,label,values));
    const opacity=node('label','presentation-field');opacity.append(node('span','','Opacité du fond'));const range=node('input');range.type='range';range.min=80;range.max=100;range.step=1;range.name='opacity';range.value=draft.opacity;const percent=node('output','',`${draft.opacity}%`);opacity.append(range,percent);grid.append(opacity);
    const toggles=node('div','presentation-toggles');
    for(const [key,label] of [['showStats','PV et revenu'],['showCooldowns','Temps de recharge'],['showPassives','Effets passifs et talents'],['showDescription','Histoire / description'],['highlight','Contour de la carte survolée']]) {
      const wrap=node('label'),checkbox=node('input');checkbox.type='checkbox';checkbox.name=key;checkbox.checked=draft[key];wrap.append(checkbox,node('span','',label));toggles.append(wrap);
    }
    const hint=node('small','','Sans clic, la fiche se ferme dès que le pointeur quitte la carte. Cliquez sur la carte pour lire librement et consulter ses talents.');
    const actions=node('div','presentation-actions');submit=node('button','','Enregistrer l’affichage');submit.type='submit';const reset=node('button','secondary','Rétablir les réglages par défaut');reset.type='button';actions.append(submit,reset);
    status=node('p','presentation-status');status.setAttribute('role','status');if(dirty)status.textContent=t('Modifications non enregistrées');
    form.append(grid,toggles,hint,node('small','','Les noms et descriptions restent dans la langue du jeu.'),actions,status);
    const previewLabel=node('h3','presentation-preview-title','Aperçu · données fictives'),stage=node('div','presentation-preview');preview=node('aside','tooltip');stage.append(preview);
    container.replaceChildren(heading,intro,form,previewLabel,stage,node('small','','Pour les résistances et les probabilités, actualisez le module SPAM depuis l’application puis relancez le jeu.'));paint();
    form.addEventListener('input',event=>{
      const control=event.target;if(!Object.hasOwn(DEFAULT_PRESENTATION,control.name))return;
      draft=validatePresentation({...draft,[control.name]:control.type==='checkbox'?control.checked:control.name==='opacity'?Number(control.value):control.value});
      percent.value=`${draft.opacity}%`;dirty=true;status.textContent=t('Modifications non enregistrées');paint();
    });
    reset.addEventListener('click',()=>{draft=validatePresentation();dirty=true;build();});
    form.addEventListener('submit',async event=>{
      event.preventDefault();submit.disabled=true;status.textContent=t('Enregistrement…');
      try{const result=await onSave({...draft});draft=validatePresentation(result||draft);dirty=false;status.textContent=t('Affichage enregistré pour cette chaîne.');}
      catch(error){status.textContent=error.message;status.classList.add('error');}
      finally{submit.disabled=false;}
    });
  };
  build();
  return {setLanguage(value){activeLanguage=value;build();},getDraft(){return {...draft};}};
}
