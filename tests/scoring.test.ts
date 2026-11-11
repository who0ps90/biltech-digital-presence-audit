import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess, SCORING_POLICY, summarize } from '../shared/scoring.js';
import { normalizeAudit, uninspectedWebsite } from '../shared/normalize.js';
import { recommend } from '../shared/recommendations.js';
import { reviewReport } from '../shared/review.js';
import { demoReport } from '../server/demo.js';
import type { Place, WebsiteInspection } from '../shared/types.js';
import { completePlace, completeWebsite, timestamp } from './fixtures.js';
const score = (place = completePlace, website = completeWebsite()) => assess(place, normalizeAudit(place, website, timestamp));
const check = (result: ReturnType<typeof assess>, id: string) => result.checks.find(item => item.id === id)!;

test('complete profile and website: four categories total 60/20/5/15 and 100 overall', () => {
  const result = score(); assert.deepEqual(result.groups.map(g => g.max), [60, 20, 5, 15]);
  assert.equal(result.score, 100); assert.equal(result.coverage, 100); assert.equal(result.label, 'Excellent');
  assert.ok(result.checks.every(c => c.evidenceSource && c.evidenceTimestamp && c.explanation && c.status === 'PASS'));
});
test('confirmed no website gives zero website points and unavailable zero-valued dependent checks', () => {
  const place = { ...completePlace, websiteUri: undefined };
  const audit = normalizeAudit(place, uninspectedWebsite(timestamp), timestamp, { websiteAbsent: true, confirmedAt: timestamp });
  const result = assess(place, audit), website = result.groups[1];
  assert.equal(website.earned, 0); assert.equal(website.assessed, 20); assert.equal(website.score, 0);
  for (const id of ['accessibility', 'https', 'title', 'description']) { assert.equal(check(result, id).unavailable, true); assert.equal(check(result, id).earned, 0); }
  assert.equal(check(result, 'social').status, 'NOT_ASSESSED');
});
test('omitted Google website is unknown until manually confirmed, not automatic absence', () => {
  const result = assess({ ...completePlace, websiteUri: undefined });
  assert.equal(check(result, 'website').status, 'NOT_ASSESSED'); assert.equal(result.coverage, 60); assert.equal(result.label, 'Preliminary Score');
  assert.equal(check(result, 'website').earned, 0); assert.equal(result.groups[1].max, 20); assert.equal(result.groups[1].earned, 0); assert.equal(result.score, 60); assert.equal(result.applicable, 100);
});
test('website listed but inaccessible leaves downstream checks unknown and preserves Google data', () => {
  const website: WebsiteInspection = { ...uninspectedWebsite(timestamp), state: 'timeout', requestedUrl: completePlace.websiteUri };
  const result = score(completePlace, website);
  assert.equal(check(result, 'website').earned, 6); assert.equal(check(result, 'accessibility').status, 'NOT_ASSESSED');
  assert.equal(check(result, 'description').status, 'NOT_ASSESSED'); assert.equal(check(result, 'social').status, 'NOT_ASSESSED');
  assert.equal(result.groups[0].earned, 60); assert.equal(result.coverage, 66);
  assert.equal(result.score, 66); assert.equal(check(result, 'accessibility').earned, 0); assert.equal(check(result, 'social').earned, 0); assert.equal(result.groups[1].score, 30);
});
test('partial JavaScript content cannot create false weak title or social checks', () => {
  const website = completeWebsite({ state: 'partial', contentReliable: false, title: 'Home', socialLinks: completeWebsite().socialLinks.slice(0, 1) });
  const result = score(completePlace, website);
  assert.equal(check(result, 'title').status, 'NOT_ASSESSED'); assert.equal(check(result, 'social').status, 'NOT_ASSESSED');
});
test('HTTP 403 blocks discovery without marking all downstream checks as failures', () => {
  const website = { ...uninspectedWebsite(timestamp), state: 'blocked' as const, requestedUrl: completePlace.websiteUri, httpStatus: 403, https: true };
  const result = score(completePlace, website);
  for (const id of ['accessibility', 'title', 'description', 'social', 'cta', 'messaging', 'email', 'booking']) assert.equal(check(result, id).status, 'NOT_ASSESSED', id);
  assert.equal(result.coverage, 69); assert.equal(result.label, 'Preliminary Score');
  assert.equal(result.score, 69); assert.equal(result.groups[1].earned, 9); assert.equal(result.groups[1].max, 20);
});
test('HTTP website and absent meta description lose exactly their configured points', () => {
  const result = score(completePlace, completeWebsite({ https: false, finalUrl: 'http://fixture-business.com', metaDescription: '' }));
  assert.equal(check(result, 'https').earned, 0); assert.equal(check(result, 'description').earned, 0); assert.equal(result.score, 95); assert.equal(result.coverage, 100);
});
test('one social profile earns 3, multiple profiles earn 5, no discovered links earns zero', () => {
  assert.equal(check(score(completePlace, completeWebsite({ socialLinks: completeWebsite().socialLinks.slice(0, 1) })), 'social').earned, 3);
  assert.equal(check(score(), 'social').earned, 5);
  const none = score(completePlace, completeWebsite({ socialLinks: [] })); assert.equal(check(none, 'social').earned, 0);
  assert.match(check(none, 'social').evidence, /accounts may exist elsewhere/);
});
test('WhatsApp, email/forms and CTA are scored from website evidence, not duplicated Google phone points', () => {
  const result = score({ ...completePlace, nationalPhoneNumber: undefined });
  assert.equal(check(result, 'phone').status, 'NOT_ASSESSED'); assert.equal(check(result, 'messaging').earned, 3); assert.equal(check(result, 'email').earned, 3); assert.equal(check(result, 'cta').earned, 4);
});
test('appointment-based business without booking loses five points; uncertain relevance remains unassessed', () => {
  const site = completeWebsite({ booking: false });
  const result = score(completePlace, site); assert.equal(check(result, 'booking').earned, 0); assert.equal(result.score, 95);
  const uncertain = score({ ...completePlace, primaryType: 'restaurant' }, site); assert.equal(check(uncertain, 'booking').status, 'NOT_ASSESSED');
});
test('retail booking is not applicable; manual confirmation can override or reset the heuristic', () => {
  const place = { ...completePlace, primaryType: 'clothing_store' };
  const result = score(place); assert.equal(check(result, 'booking').status, 'NOT_APPLICABLE'); assert.equal(check(result, 'booking').earned, 0); assert.equal(result.applicable, 100); assert.equal(result.coverage, 95); assert.equal(result.score, 95); assert.equal(result.groups[3].max, 15);
  const report = demoReport(); const uncertain = reviewReport(report, { booking: 'unknown' }); assert.equal(check(uncertain.assessment, 'booking').status, 'NOT_ASSESSED');
  const relevant = reviewReport(uncertain, { booking: 'relevant' }); assert.equal(check(relevant.assessment, 'booking').status, 'NEEDS_IMPROVEMENT'); assert.equal(check(relevant.assessment, 'booking').earned, 0);
});
test('zero reviews is explicit zero evidence; an absent count and invalid rating remain unknown', () => {
  const zero = score({ ...completePlace, userRatingCount: 0 }); assert.equal(check(zero, 'reviews').earned, 0); assert.equal(check(zero, 'rating').status, 'NOT_ASSESSED');
  for (const value of [NaN, -1, 0, 6]) assert.equal(check(score({ ...completePlace, rating: value }), 'rating').status, 'NOT_ASSESSED');
  for (const value of [NaN, -1, 1.5]) assert.equal(check(score({ ...completePlace, userRatingCount: value }), 'reviews').status, 'NOT_ASSESSED');
});
test('missing Places fields yield numeric 0/100 with zero for every criterion and category', () => {
  const result = assess({ id: 'unknown' }); assert.equal(result.coverage, 0); assert.equal(result.score, 0); assert.equal(result.label, 'Preliminary Score'); assert.equal(result.applicable, 100);
  assert.ok(result.checks.every(c => c.status === 'NOT_ASSESSED' && c.earned === 0));
  assert.deepEqual(result.groups.map(g => g.max), [60, 20, 5, 15]); assert.ok(result.groups.every(g => g.earned === 0 && g.score === 0));
});
test('not-applicable service-area status remains explicit but does not shrink the fixed total', () => {
  const result = score({ ...completePlace, formattedAddress: undefined, pureServiceAreaBusiness: true });
  assert.equal(result.applicable, 100); assert.equal(result.assessed, 96); assert.equal(result.score, 96); assert.equal(result.coverage, 96); assert.equal(check(result, 'address').status, 'NOT_APPLICABLE'); assert.equal(check(result, 'address').earned, 0);
});
test('closed status fails only the configured status criterion; limited photos establish presence only', () => {
  const result = score({ ...completePlace, businessStatus: 'CLOSED_PERMANENTLY' }); assert.equal(result.score, 97); assert.equal(check(result, 'status').earned, 0);
  assert.match(check(result, 'photos').evidence, /not a total photo count/);
  assert.equal(check(score({ ...completePlace, photos: [] }), 'photos').status, 'NOT_ASSESSED');
});
test('rating and review formulas preserve proportions at new weights and respect configurable targets', () => {
  const place = { ...completePlace, rating: 3.6, userRatingCount: 25 }, audit = normalizeAudit(place, completeWebsite(), timestamp);
  const result = assess(place, audit); assert.equal(check(result, 'rating').earned, 8); assert.equal(check(result, 'reviews').earned, 5);
  const custom = { ...SCORING_POLICY, ratingTarget: 3.6, reviewCountTarget: 25 }; assert.equal(assess(place, audit, custom).score, 100);
});
test('low coverage never inflates or hides a fixed-total score; displayed point totals stay consistent', () => {
  const result = score();
  const at = (coverage: number) => summarize(result.checks.map(c => ({ ...c, max: c.id === 'rating' ? coverage : (100 - coverage) / 18, earned: c.id === 'rating' ? coverage : 0, status: c.id === 'rating' ? 'PASS' : 'NOT_ASSESSED' })));
  assert.equal(at(39).score, 39); assert.equal(at(40).score, 40); assert.equal(at(40).label, 'Preliminary Score'); assert.equal(at(69).score, 69); assert.equal(at(69).label, 'Preliminary Score'); assert.equal(at(70).label, 'Needs Attention');
  assert.equal(result.earned, result.groups.reduce((sum, group) => sum + group.earned, 0));
  const bounded = summarize(result.checks.map(c => ({ ...c, earned: c.max + 100 }))); assert.equal(bounded.score, 100);
});
test('a lone verified three-point name earns 3/100, never 100 percent from a reduced denominator', () => {
  const result = assess({ id: 'partial', displayName: { text: 'Fixture business' } });
  assert.equal(result.earned, 3); assert.equal(result.score, 3); assert.equal(result.coverage, 3); assert.equal(result.groups[0].earned, 3); assert.equal(result.groups[0].max, 60); assert.equal(result.groups[0].score, 5);
});
test('invalid scoring maxima are rejected and unverified status cannot retain awarded points', () => {
  const result = score();
  assert.throws(() => summarize(result.checks.slice(1)), /total exactly 100/);
  const unknown = summarize(result.checks.map(c => ({ ...c, status: 'NOT_ASSESSED', earned: c.max })));
  assert.equal(unknown.score, 0); assert.ok(unknown.checks.every(c => c.earned === 0));
});
test('recommendations use only weak evidence, contain category/source/action, and rank by business impact', () => {
  const result = score(completePlace, completeWebsite({ metaDescription: '', messaging: false, booking: false }));
  const recommendations = recommend(result); assert.equal(recommendations[0].criterionId, 'booking');
  assert.ok(recommendations.every(r => r.evidence && r.evidenceSource && r.evidenceTimestamp && r.why && r.action && r.category && r.recoverablePoints > 0));
  assert.deepEqual(recommend(assess({ id: 'unknown' })), []);
});
