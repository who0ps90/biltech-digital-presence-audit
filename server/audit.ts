import type { Place, Report } from '../shared/types.js';
import { normalizeAudit } from '../shared/normalize.js';
import { assess, SCORING_POLICY } from '../shared/scoring.js';
import { recommend } from '../shared/recommendations.js';
import { inspectWebsite } from './website/inspect.js';

export async function buildReport(place: Place, inspect: typeof inspectWebsite = inspectWebsite): Promise<Report> {
  const generatedAt = new Date().toISOString();
  // Website failures stay local to their criteria; they never discard valid Places data.
  const website = await inspect(place.websiteUri);
  const audit = normalizeAudit(place, website, generatedAt);
  const assessment = assess(place, audit);
  return { kind: 'report', mode: 'live', place, audit, assessment, recommendations: recommend(assessment), generatedAt, policyVersion: SCORING_POLICY.version };
}
