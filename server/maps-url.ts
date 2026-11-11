import { lookup } from 'node:dns/promises';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
import { AppError } from './errors.js';

export const MAPS_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'google.com', 'www.google.com', 'maps.google.com', 'google.com.my', 'www.google.com.my', 'maps.google.com.my', 'google.co.uk', 'www.google.co.uk', 'maps.google.co.uk']);
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);
export function validateMapsUrl(input: unknown): URL {
  if (typeof input !== 'string' || input.length > 4096 || !input.trim()) throw new AppError(400, 'Paste a valid Google Maps business URL.');
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new AppError(400, 'Paste a complete Google Maps URL beginning with https://.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !MAPS_HOSTS.has(url.hostname)) throw new AppError(400, 'Use an HTTPS Google Maps link on a supported Google Maps hostname.');
  if (url.hostname === 'goo.gl' && !url.pathname.startsWith('/maps/')) throw new AppError(400, 'Only Google Maps short links are supported.');
  if (!SHORT_HOSTS.has(url.hostname) && !url.pathname.match(/^\/maps(?:\/|$)/) && !(url.hostname.startsWith('maps.google.') && url.pathname === '/')) throw new AppError(400, 'This Google URL is not a supported Maps link.');
  return url;
}
export function isPublicAddress(address: string) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}

// DNS is checked once and the selected public address is pinned to the TLS request.
// This prevents a second DNS lookup from rebinding to an internal destination.
export async function redirectHop(url: URL, timeout: number): Promise<{ status: number; location?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const addresses = await Promise.race([
      lookup(url.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new AppError(504, 'Google Maps link resolution timed out.')), { once: true })),
    ]);
    if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new AppError(400, 'The link resolved to a blocked network destination.');
    const selected = addresses.find(address => address.family === 4) || addresses[0];
    return await new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'HEAD', agent: false, signal: controller.signal, family: selected.family,
        headers: { 'User-Agent': 'BiltechProfileAudit/1.0', Accept: 'text/html' },
        lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
      }, res => { resolve({ status: res.statusCode || 0, location: res.headers.location }); res.destroy(); });
      req.on('error', reject);
      req.end();
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(504, 'Could not safely resolve this short link. Try the full Google Maps place URL.');
  } finally { clearTimeout(timer); }
}
type Hop = typeof redirectHop;
export async function resolveMapsUrl(input: unknown, options = { maxRedirects: 4, timeout: 5000 }, hop: Hop = redirectHop) {
  let url = validateMapsUrl(input);
  if (!SHORT_HOSTS.has(url.hostname)) return url;
  const visited = new Set<string>();
  const deadline = Date.now() + options.timeout;
  for (let redirects = 0; ; redirects++) {
    if (visited.has(url.href)) throw new AppError(400, 'This short link contains a redirect loop.');
    visited.add(url.href);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new AppError(504, 'Google Maps link resolution timed out.');
    const result = await hop(url, remaining);
    if (![301, 302, 303, 307, 308].includes(result.status) || !result.location) throw new AppError(422, 'This short link did not resolve to a Google Maps place URL. Try copying the full URL from Google Maps.');
    if (redirects >= options.maxRedirects) throw new AppError(400, 'This link exceeded the redirect limit.');
    url = validateMapsUrl(new URL(result.location, url).href);
    // Validate every Location before any further request. Never fetch the final Maps HTML.
    if (!SHORT_HOSTS.has(url.hostname)) return url;
  }
}
export function isPlaceId(id: string) {
  return /^[A-Za-z0-9_-]{10,255}$/.test(id) && !/^\d+$/.test(id) && !/^0x/i.test(id);
}
export interface MapsIdentity { placeId?: string; query?: string; locationBias?: { circle: { center: { latitude: number; longitude: number }; radius: number } } }
export function extractIdentity(url: URL): MapsIdentity {
  const params = url.searchParams;
  let decoded: string;
  try { decoded = decodeURIComponent(url.pathname); } catch { throw new AppError(400, 'This Maps URL has malformed encoding.'); }
  const q = params.get('q') || params.get('query') || '';
  // Maps' undocumented !1s tokens also hold search text (e.g. Restaurants)
  // and CID pairs. Only recognize the established ChI Place ID shape here;
  // other opaque IDs are accepted through the explicit place_id parameters.
  // Unknown embedded forms fall back to name search with user confirmation.
  const embeddedIds = [...decoded.matchAll(/!1s([^!/?]+)/g)]
    .map(match => match[1])
    .filter(value => /^ChI[A-Za-z0-9_-]{17,252}$/.test(value));
  const identifiers = [params.get('query_place_id'), params.get('place_id'), q.startsWith('place_id:') ? q.slice(9) : '', ...embeddedIds].filter((id): id is string => Boolean(id));
  const validIds = [...new Set(identifiers.filter(isPlaceId))];
  if (validIds.length > 1) throw new AppError(422, 'This URL contains conflicting Place IDs. Copy a fresh link for the business you want to audit.');
  const explicit = identifiers[0];
  // !1s also contains hexadecimal feature IDs (CID pairs), which are not Place IDs.
  if (explicit && isPlaceId(explicit)) return { placeId: explicit };
  if ((params.has('query_place_id') || params.has('place_id') || q.startsWith('place_id:')) && explicit) throw new AppError(400, 'The URL contains an invalid Place ID. Numeric CID values are not Place IDs.');
  const slug = decoded.match(/\/maps\/place\/([^/]+)/)?.[1]?.replace(/\+/g, ' ');
  const searchPath = decoded.match(/\/maps\/search\/([^/]+)/)?.[1]?.replace(/\+/g, ' ');
  const query = (slug || (q && !q.startsWith('place_id:') ? q : searchPath || '')).trim();
  if (!query || /^[\d\s.,:+-]+$/.test(query) || /^0x[\da-f]+/i.test(query)) throw new AppError(422, 'This URL contains only coordinates or a CID, which Places API (New) cannot resolve directly. Open the business in Google Maps and copy a place link containing its name or Place ID.');
  if (query.length > 300) throw new AppError(400, 'The business search in this URL is too long.');
  const coords = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const latitude = Number(coords?.[1]); const longitude = Number(coords?.[2]);
  const locationBias = coords && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { circle: { center: { latitude, longitude }, radius: 10000 } } : undefined;
  return { query, locationBias };
}
