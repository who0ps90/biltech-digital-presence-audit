import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReportPdf, downloadReportPdf, pdfFilename } from '../src/pdf/report-pdf.js';
import { demoReport } from '../server/demo.js';
import { reviewReport } from '../shared/review.js';

test('direct PDF generation produces a valid multi-page document without any browser print dependency', () => {
  const report = demoReport(), pdf = createReportPdf(report);
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  assert.equal(new TextDecoder().decode(bytes.slice(0, 8)).startsWith('%PDF-'), true);
  assert.ok(pdf.getNumberOfPages() >= 3);
  assert.equal(typeof downloadReportPdf, 'function');
  const component = readFileSync('src/components/Report.tsx', 'utf8');
  assert.doesNotMatch(component, /window\.print|beforeprint|afterprint/);
  assert.match(component, /downloadReportPdf\(report\)/);
});
test('PDF filename is deterministic and never uses raw Google business data', () => {
  const report = demoReport(); report.generatedAt = '2026-10-22T06:30:00Z';
  assert.equal(pdfFilename(report), 'biltech-digital-presence-sample-2026-10-22.pdf');
  const live = { ...report, mode: 'live' as const, place: { ...report.place, id: '../unsafe:identifier?x', displayName: { text: 'PRIVATE BUSINESS TITLE' } } };
  assert.equal(pdfFilename(live), 'biltech-digital-presence-unsafeidentifierx-2026-10-22.pdf');
  assert.equal(pdfFilename(live).includes('PRIVATE'), false);
});
test('PDF uses the current manually reviewed report and paginates long evidence', () => {
  const report = reviewReport(demoReport(), { booking: 'unknown' });
  report.audit.website.notes.push('Long fixture evidence. '.repeat(300));
  const pdf = createReportPdf(report);
  assert.ok(pdf.getNumberOfPages() > 4);
  assert.equal(report.assessment.checks.find(check => check.id === 'booking')?.earned, 0);
  assert.doesNotThrow(() => pdf.output('arraybuffer'));
});
