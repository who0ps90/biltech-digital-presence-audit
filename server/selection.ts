import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.js';

const secret = randomBytes(32);
const sign = (payload: string) => createHmac('sha256', secret).update(payload).digest('base64url');
export function selectionToken(ids: string[], client: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ids, client, expires: now + 5 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function verifySelection(token: unknown, id: string, client: string, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 6000) throw new AppError(400, 'Select a business from a fresh search.');
  const [payload, signature, extra] = token.split('.');
  const expected = Buffer.from(sign(payload || '')); const received = Buffer.from(signature || '');
  if (extra || expected.length !== received.length || !timingSafeEqual(expected, received)) throw new AppError(400, 'Invalid business selection. Run the search again.');
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw new AppError(400, 'Invalid business selection.'); }
  if (data.client !== client || data.expires <= now || !Array.isArray(data.ids) || !data.ids.includes(id)) throw new AppError(400, 'This selection expired or does not match the search. Analyze the URL again.');
}
