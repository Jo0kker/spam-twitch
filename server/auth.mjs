import { createHmac, timingSafeEqual, randomBytes, createHash } from 'node:crypto';
import { HttpError } from './http.mjs';

export const secretToken = () => randomBytes(32).toString('base64url');
export const tokenHash = value => createHash('sha256').update(value).digest('hex');
export function signJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.${createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')}`;
}
export function verifyJwt(token, secret, { channel, broadcaster = false, now = Date.now() } = {}) {
  try {
    if (typeof token !== 'string' || token.length > 8192) throw new Error();
    const [header, payload, signature, extra] = token.split('.');
    if (extra !== undefined || JSON.parse(Buffer.from(header, 'base64url')).alg !== 'HS256') throw new Error();
    const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const claims = JSON.parse(Buffer.from(payload, 'base64url'));
    if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= now || (claims.nbf && claims.nbf * 1000 > now + 5000) || !/^\d+$/.test(claims.channel_id)) throw new Error();
    if (channel && claims.channel_id !== channel) throw new Error();
    if (broadcaster ? claims.role !== 'broadcaster' : !['viewer', 'moderator', 'broadcaster'].includes(claims.role)) throw new Error();
    return claims;
  } catch { throw new HttpError(401, 'Autorisation Twitch absente, expirée ou invalide.'); }
}
export const bearer = request => /^Bearer (.+)$/.exec(request.headers.authorization || '')?.[1] || '';
