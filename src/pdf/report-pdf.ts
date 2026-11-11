import { jsPDF } from 'jspdf';
import type { Check, Report } from '../../shared/types';

const palette = { ink: '#18343c', teal: '#087e73', muted: '#5c7179', line: '#dce7e3', light: '#f0f6f4', amber: '#86652d' };
const clean = (value: string) => value.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u00a0\u202f]/g, ' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const date = (value: string) => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const hasUnicode = (value: string) => /[^\x20-\x7e\u00a0-\u00ff]/u.test(value);

// Uses vector text for ordinary Latin copy. Unicode lines use the browser's local
// font fallback as high-resolution images, avoiding broken glyphs or font downloads.
function unicodeContext(size: number, bold: boolean) {
  if (typeof document === 'undefined') throw new Error('Unicode PDF text requires the browser font renderer.');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PDF text rendering is unavailable in this browser.');
  context.font = `${bold ? '600' : '400'} ${size * 96 / 72}px Arial, "Segoe UI", sans-serif`;
  return { canvas, context };
}

export function pdfFilename(report: Report) {
  const id = report.mode === 'demo' ? 'sample' : report.place.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 70) || 'business';
  return `biltech-digital-presence-${id}-${report.generatedAt.slice(0, 10)}.pdf`;
}

export function createReportPdf(report: Report): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  pdf.setProperties({ title: 'Biltech Digital Presence Audit Report', author: 'Biltech Solution', subject: `Independent assessment - policy ${report.policyVersion}` });
  const margin = 17, width = 176, bottom = 276;
  let y = 27;
  const header = () => {
    pdf.setFillColor(palette.teal); pdf.rect(0, 0, 210, 3, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(palette.ink); pdf.text('BILTECH SOLUTION', margin, 15);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(palette.muted); pdf.text('DIGITAL PRESENCE AUDIT', 193, 15, { align: 'right' });
    pdf.setDrawColor(palette.line); pdf.line(margin, 20, 193, 20);
  };
  header();
  const ensure = (height: number) => { if (y + height > bottom) { pdf.addPage(); header(); y = 29; } };
  const wrap = (value: string, size = 9, bold = false, maxWidth = width): string[] => {
    const text = clean(value);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size);
    if (!hasUnicode(text)) return pdf.splitTextToSize(text, maxWidth) as string[];
    const { context } = unicodeContext(size, bold);
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const character of paragraph) {
        if (line && context.measureText(line + character).width * 25.4 / 96 > maxWidth) { lines.push(line); line = ''; }
        line += character;
      }
      lines.push(line);
    }
    return lines;
  };
  const line = (text: string, x: number, size: number, bold: boolean, color: string) => {
    pdf.setTextColor(color); pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size);
    if (!hasUnicode(text)) { pdf.text(text, x, y); return; }
    const { canvas, context } = unicodeContext(size, bold);
    const pixelWidth = Math.ceil(context.measureText(text).width) + 4, pixelHeight = Math.ceil(size * 96 / 72 * 1.5);
    const scale = 3; canvas.width = pixelWidth * scale; canvas.height = pixelHeight * scale;
    context.scale(scale, scale); context.font = `${bold ? '600' : '400'} ${size * 96 / 72}px Arial, "Segoe UI", sans-serif`;
    context.fillStyle = color; context.textBaseline = 'alphabetic'; context.fillText(text, 0, size * 96 / 72);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y - size * 25.4 / 72, pixelWidth * 25.4 / 96, pixelHeight * 25.4 / 96);
  };
  const text = (value: string, size = 9, bold = false, color = palette.muted, indent = 0) => {
    const lines = wrap(value, size, bold, width - indent), height = size * .45;
    for (const content of lines) { ensure(height + 1); line(content, margin + indent, size, bold, color); y += height; }
    y += 1.5;
  };
  const textHeight = (value: string, size = 9, bold = false) => wrap(value, size, bold).length * size * .45 + 1.5;
  const section = (title: string) => { ensure(18); y += 4; text(title, 13, true, palette.ink); y += 2; };
  const field = (label: string, value: string) => text(`${label}: ${value}`, 8.5);
  const rule = () => { ensure(4); pdf.setDrawColor(palette.line); pdf.line(margin, y, 193, y); y += 5; };
  const sourceLink = `https://www.google.com/maps/search/?api=1&query=business&query_place_id=${encodeURIComponent(report.place.id)}`;
  const checkStatus = (check: Check) => check.unavailable ? 'UNAVAILABLE' : check.status.replaceAll('_', ' ');
  const top = report.recommendations.filter(item => !report.assessment.checks.find(check => check.id === item.criterionId)?.unavailable).slice(0, 3);

  text('Biltech Digital Presence', 21, true, palette.ink); text('Audit Report', 21, true, palette.ink); y += 2;
  if (report.mode === 'demo') {
    text('SAMPLE REPORT - ALL BUSINESS DATA AND FINDINGS ARE FICTIONAL', 8.5, true, palette.amber);
    text(report.place.displayName?.text || 'Fictional sample business', 11, true, palette.ink);
  } else text('Independent assessment. Raw Google business data and API evidence are excluded from this export.', 8.5);
  field('Audit timestamp', date(report.generatedAt)); field('Scoring policy', `v${report.policyVersion} - fixed 100-point maximum`); y += 3;
  ensure(28);
  pdf.setFillColor(palette.light); pdf.roundedRect(margin, y - 3, width, 25, 3, 3, 'F');
  y += 7;
  line(`${report.assessment.score} / 100`, margin + 5, 23, true, palette.teal);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(palette.ink); pdf.text(report.assessment.label, 188, y - 2, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(palette.muted); pdf.text(`Evidence coverage: ${report.assessment.coverage}%`, 188, y + 4, { align: 'right' });
  y += 11; line(`${report.assessment.earned} points earned; all missing or unverified checks earn zero.`, margin + 5, 8, false, palette.muted); y += 10;
  text('Biltech Digital Presence Score - independent assessment, not a Google ranking or SEO algorithm metric.', 8);

  section('Four-category score breakdown');
  for (const group of report.assessment.groups) {
    ensure(16); text(`${group.name}     ${group.earned} / ${group.max}`, 10, true, palette.ink);
    pdf.setFillColor('#e8efed'); pdf.roundedRect(margin, y, width, 2, 1, 1, 'F');
    if (group.earned > 0) { pdf.setFillColor(palette.teal); pdf.roundedRect(margin, y, width * Math.min(1, group.earned / group.max), 2, 1, 1, 'F'); }
    y += 6; text(`Evidence coverage: ${group.coverage}%`, 7.5);
  }

  section('Top 3 Improvement Opportunities');
  if (!top.length) text('No verified improvement findings yet. Review zero-point checks and their evidence limitations.');
  top.forEach((item, index) => {
    const estimate = textHeight(`${index + 1}. ${item.issue}`, 10, true) + textHeight(`${item.category} | ${item.priority} priority | Up to ${item.recoverablePoints} points`, 8, true) + textHeight(`Why it matters: ${item.why}`, 8.5) + textHeight(`Recommended action: ${item.action}`, 8.5) + 4;
    ensure(Math.min(estimate, 245));
    text(`${index + 1}. ${item.issue}`, 10, true, palette.ink);
    text(`${item.category} | ${item.priority} priority | Up to ${item.recoverablePoints} points`, 8, true, palette.teal);
    field('Why it matters', item.why); field('Recommended action', item.action); y += 2;
  });

  section('Website and discovered channels');
  const site = report.audit.website;
  field('Inspection', `${site.state} - ${date(site.inspectedAt)}`);
  field('Website', site.finalUrl || site.requestedUrl || (report.audit.websitePresence === 'confirmed-absent' ? 'No website - manually confirmed.' : 'Not returned; existence remains unknown.'));
  field('Homepage title', site.title === null ? 'Not assessed - 0 points.' : site.title || 'Not found.');
  field('Meta description', site.metaDescription === null ? 'Not assessed - 0 points.' : site.metaDescription || 'Not found.');
  text('Social profiles', 10, true, palette.ink);
  if (!site.socialLinks.length) text(site.contentReliable ? 'No relevant profile links discovered on the homepage; accounts may exist elsewhere.' : 'Not assessed - homepage discovery was unavailable.');
  site.socialLinks.forEach(link => field(link.label, link.url));
  text('Website-linked accounts are not verified as official accounts or linked to Google Business Profile.', 8);
  text('Customer enquiry channels', 10, true, palette.ink);
  if (!site.contactLinks.length) text(site.contentReliable ? 'No contact channels discovered on the inspected homepage.' : 'Not assessed - contact-channel discovery was unavailable.');
  site.contactLinks.forEach(link => field(link.label, link.url));
  site.notes.forEach(note => text(note, 8));

  section('Complete improvement checklist');
  const checkRows = (check: Check) => {
    const includeEvidence = report.mode === 'demo' || check.evidenceSource !== 'Google Places API (New)';
    return [
      { value: `${check.label} - ${check.earned} / ${check.max}`, size: 10, bold: true, color: palette.ink },
      { value: `${check.id} | ${checkStatus(check)}${check.status === 'NEEDS_IMPROVEMENT' ? ` | ${check.priority} priority` : ''}`, size: 8, bold: true, color: palette.teal },
      ...(includeEvidence ? [{ value: `Evidence: ${check.evidence}`, size: 8.5 }, { value: `Evidence source: ${check.evidenceSource}`, size: 8.5 }] : [{ value: 'Raw Google source evidence is available in the on-screen report and is excluded from this PDF.', size: 8 }]),
      { value: `Evidence timestamp: ${date(check.evidenceTimestamp)}`, size: 8.5 },
      { value: `Assessment: ${check.explanation}`, size: 8.5 },
      { value: `Why it matters: ${check.why}`, size: 8.5 },
      { value: `${check.status === 'NOT_ASSESSED' ? 'Manual check' : 'Recommended action'}: ${check.improvement}`, size: 8.5 },
    ];
  };
  const checkHeight = (check: Check) => checkRows(check).reduce((sum, row) => sum + textHeight(row.value, row.size, 'bold' in row && row.bold === true), 0) + 7;
  for (const group of report.assessment.groups) {
    const groupChecks = report.assessment.checks.filter(item => item.category === group.name);
    const heading = `${group.name} - ${group.earned} / ${group.max}`;
    ensure(Math.min(textHeight(heading, 12, true) + (groupChecks[0] ? checkHeight(groupChecks[0]) : 0), 245));
    text(heading, 12, true, palette.teal);
    for (const check of groupChecks) {
      ensure(Math.min(checkHeight(check), 245));
      for (const row of checkRows(check)) text(row.value, row.size, 'bold' in row && row.bold === true, 'color' in row ? row.color : palette.muted);
      rule();
    }
  }

  const method = [
    'Category maximums are 60 + 20 + 5 + 15 = 100. Scores sum earned points without redistributing missing weights. Missing, inaccessible, unassessed, and not-applicable checks earn zero. Evidence coverage is separate and never increases or hides the numeric score.',
    'Rating and review targets, applicability classifications, and recommendation priorities are Biltech heuristics, not official Google ranking thresholds. Website inspection is limited to static homepage content. Social ownership and account activity are not verified; forms, messaging delivery, and booking completion are not tested.',
  ];
  const closing = report.mode === 'live' ? [`Place ID: ${report.place.id}`, `Current source listing: ${sourceLink}`] : ['This is a fictional sample. No sample business, website, or social account was verified.'];
  const methodHeight = 15 + method.reduce((sum, paragraph) => sum + textHeight(paragraph), 0) + textHeight(`Booking applicability: ${report.audit.bookingEvidence}`, 8.5) + (report.audit.manual.confirmedAt ? textHeight(`Manual confirmation timestamp: ${date(report.audit.manual.confirmedAt)}`, 8.5) : 0) + closing.reduce((sum, paragraph) => sum + textHeight(paragraph, 8.5), 0);
  ensure(Math.min(methodHeight, 245)); section('Method and evidence limitations');
  method.forEach(paragraph => text(paragraph));
  field('Booking applicability', report.audit.bookingEvidence);
  if (report.audit.manual.confirmedAt) field('Manual confirmation timestamp', date(report.audit.manual.confirmedAt));
  if (report.mode === 'live') { field('Place ID', report.place.id); field('Current source listing', sourceLink); }
  else text('This is a fictional sample. No sample business, website, or social account was verified.', 9, true, palette.amber);

  const count = pdf.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    pdf.setPage(page); pdf.setDrawColor(palette.line); pdf.line(margin, 282, 193, 282);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(palette.muted);
    pdf.text(`Biltech Solution | Independent assessment | ${report.mode === 'demo' ? 'FICTIONAL SAMPLE' : 'LIVE ASSESSMENT'}`, margin, 287);
    pdf.text(`${page} / ${count}`, 193, 287, { align: 'right' });
  }
  return pdf;
}

export async function downloadReportPdf(report: Report) {
  const pdf = createReportPdf(report);
  await pdf.save(pdfFilename(report), { returnPromise: true });
}
