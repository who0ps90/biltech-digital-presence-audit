import type { ManualReview, Report } from './types.js';
import { normalizeAudit } from './normalize.js';
import { assess } from './scoring.js';
import { recommend } from './recommendations.js';
export function reviewReport(report: Report, update: Partial<ManualReview>): Report {
  const manual = { ...report.audit.manual, ...update, confirmedAt: new Date().toISOString() };
  const audit = normalizeAudit(report.place, report.audit.website, report.audit.observedAt, manual);
  const assessment = assess(report.place, audit);
  return { ...report, audit, assessment, recommendations: recommend(assessment) };
}
