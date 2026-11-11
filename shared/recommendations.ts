import type { Assessment, Recommendation } from './types.js';
import { SCORING_POLICY } from './policy.js';
export function recommend(assessment: Assessment): Recommendation[] {
  return assessment.checks.filter(c => c.status === 'NEEDS_IMPROVEMENT' && c.earned !== null).map(c => {
    const recoverablePoints = Math.round((c.max - c.earned!) * 100) / 100;
    const severity = c.max ? recoverablePoints / c.max : 0;
    const weights = SCORING_POLICY.recommendationWeights;
    const rank = c.impact * weights.impact + severity * weights.severity + c.confidence * weights.confidence + recoverablePoints * weights.recoverable;
    return { criterionId: c.id, category: c.category, issue: c.unavailable ? `${c.label} unavailable without a website` : c.issue, evidence: c.evidence, evidenceSource: c.evidenceSource, evidenceTimestamp: c.evidenceTimestamp, why: c.why, action: c.unavailable ? 'Add a business website, then re-run the audit to inspect this capability.' : c.improvement, priority: c.priority, recoverablePoints, confidence: c.confidence, rank };
  }).sort((a, b) => b.rank - a.rank || a.criterionId.localeCompare(b.criterionId));
}
