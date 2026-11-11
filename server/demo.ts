import type { Place, Report } from '../shared/types.js';
import { assess, SCORING_POLICY } from '../shared/scoring.js';
import { normalizeAudit } from '../shared/normalize.js';
import { recommend } from '../shared/recommendations.js';

export function demoReport(): Report {
  const place: Place = {
    id: 'SAMPLE_NOT_A_GOOGLE_PLACE_ID',
    displayName: { text: 'The Corner Workshop' },
    primaryTypeDisplayName: { text: 'Bicycle repair shop' },
    primaryType: 'bicycle_store',
    websiteUri: 'https://corner-workshop.example',
    formattedAddress: '24 Example Lane, Sample City — fictional address',
    businessStatus: 'OPERATIONAL',
    nationalPhoneNumber: '+60 00-000 0000 (sample)',
    regularOpeningHours: { weekdayDescriptions: ['Monday: 9:00 AM – 6:00 PM', 'Tuesday: 9:00 AM – 6:00 PM', 'Wednesday: 9:00 AM – 6:00 PM', 'Thursday: 9:00 AM – 6:00 PM', 'Friday: 9:00 AM – 6:00 PM', 'Saturday: 10:00 AM – 4:00 PM', 'Sunday: Closed'] },
    rating: 3.8, userRatingCount: 12,
    photos: [{ name: 'sample-photo-reference' }],
  };
  const generatedAt = new Date().toISOString();
  const audit = normalizeAudit(place, {
    state: 'inspected', requestedUrl: place.websiteUri, finalUrl: place.websiteUri, inspectedAt: generatedAt, httpStatus: 200,
    accessible: true, https: true, title: 'The Corner Workshop | Bicycle repairs', metaDescription: '', contentReliable: true,
    socialLinks: [{ label: 'Instagram (sample)', url: 'https://instagram.com/fictional_corner_workshop_demo', source: 'homepage-link' }],
    contactLinks: [{ label: 'Email (sample)', url: 'mailto:hello@corner-workshop.example', source: 'homepage-link' }],
    cta: true, messaging: false, emailOrForm: true, booking: false,
    notes: ['Fictional website inspection. No sample website or social account was requested or verified.'],
  }, generatedAt, { booking: 'relevant', confirmedAt: generatedAt });
  const assessment = assess(place, audit);
  return { kind: 'report', mode: 'demo', place, audit, assessment, recommendations: recommend(assessment), generatedAt, policyVersion: SCORING_POLICY.version };
}
