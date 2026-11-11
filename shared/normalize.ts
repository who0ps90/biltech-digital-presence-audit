import type { DigitalAudit, ManualReview, Place, WebsiteInspection } from './types.js';
import { SCORING_POLICY } from './policy.js';
export function uninspectedWebsite(inspectedAt = new Date().toISOString()): WebsiteInspection {
  return { state: 'not-listed', inspectedAt, accessible: null, https: null, title: null, metaDescription: null, contentReliable: false, socialLinks: [], contactLinks: [], cta: null, messaging: null, emailOrForm: null, booking: null, notes: ['No website URI was returned. This does not establish that no business website exists.'] };
}
export function normalizeAudit(place: Place, website = uninspectedWebsite(), observedAt = new Date().toISOString(), manual: ManualReview = {}): DigitalAudit {
  const websitePresence = place.websiteUri?.trim() ? 'listed' : manual.websiteAbsent === true ? 'confirmed-absent' : 'unknown';
  let bookingApplicability: DigitalAudit['bookingApplicability'] = 'unknown';
  let bookingEvidence = 'Business type does not establish whether appointments apply. Manual confirmation is needed.';
  if (manual.booking) { bookingApplicability = manual.booking; bookingEvidence = `User-confirmed booking applicability: ${manual.booking}. This is a manual statement, not a Google verification.`; }
  else if (SCORING_POLICY.appointmentTypes.includes(place.primaryType || '')) { bookingApplicability = 'relevant'; bookingEvidence = `Biltech applicability heuristic for Google primaryType: ${place.primaryType}. Confirm manually if this business operates differently.`; }
  else if (SCORING_POLICY.nonAppointmentTypes.includes(place.primaryType || '')) { bookingApplicability = 'not-relevant'; bookingEvidence = `Biltech retail applicability heuristic for Google primaryType: ${place.primaryType}. Booking is not applicable; its fixed allocation earns zero. Manual override available.`; }
  return { observedAt, website, websitePresence, bookingApplicability, bookingEvidence, manual };
}
