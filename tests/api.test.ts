import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../server/app.js';
import { config } from '../server/config.js';
import { DETAILS_MASK, SEARCH_MASK } from '../server/places.js';

async function serve(run: (base: string) => Promise<void>) {
  const server: Server = await new Promise(resolve => { const s = createApp().listen(0, '127.0.0.1', () => resolve(s)); });
  const address = server.address();
  try { await run(`http://127.0.0.1:${typeof address === 'object' ? address?.port : ''}`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
test('demo is labeled, uses no credentials, and all API responses disable caching', async () => {
  await serve(async base => {
    const response = await fetch(`${base}/api/demo`); const body = await response.json();
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /no-store/);
    assert.equal(body.mode, 'demo'); assert.equal(body.place.id, 'SAMPLE_NOT_A_GOOGLE_PLACE_ID'); assert.equal(body.assessment.coverage, 100); assert.equal(body.assessment.groups.length, 4);
    assert.equal(JSON.stringify(body).includes('GOOGLE_PLACES_API_KEY'), false);
  });
});
test('API rejects bad inputs, forged selection, cross-origin requests and malformed JSON', async () => {
  await serve(async base => {
    const send = (path: string, body: string, origin?: string) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body });
    assert.equal((await send('/api/analyze', JSON.stringify({ url: 'https://evil.test/maps' }))).status, 400);
    assert.equal((await send('/api/analyze', JSON.stringify({ url: 'https://www.google.com/maps?cid=12345' }))).status, 422);
    assert.equal((await send('/api/select', JSON.stringify({ placeId: 'ChIJcandidateABC', selectionToken: 'forged' }))).status, 400);
    assert.equal((await send('/api/analyze', '{}', 'https://evil.test')).status, 403);
    assert.equal((await send('/api/analyze', '{bad json')).status, 400);
    assert.equal((await send('/api/analyze', JSON.stringify({ url: 'a'.repeat(9000) }))).status, 413);
  });
});
test('without credentials, live requests fail explicitly and never fall back to sample data', async () => {
  const key = config.apiKey; config.apiKey = '';
  try { await serve(async base => {
    const response = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://www.google.com/maps?place_id=ChIJcandidateABC' }) });
    assert.equal(response.status, 503); const body = await response.json(); assert.equal(body.code, 'NOT_CONFIGURED'); assert.equal(body.place, undefined);
  }); } finally { config.apiKey = key; }
});
test('fixture integration: a single uncertain match requires selection before details, then produces real-mode assessment', async () => {
  const originalFetch = globalThis.fetch; const originalKey = config.apiKey; config.apiKey = 'fixture-server-secret';
  const upstream: { url: string; options?: RequestInit }[] = [];
  const place = { id: 'ChIJcandidateABC', displayName: { text: 'Fixture Workshop' }, formattedAddress: 'Fixture address', rating: 4.5, userRatingCount: 50, attributions: [{ provider: 'Fixture provider' }] };
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (!url.startsWith('https://places.googleapis.com/')) return originalFetch(input, options);
    upstream.push({ url, options });
    return Response.json(url.endsWith('places:searchText') ? { places: [place] } : place);
  };
  try { await serve(async base => {
    const response = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://www.google.com/maps/place/Fixture+Workshop/data=!1sRestaurants!3m6!1s0x123:0x456' }) });
    const result = await response.json(); assert.equal(response.status, 200); assert.equal(result.kind, 'matches'); assert.equal(result.candidates.length, 1); assert.equal(upstream.length, 1);
    assert.equal((upstream[0].options?.headers as Record<string, string>)['X-Goog-FieldMask'], SEARCH_MASK);
    assert.equal(JSON.parse(upstream[0].options!.body as string).includePureServiceAreaBusinesses, true);
    assert.equal(JSON.parse(upstream[0].options!.body as string).textQuery, 'Fixture Workshop');
    const selected = await fetch(`${base}/api/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ placeId: place.id, selectionToken: result.selectionToken }) });
    const report = await selected.json(); assert.equal(selected.status, 200); assert.equal(report.kind, 'report'); assert.equal(report.mode, 'live'); assert.equal(report.place.displayName.text, 'Fixture Workshop'); assert.equal(report.assessment.score, 27); assert.equal(report.assessment.coverage, 27); assert.equal(report.assessment.label, 'Preliminary Score'); assert.equal(report.assessment.applicable, 100); assert.ok(report.assessment.checks.every((check: { earned: unknown }) => typeof check.earned === 'number'));
    assert.equal(upstream.length, 2); assert.equal((upstream[1].options?.headers as Record<string, string>)['X-Goog-FieldMask'], DETAILS_MASK);
    assert.equal(JSON.stringify(report).includes('fixture-server-secret'), false);
  }); } finally { globalThis.fetch = originalFetch; config.apiKey = originalKey; }
});
test('upstream failures are sanitized and timeouts have actionable error responses', async () => {
  const originalFetch = globalThis.fetch; const originalKey = config.apiKey; config.apiKey = 'fixture-secret';
  let timeout = false;
  let invalidArgument = false;
  globalThis.fetch = async (input, options) => {
    if (!String(input).startsWith('https://places.googleapis.com/')) return originalFetch(input, options);
    if (timeout) throw new DOMException('timeout', 'TimeoutError');
    if (invalidArgument) return new Response('Sensitive upstream internals: fixture-secret', { status: 400 });
    return new Response('Sensitive upstream internals: fixture-secret', { status: 403 });
  };
  try { await serve(async base => {
    const send = () => fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://www.google.com/maps?place_id=ChIJcandidateABC' }) });
    const failure = await send(); assert.equal(failure.status, 502); assert.equal((await failure.text()).includes('fixture-secret'), false);
    invalidArgument = true;
    const invalid = await send(); assert.equal(invalid.status, 422); const invalidBody = await invalid.json(); assert.equal(invalidBody.code, 'GOOGLE_INVALID_ARGUMENT'); assert.equal(JSON.stringify(invalidBody).includes('fixture-secret'), false);
    timeout = true; const timedOut = await send(); assert.equal(timedOut.status, 504); assert.equal((await timedOut.json()).code, 'UPSTREAM_TIMEOUT');
  }); } finally { globalThis.fetch = originalFetch; config.apiKey = originalKey; }
});
test('request limiter returns 429 after the configured number of requests', async () => {
  const limit = config.rateLimit; config.rateLimit = 2;
  try { await serve(async base => { assert.equal((await fetch(`${base}/api/config`)).status, 200); assert.equal((await fetch(`${base}/api/config`)).status, 200); assert.equal((await fetch(`${base}/api/config`)).status, 429); }); }
  finally { config.rateLimit = limit; }
});
