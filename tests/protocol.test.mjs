import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { DEFAULT_LAYOUT, Timeline, sanitizeSnapshot, validateLayout } from '../server/protocol.mjs';
import { demoSnapshot } from '../server/demo.mjs';
import { signJwt, verifyJwt } from '../server/auth.mjs';
import { FrameBuffer, mapBounds } from '../extension/core.mjs';

test('JWTs reject altered signatures, expiry, other channels, viewer configuration and unsupported algorithms', () => {
  const secret = randomBytes(32), now = Date.now();
  const claims = { channel_id: '123', role: 'viewer', exp: Math.floor(now / 1000) + 60 };
  const token = signJwt(claims, secret);
  assert.equal(verifyJwt(token, secret, { channel: '123' }).channel_id, '123');
  assert.throws(() => verifyJwt(token + 'a', secret));
  assert.throws(() => verifyJwt(token, secret, { channel: '456' }));
  assert.throws(() => verifyJwt(token, secret, { broadcaster: true }));
  assert.throws(() => verifyJwt(signJwt({ ...claims, exp: 1 }, secret), secret));
  const fakeHeader = Buffer.from('{"alg":"none"}').toString('base64url');
  assert.throws(() => verifyJwt(`${fakeHeader}.${token.split('.')[1]}.`, secret));
});

test('snapshot validation exports only explicitly allowed fields and bounded text', () => {
  const input = demoSnapshot(); input.password = 'do-not-export'; input.cards[0].privateTalent = 'do-not-export';
  const clean = sanitizeSnapshot(input);
  assert.equal(clean.password, undefined); assert.equal(clean.cards[0].privateTalent, undefined);
  const invalid = structuredClone(input); invalid.cards[0].bounds.x = 1.2;
  assert.throws(() => sanitizeSnapshot(invalid));
  const duplicate = structuredClone(input); duplicate.cards[1].instanceId = duplicate.cards[0].instanceId;
  assert.throws(() => sanitizeSnapshot(duplicate));
  assert.throws(() => sanitizeSnapshot({ ...input, cards: Array(65).fill(input.cards[0]) }));
});

test('OBS alignment accounts for letterboxing, crop and the game rectangle', () => {
  const mapped = mapBounds({ x: .25, y: .25, w: .25, h: .5 }, DEFAULT_LAYOUT, 1600, 1200, 16 / 9);
  assert.deepEqual(mapped, { x: 400, y: 375, w: 400, h: 450 });
  const crop = validateLayout({ ...DEFAULT_LAYOUT, x: .1, y: .1, w: .8, h: .8, cropLeft: .25 });
  const afterCrop = mapBounds({ x: .25, y: 0, w: .75, h: 1 }, crop, 1600, 900);
  assert.deepEqual(afterCrop, { x: 160, y: 90, w: 1280, h: 720 });
  assert.equal(mapBounds({ x: 0, y: .2, w: .1, h: .2 }, crop, 1600, 900), null);
  assert.throws(() => validateLayout({ x: .8, w: .5 }));
  assert.throws(() => validateLayout({ cropLeft: .6, cropRight: .5 }));
});

test('new viewers receive the historical state matching their delayed video', () => {
  const timeline = new Timeline();
  for (let index = 1; index <= 12; index++) timeline.add({ ...demoSnapshot(index), sessionId: 'one' }, DEFAULT_LAYOUT, index * 1000);
  const data = timeline.read(0, 5000, 12000);
  assert.equal(data.frames[0].sequence, 7);
  const buffer = new FrameBuffer(); buffer.ingest(data, 12000, 12000);
  assert.equal(buffer.select(12000, 5000).sequence, 7);
  assert.equal(buffer.select(13000, 5000).sequence, 8);
  assert.equal(buffer.select(12000, 5000, 2000), null); // history before target was not requested
});

test('frame selection never shows future data and clears stale states', () => {
  const timeline = new Timeline(); timeline.add(demoSnapshot(), DEFAULT_LAYOUT, 10000);
  const buffer = new FrameBuffer(); buffer.ingest(timeline.read(0, 0, 10000), 10000, 10000);
  assert.equal(buffer.select(10000, 2000), null);
  assert.ok(buffer.select(12000, 2000));
  assert.equal(buffer.select(25000, 0), null);
  buffer.ingest({ revision: 0, serverTime: 26000, frames: [] }, 26000, 26000);
  assert.equal(buffer.frames.length, 0);
});

test('history is bounded and reconnecting readers recover after a server revision reset', () => {
  const timeline = new Timeline({ maxFrames: 3 });
  for (let index = 1; index <= 10; index++) timeline.add(demoSnapshot(index), DEFAULT_LAYOUT, index * 1000);
  assert.equal(timeline.frames.length, 3);
  assert.equal(timeline.read(100, 0, 10000).frames.at(-1).sequence, 10);
});
