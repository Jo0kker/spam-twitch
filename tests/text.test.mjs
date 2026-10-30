import test from 'node:test';
import assert from 'node:assert/strict';
import { plainGameText } from '../extension/text.mjs';
import { sanitizeSnapshot } from '../server/protocol.mjs';
import { demoSnapshot } from '../server/demo.mjs';

test('game decoration and unavailable sprites become readable text', () => {
  const input = 'Attaque 15 Ombre\n[sprite_textmeshpro_line_legendary_left]Éternité[sprite_textmeshpro_line_legendary_right]\nen cas de [sprite_textmeshpro_critdamage] coup critique';
  assert.equal(plainGameText(input), 'Attaque 15 Ombre\nÉternité\nen cas de coup critique');
  assert.equal(plainGameText('[sprite_textmeshpro_precision] Précision et [sprite_textmeshpro_critdamage] Critique'), 'Précision et Critique');
  assert.equal(plainGameText('<color=#fff>Applique</color><br><sprite name="sprite_textmeshpro_line_rare_left">Provocation<sprite name="sprite_textmeshpro_line_rare_right">'), 'Applique\nProvocation');
  assert.equal(plainGameText('Bonus <sprite name="sprite_textmeshpro_precision">'), 'Bonus Précision');
  assert.equal(plainGameText('Effet [sprite_textmeshpro_bouclier_magique]'), 'Effet bouclier magique');
});

test('legacy connector descriptions are cleaned before reaching every viewer version', () => {
  const input = demoSnapshot();
  input.cards[0].abilities[0].description = '[sprite_textmeshpro_line_rare_left]Provocation[sprite_textmeshpro_line_rare_right]\n<script>texte</script>';
  input.cards[0].name = '<b>Neilla</b>';
  const clean = sanitizeSnapshot(input);
  assert.equal(clean.cards[0].name, 'Neilla');
  assert.equal(clean.cards[0].abilities[0].description, 'Provocation\ntexte');
  assert.equal(JSON.stringify(clean).includes('sprite_textmeshpro'), false);
});

test('rich game text preserves known icons and spacing without accepting HTML or image URLs', async () => {
  const {gameTextTokens,sanitizeGameTokens}=await import('../extension/text.mjs');
  const input='Bonus [sprite_textmeshpro_precision] Précision\nAttaque 15 Nature';
  const tokens=gameTextTokens(input);
  assert.ok(tokens.some(token=>token.icon==='precision'));
  assert.ok(tokens.some(token=>token.tone==='nature'));
  assert.equal(tokens.filter(token=>token.text).map(token=>token.text).join(''),'Bonus  Précision\nAttaque 15 Nature');
  const safe=sanitizeGameTokens([{icon:'https://evil.invalid/x'},{text:'<img onerror="bad()">Bonjour',tone:'evil'},{icon:'critdamage'}]);
  assert.deepEqual(safe,[{text:'Bonjour'},{icon:'critdamage'}]);
});

test('rich descriptions remain stable through companion and backend sanitization while old viewers keep plain text', () => {
  const input=demoSnapshot();input.cards[0].abilities[0].description='[sprite_textmeshpro_precision] Précision et [sprite_textmeshpro_critdamage] Critique';
  const once=sanitizeSnapshot(input),twice=sanitizeSnapshot(once);
  assert.deepEqual(twice,once);
  assert.equal(once.cards[0].abilities[0].description,'Précision et Critique');
  assert.ok(twice.cards[0].abilities[0].descriptionTokens.some(token=>token.icon==='critdamage'));
});

test('collection talent catalogue never becomes hidden combat talent data', () => {
  const input=demoSnapshot();const card=input.cards[0];
  card.details={talents:[{name:'Cœur terre',description:'Bonus [sprite_textmeshpro_earth] Terre'}]};
  for(const side of ['ally','opponent']){card.side=side;assert.equal(sanitizeSnapshot(input).cards[0].details.talents,undefined);}
  card.side='collection';const clean=sanitizeSnapshot(input);
  assert.equal(clean.cards[0].details.talents[0].name,'Cœur terre');
  assert.ok(clean.cards[0].details.talents[0].descriptionTokens.some(token=>token.icon==='earth'));
  assert.deepEqual(sanitizeSnapshot(clean),clean);
});

test('linked talent and ability effects keep safe descriptions and survive companion/backend normalization',()=>{
  const input=demoSnapshot(),card=input.cards[0];card.side='collection';
  const effects=[{id:'heart-fire',name:'<b>Cœur de feu</b>',description:'Bonus [sprite_textmeshpro_fire] Feu (+1) chaque tour',kind:'passive',private:'secret'},null,{name:'',description:'ignored'}];
  card.details={selectedTalentId:'heart',talents:[{id:'heart',name:'Cœur FEU',description:'Commence avec le passif Cœur de feu',effects}]};
  card.abilities[0].effects=effects;
  const clean=sanitizeSnapshot(input),talent=clean.cards[0].details.talents[0];
  assert.equal(clean.cards[0].details.selectedTalentId,'heart');assert.equal(talent.effects.length,1);
  assert.equal(talent.effects[0].name,'Cœur de feu');assert.equal(talent.effects[0].private,undefined);
  assert.ok(talent.effects[0].descriptionTokens.some(token=>token.icon==='fire'));
  assert.equal(clean.cards[0].abilities[0].effects.length,1);
  assert.deepEqual(sanitizeSnapshot(clean),clean);
  for(const side of ['ally','opponent']){card.side=side;const combat=sanitizeSnapshot(input).cards[0];assert.equal(combat.details.talents,undefined);assert.equal(combat.details.selectedTalentId,undefined);assert.equal(combat.abilities[0].effects[0].name,'Cœur de feu');}
});
