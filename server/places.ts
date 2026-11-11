import { config } from './config.js';
import { AppError } from './errors.js';
import type { Place } from '../shared/types.js';
import type { MapsIdentity } from './maps-url.js';

export const DETAILS_MASK = 'id,displayName,primaryType,primaryTypeDisplayName,formattedAddress,pureServiceAreaBusiness,businessStatus,nationalPhoneNumber,websiteUri,regularOpeningHours,rating,userRatingCount,photos,googleMapsUri,attributions';
export const SEARCH_MASK = 'places.id,places.displayName,places.formattedAddress,places.primaryTypeDisplayName,places.pureServiceAreaBusiness,places.googleMapsUri,places.attributions';

export class DailyBudget {
  private day = ''; private count = 0;
  constructor(private cap: number) {}
  consume(now = new Date()) {
    const day = now.toISOString().slice(0, 10);
    if (day !== this.day) { this.day = day; this.count = 0; }
    if (this.count >= this.cap) throw new AppError(429, 'The configured daily Google API usage cap has been reached. Try again tomorrow.', 'USAGE_CAP');
    this.count++;
  }
}
const budget = new DailyBudget(config.dailyCap);
export async function googleRequest(path: string, mask: string, body?: unknown) {
  if (!config.apiKey) throw new AppError(503, 'Live analysis is not configured yet. Explore the sample report, or add GOOGLE_PLACES_API_KEY on the server.', 'NOT_CONFIGURED');
  budget.consume(); // Count all attempted calls, including failed/time-out requests.
  let response: Response;
  try {
    response = await fetch(`https://places.googleapis.com/v1/${path}`, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(config.apiTimeout),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': config.apiKey, 'X-Goog-FieldMask': mask },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new AppError(504, 'Google Places did not respond in time. Please try again.', 'UPSTREAM_TIMEOUT'); }
  if (!response.ok) {
    // Never pass upstream messages/headers through: they may include credentials or internals.
    await response.body?.cancel();
    if (response.status === 404) throw new AppError(404, 'Google could not find this Place ID. Copy a current Google Maps business link.');
    if (response.status === 400) throw new AppError(422, 'Google rejected the business identifier or request parameters. Try a fresh Google Maps place link containing the business name.', 'GOOGLE_INVALID_ARGUMENT');
    if (response.status === 429) throw new AppError(429, 'Google Places quota is temporarily unavailable. Please try again later.');
    throw new AppError(502, 'Google Places could not complete the request. Check server API access, billing, and key restrictions.');
  }
  try { return await response.json(); } catch { throw new AppError(502, 'Google Places returned an unreadable response.'); }
}
export async function getPlace(id: string): Promise<Place> {
  const place = await googleRequest(`places/${encodeURIComponent(id)}`, DETAILS_MASK) as Place;
  if (!place.id || place.id !== id) throw new AppError(502, 'Google returned a different Place ID. Please use a current business link.');
  return place;
}
export async function searchPlaces(identity: MapsIdentity): Promise<Place[]> {
  const data = await googleRequest('places:searchText', SEARCH_MASK, { textQuery: identity.query, pageSize: 5, includePureServiceAreaBusinesses: true, ...(identity.locationBias ? { locationBias: identity.locationBias } : {}) });
  if (!Array.isArray(data.places) || !data.places.length) throw new AppError(404, 'No matching businesses were found. Try a place link with the business name and location.');
  return data.places;
}
