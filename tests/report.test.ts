import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { parseDocument, DomUtils } from 'htmlparser2';
import Report from '../src/components/Report.js';
import { demoReport } from '../server/demo.js';
import { SCORING_POLICY } from '../shared/policy.js';
import { assess } from '../shared/scoring.js';
import { normalizeAudit } from '../shared/normalize.js';

test('printable report includes all four category headings, checks, evidence and social/contact sections', () => {
  const markup = renderToStaticMarkup(createElement(Report, { report: demoReport() }));
  const dom = parseDocument(markup), text = DomUtils.textContent(dom);
  assert.match(text, /Biltech Digital Presence Audit Report/); assert.match(text, /Top 3 Improvement Opportunities/);
  for (const category of SCORING_POLICY.categories) {
    const groups = DomUtils.getElementsByTagName('h4', dom.children).filter(node => DomUtils.textContent(node).startsWith(category)); assert.equal(groups.length, 1, category);
    let parent = groups[0].parent;
    while (parent) { if ('attribs' in parent) assert.doesNotMatch(parent.attribs.class || '', /no-print/); parent = parent.parent; }
  }
  assert.match(text, /Customer enquiry channels/); assert.match(text, /Social profiles/); assert.match(text, /Evidence:/);
  const css = readFileSync('src/styles.css', 'utf8'); assert.match(css, /@media print/); assert.match(css, /\.check-content\{display:block!important/);
});
test('unknown report prints 0/100, category maxima and zero-valued checks without exclusion copy', () => {
  const sample = demoReport(), place = { id: 'SAMPLE_EMPTY' }, audit = normalizeAudit(place);
  const report = { ...sample, place, audit, assessment: assess(place, audit), recommendations: [] };
  const dom = parseDocument(renderToStaticMarkup(createElement(Report, { report }))), text = DomUtils.textContent(dom);
  assert.match(text, /0 \/ 100 points earned/); assert.match(text, /0 \/ 60/); assert.match(text, /0 \/ 20/); assert.match(text, /0 \/ 5/); assert.match(text, /0 \/ 15/);
  assert.doesNotMatch(text, /excluded from the score denominator|numeric overall score is withheld|Insufficient Data/);
});
