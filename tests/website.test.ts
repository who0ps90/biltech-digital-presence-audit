import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectHtml } from '../server/website/html.js';
import { socialProfile } from '../server/website/social.js';
import { contactChannel } from '../server/website/contacts.js';
import { inspectWebsite, robotsAllows } from '../server/website/inspect.js';
import { InspectionError, validateWebsiteUrl, type PageResponse, type PageTransport } from '../server/website/transport.js';
import { buildReport } from '../server/audit.js';
import { completePlace } from './fixtures.js';
const base = 'https://fixture-business.com/';
const html = '<!doctype html><html><head><title>Fixture Dental &amp; Care</title><meta content="Dental care services" name="description"></head><body><h1>Fixture Dental Care</h1><p>We provide dental care to local customers. Contact our team to arrange your next visit.</p><a href="https://wa.me/60123456789">WhatsApp us</a><a href="mailto:hello@fixture-business.com">Email</a><a href="/appointments">Book an appointment</a><a href="https://facebook.com/fixturedental">Facebook</a><script type="application/ld+json">{"@type":"LocalBusiness","name":"Fixture Dental","sameAs":["https://instagram.com/fixturedental"]}</script></body></html>';
function fixture(overrides: Record<string, Partial<PageResponse>> = {}): { transport: PageTransport; calls: string[] } {
  const calls: string[] = [];
  const transport: PageTransport = async url => { calls.push(url.href); return { url: url.href, status: url.pathname === '/robots.txt' ? 404 : 200, headers: { 'content-type': 'text/html' }, body: url.pathname === '/robots.txt' ? '' : html, ...overrides[url.href] }; };
  return { transport, calls };
}
test('HTML inspection discovers real HTML title, metadata, socials, WhatsApp, email and booking links', () => {
  const result = inspectHtml(html, base);
  assert.equal(result.title, 'Fixture Dental & Care'); assert.equal(result.metaDescription, 'Dental care services'); assert.equal(result.socialLinks.length, 2);
  assert.equal(result.messaging, true); assert.equal(result.emailOrForm, true); assert.equal(result.booking, true); assert.equal(result.cta, true);
});
test('missing description is empty evidence on reliable HTML, not missing evidence', () => {
  assert.equal(inspectHtml(html.replace('<meta content="Dental care services" name="description">', ''), base).metaDescription, '');
});
test('social profile matching excludes sharing buttons, posts, roots and spoofed domains', () => {
  for (const value of ['https://facebook.com/sharer.php?u=https://example.com', 'https://facebook.com/share', 'https://instagram.com/p/123', 'https://instagram.com/', 'https://tiktok.com/@biz/video/123', 'https://youtube.com/watch?v=123', 'https://x.com/intent/tweet', 'https://x.com/biz/status/123', 'https://facebook.com.attacker.com/business', 'javascript:alert(1)']) assert.equal(socialProfile(value), null, value);
  for (const value of ['https://facebook.com/fixture', 'https://instagram.com/fixture', 'https://tiktok.com/@fixture', 'https://youtube.com/@fixture', 'https://linkedin.com/company/fixture', 'https://twitter.com/fixture']) assert.ok(socialProfile(value), value);
  assert.equal(socialProfile('https://instagram.com/fixture/?utm_source=site')?.url, 'https://instagram.com/fixture');
});
test('no social links or only sharing buttons do not imply that no social accounts exist', () => {
  const result = inspectHtml('<html><title>Fixture business</title><body><h1>Fixture</h1><p>Welcome to our public business information page.</p><a href="https://facebook.com/sharer.php">Share</a></body></html>', base);
  assert.equal(result.socialLinks.length, 0); assert.equal(result.contentReliable, true);
});
test('hidden CTAs and newsletter forms are excluded; visible enquiry forms are discovered', () => {
  const wrap = (body: string) => `<html><title>Fixture business</title><body><h1>Contact Fixture</h1>${body}</body></html>`;
  const result = inspectHtml(wrap('<a hidden href="tel:+60123456789">Call</a><form><input type="email"><button>Subscribe</button></form>'), base);
  assert.equal(result.cta, false); assert.equal(result.emailOrForm, false);
  const enquiry = inspectHtml(wrap('<form><input type="email"><textarea name="message"></textarea><button type="submit">Send enquiry</button></form>'), base);
  assert.equal(enquiry.emailOrForm, true); assert.equal(enquiry.cta, true);
  assert.equal(contactChannel('https://wa.me/60123456789', 'WhatsApp', base)?.label, 'WhatsApp');
});
test('JS shells and challenge pages leave absent downstream signals unknown', () => {
  const shell = inspectHtml('<html><head></head><body><div id="root"></div><script src="app.js"></script></body></html>', base);
  assert.equal(shell.contentReliable, false); assert.equal(shell.title, null); assert.equal(shell.cta, null);
  const challenge = inspectHtml('<html><title>Just a moment</title><body>Verify you are human</body></html>', base); assert.equal(challenge.challenge, true);
});
test('successful homepage inspection respects robots and never follows social/contact links', async () => {
  const { transport, calls } = fixture(); const result = await inspectWebsite(base, transport);
  assert.equal(result.state, 'inspected'); assert.equal(result.accessible, true); assert.equal(result.https, true);
  assert.deepEqual(calls, [`${base}robots.txt`, base]);
});
test('HTTP website is observed as non-HTTPS', async () => {
  const result = await inspectWebsite('http://fixture-business.com/', fixture().transport); assert.equal(result.https, false); assert.equal(result.accessible, true);
});
test('HTTP 403, 429 and challenge pages remain blocked rather than false missing-feature failures', async () => {
  for (const status of [403, 429]) {
    const result = await inspectWebsite(base, fixture({ [base]: { status } }).transport);
    assert.equal(result.state, 'blocked'); assert.equal(result.accessible, null); assert.equal(result.title, null); assert.equal(result.booking, null);
  }
  const challenge = await inspectWebsite(base, fixture({ [base]: { body: '<title>Just a moment</title>' } }).transport); assert.equal(challenge.state, 'blocked'); assert.equal(challenge.accessible, null);
});
test('HTTP 503 establishes access failure without fabricating downstream absence', async () => {
  const result = await inspectWebsite(base, fixture({ [base]: { status: 503 } }).transport);
  assert.equal(result.accessible, false); assert.equal(result.title, null); assert.equal(result.messaging, null);
});
test('timeouts, non-HTML and unsafe website destinations return bounded unknown assessments', async () => {
  const timeout: PageTransport = async () => { throw new InspectionError('timeout', 'Website inspection timed out.'); };
  assert.equal((await inspectWebsite(base, timeout)).state, 'timeout');
  const nonHtml = await inspectWebsite(base, fixture({ [base]: { headers: { 'content-type': 'application/pdf' } } }).transport); assert.equal(nonHtml.state, 'non-html'); assert.equal(nonHtml.title, null);
  for (const value of ['file:///etc/passwd', 'https://user:password@example.com', 'https://example.com:8443', 'http://localhost', 'https://business.internal', 'https://facebook.com/business', 'https://maps.google.com/maps']) assert.throws(() => validateWebsiteUrl(value), value);
});
test('redirects are validated before requests, loops are rejected, and robots apply at the new origin', async () => {
  const redirected = fixture({ [base]: { status: 302, headers: { location: 'https://other-business.com/contact' } } });
  const result = await inspectWebsite(base, redirected.transport); assert.equal(result.finalUrl, 'https://other-business.com/contact'); assert.ok(redirected.calls.includes('https://other-business.com/robots.txt'));
  const blocked = fixture({ [base]: { status: 302, headers: { location: 'http://localhost/internal' } } });
  assert.equal((await inspectWebsite(base, blocked.transport)).state, 'unsafe'); assert.equal(blocked.calls.length, 2);
  const loop = fixture({ [base]: { status: 302, headers: { location: base } } }); assert.equal((await inspectWebsite(base, loop.transport)).state, 'error');
});
test('robots disallow and unreachable robots skip homepage inspection', async () => {
  assert.equal(robotsAllows('User-agent: *\nDisallow: /\nAllow: /public', '/private'), false);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /\nAllow: /public', '/public/page'), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /\nUser-agent: BiltechAuditBot\nAllow: /', '/'), true);
  const denied = fixture({ [`${base}robots.txt`]: { status: 200, body: 'User-agent: *\nDisallow: /' } });
  assert.equal((await inspectWebsite(base, denied.transport)).state, 'robots'); assert.equal(denied.calls.length, 1);
  const unreachable = fixture({ [`${base}robots.txt`]: { status: 503 } }); assert.equal((await inspectWebsite(base, unreachable.transport)).state, 'error'); assert.equal(unreachable.calls.length, 1);
});
test('partial website API/network failure never discards a valid Google profile', async () => {
  const report = await buildReport(completePlace, async () => ({ ...await inspectWebsite(undefined), state: 'error', notes: ['Fixture network failure.'] }));
  assert.equal(report.place.id, completePlace.id); assert.equal(report.assessment.groups[0].earned, 60); assert.equal(report.audit.website.state, 'error'); assert.equal(report.assessment.label, 'Preliminary Score');
});
