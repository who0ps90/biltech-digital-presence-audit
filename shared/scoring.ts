import type { Assessment, AssessmentStatus, Check, DigitalAudit, Place } from './types.js';
import { SCORING_POLICY, type CriterionId } from './policy.js';
import { normalizeAudit } from './normalize.js';
export { SCORING_POLICY } from './policy.js';
export type ScoringPolicy = typeof SCORING_POLICY;
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function assess(place: Place, audit: DigitalAudit = normalizeAudit(place), policy = SCORING_POLICY): Assessment {
  const checks: Check[] = [];
  const add = (id: CriterionId, fraction: number | null, evidence: string, source = 'Google Places API (New)', status?: AssessmentStatus, confidence = 1, unavailable = false) => {
    const rule = policy.criteria[id];
    const earned = fraction === null || !Number.isFinite(fraction) ? null : round(Math.max(0, Math.min(1, fraction)) * rule.max);
    const resolved = status || (earned === null ? 'NOT_ASSESSED' : earned === rule.max ? 'PASS' : 'NEEDS_IMPROVEMENT');
    const unverified = resolved === 'NOT_ASSESSED' || resolved === 'NOT_APPLICABLE';
    checks.push({ id, category: rule.category, label: rule.label, max: rule.max, earned: unverified ? policy.unverifiedPoints : earned ?? policy.unverifiedPoints, status: resolved, evidence, evidenceSource: source, evidenceTimestamp: source === 'Google Places API (New)' ? audit.observedAt : source.startsWith('Manual') ? audit.manual.confirmedAt || audit.observedAt : audit.website.inspectedAt, explanation: resolved === 'NOT_ASSESSED' ? 'Missing, inaccessible, or unverified information earns zero points. Its configured weight remains in the fixed 100-point total.' : resolved === 'NOT_APPLICABLE' ? 'Not applicable; zero points awarded. Its configured weight remains in the fixed 100-point total without redistribution.' : unavailable ? 'Unavailable because the user confirmed no business website exists; zero points awarded. Its configured weight remains in the total.' : 'Only observed availability or a measured value is assessed; accuracy, effectiveness, and rankings are not inferred.', confidence, impact: rule.impact, unavailable, issue: rule.issue, why: rule.why, improvement: rule.improvement, priority: rule.impact >= 4 ? 'High' : rule.impact >= 3 ? 'Medium' : 'Low' });
  };
  const present = (value?: string) => value?.trim() ? 1 : null;
  const unknown = 'Requested Google field was not returned with usable data. Absence from the business profile is not established.';
  const ratingKnown = Number.isFinite(place.rating) && place.rating! >= 1 && place.rating! <= 5 && place.userRatingCount !== 0;
  add('rating', ratingKnown ? place.rating! / policy.ratingTarget : null, ratingKnown ? `Returned rating ${place.rating}/5; Biltech full-credit target ${policy.ratingTarget}/5.` : unknown);
  const reviewsKnown = Number.isInteger(place.userRatingCount) && place.userRatingCount! >= 0;
  add('reviews', reviewsKnown ? place.userRatingCount! / policy.reviewCountTarget : null, reviewsKnown ? `Returned review count ${place.userRatingCount}; Biltech full-credit target ${policy.reviewCountTarget}. No historical trend assessed.` : unknown);
  add('name', present(place.displayName?.text), place.displayName?.text || unknown);
  add('category', present(place.primaryTypeDisplayName?.text), place.primaryTypeDisplayName?.text ? `${place.primaryTypeDisplayName.text}. Category presence does not prove suitability.` : unknown);
  const knownStatus = ['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'].includes(place.businessStatus || '');
  add('status', knownStatus ? (place.businessStatus === 'OPERATIONAL' ? 1 : 0) : null, knownStatus ? `Returned businessStatus: ${place.businessStatus}.` : unknown);
  add('phone', present(place.nationalPhoneNumber), place.nationalPhoneNumber || unknown);
  add('address', place.pureServiceAreaBusiness ? null : present(place.formattedAddress), place.pureServiceAreaBusiness ? 'Pure service-area business: no public street address required.' : place.formattedAddress || unknown, undefined, place.pureServiceAreaBusiness ? 'NOT_APPLICABLE' : undefined);
  const hours = place.regularOpeningHours;
  add('hours', hours?.weekdayDescriptions?.length || hours?.periods?.length ? 1 : null, hours?.weekdayDescriptions?.join('; ') || (hours?.periods?.length ? 'Regular opening periods returned.' : unknown));
  add('photos', place.photos?.length ? 1 : null, place.photos?.length ? `${place.photos.length} photo reference(s) returned: a limited sample, not a total photo count. Quality, freshness, and ownership are not assessed.` : unknown);
  const site = audit.website, absent = audit.websitePresence === 'confirmed-absent';
  const siteSource = site.finalUrl || site.requestedUrl || 'Website inspection';
  add('website', absent ? 0 : audit.websitePresence === 'listed' ? 1 : null, absent ? 'User confirmed the business has no website.' : place.websiteUri || unknown, absent ? 'Manual confirmation' : undefined);
  const dependent = (id: CriterionId, value: number | null, evidence: string, confidence = .8) => add(id, absent ? 0 : value, absent ? 'Unavailable: the user confirmed that no business website exists.' : evidence, absent ? 'Manual confirmation' : siteSource, undefined, absent ? .8 : confidence, absent);
  dependent('accessibility', site.accessible === null ? null : Number(site.accessible), site.httpStatus ? `Homepage HTTP ${site.httpStatus}; inspection state: ${site.state}.` : site.notes.join(' '), 1);
  dependent('https', site.https === null ? null : Number(site.https), site.https === null ? 'Valid HTTPS connectivity could not be verified.' : `${site.https ? 'Valid HTTPS response' : 'Observed HTTP response without HTTPS'} at ${site.finalUrl}.`, 1);
  const titleMeaningful = site.title !== null && site.title.trim().length >= policy.titleMinimumLength && !policy.genericTitles.includes(site.title.trim().toLowerCase());
  dependent('title', site.title === null || (!site.contentReliable && !titleMeaningful) ? null : Number(titleMeaningful), site.title === null ? 'Homepage title could not be assessed reliably.' : `Homepage title: ${site.title || '(empty)'}.`, .9);
  dependent('description', site.metaDescription === null ? null : Number(Boolean(site.metaDescription.trim())), site.metaDescription === null ? 'Meta description could not be assessed reliably.' : `Homepage meta description: ${site.metaDescription || '(empty)'}.`, .9);
  const socialCount = new Set(site.socialLinks.map(link => link.url)).size;
  add('social', socialCount >= 2 ? 1 : site.contentReliable ? socialCount === 1 ? policy.socialOnePoints / policy.criteria.social.max : 0 : null, socialCount ? `${socialCount} website-linked social profile(s): ${site.socialLinks.map(link => link.url).join(', ')}. These are not confirmed as linked to the Google Business Profile.${!site.contentReliable && socialCount < 2 ? ' Discovery was incomplete; the criterion remains unassessed.' : ''}` : site.contentReliable ? 'No relevant profile links discovered in the inspected homepage links or supported sameAs data; accounts may exist elsewhere.' : 'Social discovery was not assessed because the website could not be inspected reliably.', siteSource, undefined, .8);
  dependent('cta', site.cta === null ? null : Number(site.cta), site.cta === null ? 'Customer CTA discovery was not assessed.' : site.cta ? 'Homepage contains a discoverable customer contact or booking action.' : 'No customer-facing contact CTA discovered on the inspected homepage.');
  dependent('messaging', site.messaging === null ? null : Number(site.messaging), site.messaging === null ? 'Messaging discovery was not assessed.' : site.messaging ? 'Direct messaging link discovered on the homepage.' : 'No clearly identified messaging link discovered on the inspected homepage.');
  dependent('email', site.emailOrForm === null ? null : Number(site.emailOrForm), site.emailOrForm === null ? 'Email/form discovery was not assessed.' : site.emailOrForm ? 'Email link or customer enquiry form discovered on the homepage.' : 'No customer email link or enquiry form discovered on the inspected homepage.');
  if (audit.bookingApplicability !== 'relevant') add('booking', null, audit.bookingEvidence, audit.manual.booking ? 'Manual confirmation' : 'Business-type applicability heuristic', audit.bookingApplicability === 'not-relevant' ? 'NOT_APPLICABLE' : 'NOT_ASSESSED', .7);
  else dependent('booking', site.booking === null ? null : Number(site.booking), `${audit.bookingEvidence} ${site.booking === null ? 'Booking discovery not assessed.' : site.booking ? 'Booking or appointment link discovered.' : 'No booking or appointment link discovered on the homepage.'}`);
  return summarize(checks, policy);
}
export function summarize(checks: Check[], policy = SCORING_POLICY): Assessment {
  const isAssessed = (c: Check) => c.status === 'PASS' || c.status === 'NEEDS_IMPROVEMENT';
  const boundedPoints = (c: Check) => isAssessed(c) && Number.isFinite(c.earned) ? round(Math.max(0, Math.min(c.max, c.earned))) : 0;
  const normalized = checks.map(c => ({ ...c, earned: boundedPoints(c) }));
  const configuredTotal = round(normalized.reduce((sum, c) => sum + c.max, 0));
  if (configuredTotal !== policy.maximumPoints || normalized.some(c => !Number.isFinite(c.max) || c.max < 0)) throw new Error('Configured criterion maxima must be nonnegative and total exactly 100.');
  const total = (items: Check[]) => {
    const applicable = round(items.reduce((s, c) => s + c.max, 0));
    const assessed = round(items.filter(isAssessed).reduce((s, c) => s + c.max, 0));
    const earned = round(items.reduce((s, c) => s + c.earned, 0));
    return { applicable, assessed, earned, score: applicable ? Math.round(earned / applicable * 100) : 0, coverage: applicable ? round(assessed / applicable * 100) : 0 };
  };
  const overall = total(normalized);
  const score = Math.round(overall.earned / policy.maximumPoints * 100);
  const preliminary = overall.coverage < policy.preliminaryCoverage;
  const label = preliminary ? 'Preliminary Score' : score >= policy.labelThresholds.excellent ? 'Excellent' : score >= policy.labelThresholds.good ? 'Good' : score >= policy.labelThresholds.attention ? 'Needs Attention' : 'Priority Improvements';
  const groups = policy.categories.map(name => { const items = normalized.filter(c => c.category === name); return { name, max: round(items.reduce((s, c) => s + c.max, 0)), ...total(items) }; });
  return { ...overall, score, label, preliminary, checks: normalized, groups };
}
