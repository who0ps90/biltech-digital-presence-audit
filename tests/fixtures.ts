import type { Place, WebsiteInspection } from '../shared/types.js';
export const timestamp = '2026-10-22T06:30:00.000Z';
export const completePlace: Place = { id: 'ChIJfixtureBusinessABC', displayName: { text: 'Fixture Dental' }, primaryTypeDisplayName: { text: 'Dentist' }, primaryType: 'dentist', formattedAddress: 'Fixture address', businessStatus: 'OPERATIONAL', nationalPhoneNumber: 'Fixture phone', websiteUri: 'https://fixture-business.com', regularOpeningHours: { weekdayDescriptions: ['Monday: 9–5'] }, photos: [{ name: 'photo-reference' }], rating: 4.5, userRatingCount: 50 };
export function completeWebsite(update: Partial<WebsiteInspection> = {}): WebsiteInspection {
  return { state: 'inspected', requestedUrl: completePlace.websiteUri, finalUrl: completePlace.websiteUri, inspectedAt: timestamp, httpStatus: 200, accessible: true, https: true, title: 'Fixture Dental — Dental care', metaDescription: 'Dental services from Fixture Dental.', contentReliable: true,
    socialLinks: [{ label: 'Facebook', url: 'https://facebook.com/fixturedental', source: 'homepage-link' }, { label: 'Instagram', url: 'https://instagram.com/fixturedental', source: 'structured-data' }],
    contactLinks: [{ label: 'WhatsApp', url: 'https://wa.me/60123456789', source: 'homepage-link' }, { label: 'Email', url: 'mailto:hello@fixture-business.com', source: 'homepage-link' }],
    cta: true, messaging: true, emailOrForm: true, booking: true, notes: ['Fixture inspection, no network requests.'], ...update };
}
