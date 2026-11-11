import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractIdentity, isPlaceId, isPublicAddress, resolveMapsUrl, validateMapsUrl } from '../server/maps-url.js';

const id = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
test('extracts explicit Place IDs without treating the URL itself as an ID', () => {
  for (const url of [
    `https://www.google.com/maps/search/?api=1&query=Workshop&query_place_id=${id}`,
    `https://maps.google.com/?q=place_id:${id}`,
    `https://www.google.com/maps?place_id=${id}`,
    `https://www.google.com/maps/place/Workshop/data=!4m2!3m1!1s${id}`,
  ]) assert.deepEqual(extractIdentity(validateMapsUrl(url)), { placeId: id });
  assert.equal(isPlaceId(`https://www.google.com/maps/${id}`), false);
});
test('hex feature IDs and CID values never become Place IDs', () => {
  const identity = extractIdentity(validateMapsUrl('https://www.google.com/maps/place/Corner+Workshop/@3.14,101.7,15z/data=!4m2!3m1!1s0x123abc:0x456def'));
  assert.equal(identity.placeId, undefined); assert.equal(identity.query, 'Corner Workshop');
  assert.equal(identity.locationBias?.circle.center.latitude, 3.14);
  for (const value of ['12345678901234', '0x123abc', '0x123abc:0x456def']) assert.equal(isPlaceId(value), false);
  assert.throws(() => extractIdentity(validateMapsUrl('https://www.google.com/maps?cid=12345678901234')), /CID/);
  assert.throws(() => extractIdentity(validateMapsUrl('https://www.google.com/maps?query_place_id=12345678901234')), /CID/);
});
test('search links yield a query for explicit confirmation', () => {
  for (const url of ['https://www.google.com/maps/search/Bicycle+repair+Kuala+Lumpur', 'https://www.google.com/maps/search/?api=1&query=Bicycle+repair+Kuala+Lumpur']) {
    const identity = extractIdentity(validateMapsUrl(url));
    assert.equal(identity.query, 'Bicycle repair Kuala Lumpur'); assert.equal(identity.placeId, undefined);
  }
});
test('conflicting explicit IDs cannot silently select a business', () => {
  assert.throws(() => extractIdentity(validateMapsUrl(`https://www.google.com/maps?place_id=ChIJdifferentABC&query_place_id=${id}`)), /conflicting Place IDs/);
});
test('a place link containing an earlier search token uses the business name, never Restaurants as a Place ID', () => {
  const identity = extractIdentity(validateMapsUrl('https://www.google.com/maps/place/Sura+Sang+(Hidangan+Istimewa+Korea+%26+Jepun)/@5.3779495,100.4059463,15z/data=!4m10!1m2!2m1!1sRestaurants!3m6!1s0x304ac70079db8075:0x42e73148a15c8301!8m2!3d5.3718832!4d100.4124514'));
  assert.equal(identity.placeId, undefined);
  assert.equal(identity.query, 'Sura Sang (Hidangan Istimewa Korea & Jepun)');
  assert.equal(identity.locationBias?.circle.center.longitude, 100.4059463);
});
test('embedded search text is skipped before a later recognizable Place ID', () => {
  assert.deepEqual(extractIdentity(validateMapsUrl(`https://www.google.com/maps/place/Workshop/data=!1sRestaurants!3m6!1s${id}`)), { placeId: id });
});
test('unrecognized embedded IDs require name-based confirmation, while explicit opaque IDs remain supported', () => {
  const opaque = 'AnOpaqueGoogleIdentifier123';
  assert.equal(extractIdentity(validateMapsUrl(`https://www.google.com/maps/place/Workshop/data=!1s${opaque}`)).query, 'Workshop');
  assert.equal(extractIdentity(validateMapsUrl(`https://www.google.com/maps?place_id=${opaque}`)).placeId, opaque);
  assert.equal(extractIdentity(validateMapsUrl('https://www.google.com/maps/place/Workshop?q=Restaurants')).query, 'Workshop');
});
test('rejects unsupported hosts, credentials, schemes, ports, private hosts and non-Maps paths', () => {
  for (const value of ['http://google.com/maps', 'https://google.com.evil.test/maps', 'https://evilgoogle.com/maps', 'https://localhost/maps', 'https://127.0.0.1/maps', 'https://169.254.169.254/maps', 'https://[::1]/maps', 'https://www.google.com:8443/maps', 'https://user:pass@www.google.com/maps', 'https://www.google.com/search?q=business', 'https://goo.gl/arbitrary', 'file:///etc/passwd', '//www.google.com/maps', '', 'x'.repeat(5000)]) assert.throws(() => validateMapsUrl(value), value);
  assert.throws(() => validateMapsUrl(null));
});
test('rejects coordinates-only and malformed input without inventing a search', () => {
  assert.throws(() => extractIdentity(validateMapsUrl('https://maps.google.com/?q=3.15,101.7')), /coordinates/);
  assert.throws(() => extractIdentity(validateMapsUrl('https://www.google.com/maps/place/%E0%A4%A')), /encoding/);
});
test('recognizes public IPs and rejects private, internal, mapped, reserved and multicast ranges', () => {
  for (const ip of ['8.8.8.8', '142.250.190.78', '2607:f8b0:4005:80a::200e']) assert.equal(isPublicAddress(ip), true, ip);
  for (const ip of ['0.0.0.0', '10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.1.1', '192.168.1.1', '100.64.1.1', '192.0.2.1', '224.0.0.1', '255.255.255.255', '::1', '::', 'fc00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '2001:db8::1', 'not-an-ip']) assert.equal(isPublicAddress(ip), false, ip);
});
test('safe short links resolve to validated Maps URLs without fetching the Maps page', async () => {
  const calls: string[] = [];
  const url = await resolveMapsUrl('https://maps.app.goo.gl/abc', { maxRedirects: 4, timeout: 5000 }, async (current) => { calls.push(current.href); return { status: 302, location: `https://www.google.com/maps?place_id=${id}` }; });
  assert.equal(extractIdentity(url).placeId, id); assert.equal(calls.length, 1);
});
test('rejects redirect destination outside allowlist before requesting it', async () => {
  for (const location of ['https://evil.test/maps', 'https://127.0.0.1/maps', 'http://www.google.com/maps', 'https://google.com.evil.test/maps', 'https://www.google.com/url?q=https://evil.test']) {
    let calls = 0;
    await assert.rejects(resolveMapsUrl('https://maps.app.goo.gl/abc', { maxRedirects: 4, timeout: 5000 }, async () => { calls++; return { status: 302, location }; }));
    assert.equal(calls, 1);
  }
});
test('rejects redirect loops, excessive hops and non-redirect responses', async () => {
  await assert.rejects(resolveMapsUrl('https://maps.app.goo.gl/a', { maxRedirects: 4, timeout: 5000 }, async () => ({ status: 302, location: 'https://maps.app.goo.gl/a' })), /loop/);
  let n = 0;
  await assert.rejects(resolveMapsUrl('https://maps.app.goo.gl/a', { maxRedirects: 1, timeout: 5000 }, async () => ({ status: 302, location: `https://maps.app.goo.gl/${++n}` })), /redirect limit/);
  await assert.rejects(resolveMapsUrl('https://maps.app.goo.gl/a', undefined, async () => ({ status: 200 })), /did not resolve/);
});
test('long links are parsed locally without arbitrary network fetching', async () => {
  const url = await resolveMapsUrl('https://www.google.com/maps/place/Workshop', undefined, async () => { throw new Error('Must not fetch long URLs'); });
  assert.equal(extractIdentity(url).query, 'Workshop');
});
