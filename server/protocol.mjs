import { randomUUID } from 'node:crypto';
import { plainGameText } from '../extension/text.mjs';

export const DEFAULT_LAYOUT = Object.freeze({ x: 0, y: 0, w: 1, h: 1, cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0, delayOffsetMs: 0 });
const text = (value, max = 160) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : '';
const gameText = (value, max = 160) => text(plainGameText(value), max);
const number = (value, min, max, fallback = min) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const optionalNumber = (value, min, max) => Number.isFinite(value) ? number(value, min, max) : undefined;
export function validateLayout(input = {}) {
  const layout = { ...DEFAULT_LAYOUT };
  for (const key of ['x', 'y', 'w', 'h', 'cropLeft', 'cropTop', 'cropRight', 'cropBottom']) layout[key] = number(input[key], 0, 1, layout[key]);
  if (layout.w < .05 || layout.h < .05 || layout.x + layout.w > 1.001 || layout.y + layout.h > 1.001 || layout.cropLeft + layout.cropRight > .9 || layout.cropTop + layout.cropBottom > .9) throw new Error('Zone vidéo ou recadrage invalide.');
  layout.delayOffsetMs = number(input.delayOffsetMs, -30000, 180000, 0);
  return layout;
}
export function sanitizeSnapshot(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.cards) || input.cards.length > 64 || !Number.isSafeInteger(input.sequence) || input.sequence < 0) throw new Error('État du jeu invalide.');
  const ids = new Set();
  const cards = input.cards.map(card => {
    const instanceId = text(card.instanceId, 96);
    const cardId = text(card.cardId, 96);
    if (!instanceId || !cardId || ids.has(instanceId)) throw new Error('Identifiant de carte invalide ou dupliqué.');
    ids.add(instanceId);
    const b = card.bounds;
    if (!b || !['x', 'y', 'w', 'h'].every(key => Number.isFinite(b[key])) || b.x < 0 || b.y < 0 || b.w <= 0 || b.h <= 0 || b.x + b.w > 1.002 || b.y + b.h > 1.002) throw new Error('Position de carte invalide.');
    return {
      instanceId, cardId, name: gameText(card.name), description: gameText(card.description, 3000), element: gameText(card.element, 48),
      hp: number(card.hp, -1000000, 1000000, 0), maxHp: number(card.maxHp, 0, 1000000, 0), income: number(card.income, 0, 1000000, 0),
      side: ['ally', 'opponent', 'collection'].includes(card.side) ? card.side : 'collection',
      order: number(card.order, 0, 10000, 0), bounds: { x: b.x, y: b.y, w: b.w, h: b.h },
      ...(card.details && typeof card.details === 'object' ? {details: {
        rarity: gameText(card.details.rarity, 80), species: gameText(card.details.species, 120), region: gameText(card.details.region, 120),
        resistances: Object.fromEntries(['fire', 'water', 'earth', 'nature', 'shadow', 'light']
          .filter(key => Number.isFinite(card.details.resistances?.[key]))
          .map(key => [key, number(card.details.resistances[key], -1000, 1000)]))
      }} : {}),
      abilities: (Array.isArray(card.abilities) ? card.abilities : []).slice(0, 12).map(ability => ({
        id: text(ability.id, 96), name: gameText(ability.name), description: gameText(ability.description, 3000),
        kind: ability.kind === 'active' ? 'active' : 'passive', cooldown: number(ability.cooldown, 0, 10000, 0), maxCooldown: number(ability.maxCooldown, 0, 10000, 0),
        ...(Number.isFinite(ability.precision) ? {precision: optionalNumber(ability.precision, 0, 100)} : {}),
        ...(Number.isFinite(ability.criticalChance) ? {criticalChance: optionalNumber(ability.criticalChance, 0, 100)} : {}),
        ...(Number.isFinite(ability.criticalMultiplier) ? {criticalMultiplier: optionalNumber(ability.criticalMultiplier, 0, 100)} : {})
      }))
    };
  });
  return { version: 1, sessionId: text(input.sessionId, 96) || randomUUID(), sequence: input.sequence,
    capturedAt: number(input.capturedAt, 0, 9999999999999, Date.now()), source: input.source === 'demo' ? 'demo' : 'game',
    scene: text(input.scene), screen: { width: number(input.screen?.width, 1, 16384, 1920), height: number(input.screen?.height, 1, 16384, 1080) }, cards };
}

export class Timeline {
  constructor({ maxAgeMs = 120000, maxBytes = 8 * 1024 * 1024, maxFrames = 300 } = {}) {
    this.frames = []; this.bytes = 0; this.revision = 0; this.maxAgeMs = maxAgeMs; this.maxBytes = maxBytes; this.maxFrames = maxFrames;
  }
  add(snapshot, layout = DEFAULT_LAYOUT, now = Date.now()) {
    const frame = { ...sanitizeSnapshot(snapshot), layout: validateLayout(layout), revision: ++this.revision, receivedAt: now };
    const size = Buffer.byteLength(JSON.stringify(frame));
    this.frames.push({ frame, size }); this.bytes += size;
    while (this.frames.length > 1 && (this.frames.length > this.maxFrames || this.bytes > this.maxBytes || this.frames[0].frame.receivedAt < now - this.maxAgeMs)) this.bytes -= this.frames.shift().size;
    return frame;
  }
  read(after = 0, delayMs = 0, now = Date.now()) {
    const target = now - number(delayMs, 0, 180000, 0);
    let frames = this.frames.map(entry => entry.frame);
    if (after > 0 && after <= this.revision) frames = frames.filter(frame => frame.revision > after);
    else {
      const index = frames.findLastIndex(frame => frame.receivedAt <= target);
      frames = index >= 0 ? frames.slice(index) : frames;
    }
    return { serverTime: now, revision: this.revision, frames };
  }
}
