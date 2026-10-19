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
