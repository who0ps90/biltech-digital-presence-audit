export interface Place {
  id: string;
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  primaryType?: string;
  formattedAddress?: string;
  pureServiceAreaBusiness?: boolean;
  businessStatus?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: unknown[] };
  rating?: number;
  userRatingCount?: number;
  photos?: { name?: string; authorAttributions?: { displayName?: string; uri?: string }[] }[];
  googleMapsUri?: string;
  attributions?: { provider?: string; providerUri?: string }[];
}
export type Group = 'Google Business Profile' | 'Website Presence & Health' | 'Social Media Presence' | 'Customer Enquiry Readiness';
export type Priority = 'High' | 'Medium' | 'Low';
export type AssessmentStatus = 'PASS' | 'NEEDS_IMPROVEMENT' | 'NOT_ASSESSED' | 'NOT_APPLICABLE';
export interface DiscoveredLink { label: string; url: string; source: 'homepage-link' | 'structured-data'; }
export interface WebsiteInspection {
  state: 'inspected' | 'not-listed' | 'blocked' | 'timeout' | 'error' | 'unsafe' | 'non-html' | 'robots' | 'partial';
  requestedUrl?: string; finalUrl?: string; inspectedAt: string; httpStatus?: number;
  accessible: boolean | null; https: boolean | null; title: string | null; metaDescription: string | null;
  contentReliable: boolean; socialLinks: DiscoveredLink[]; contactLinks: DiscoveredLink[];
  cta: boolean | null; messaging: boolean | null; emailOrForm: boolean | null; booking: boolean | null; notes: string[];
}
export interface ManualReview { websiteAbsent?: boolean; booking?: 'relevant' | 'not-relevant' | 'unknown'; confirmedAt?: string; }
export interface DigitalAudit {
  observedAt: string; website: WebsiteInspection; websitePresence: 'listed' | 'unknown' | 'confirmed-absent';
  bookingApplicability: 'relevant' | 'not-relevant' | 'unknown'; bookingEvidence: string; manual: ManualReview;
}
export interface Check {
  id: string;
  category: Group;
  label: string;
  max: number;
  earned: number;
  status: AssessmentStatus;
  evidence: string;
  evidenceSource: string; evidenceTimestamp: string; explanation: string; confidence: number; impact: number; unavailable?: boolean;
  issue: string;
  why: string;
  improvement: string;
  priority: Priority;
}
export interface Recommendation {
  criterionId: string; category: Group; issue: string; evidence: string; evidenceSource: string; evidenceTimestamp: string;
  why: string; action: string; priority: Priority; recoverablePoints: number; confidence: number; rank: number;
}
export interface Assessment {
  score: number;
  coverage: number;
  earned: number;
  assessed: number;
  applicable: number;
  label: string; preliminary: boolean;
  checks: Check[];
  groups: { name: Group; max: number; applicable: number; assessed: number; earned: number; score: number; coverage: number }[];
}
export interface Report {
  kind: 'report';
  mode: 'live' | 'demo';
  place: Place;
  assessment: Assessment;
  audit: DigitalAudit; recommendations: Recommendation[];
  generatedAt: string;
  policyVersion: string;
}
export type AnalyzeResponse = Report | { kind: 'matches'; candidates: Place[]; selectionToken: string; expiresInSeconds: number };
