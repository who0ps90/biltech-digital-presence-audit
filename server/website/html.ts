import { parseDocument, DomUtils } from 'htmlparser2';
import type { DiscoveredLink } from '../../shared/types.js';
import { socialProfile } from './social.js';
import { contactChannel } from './contacts.js';

export function inspectHtml(html: string, base: string) {
  const doc = parseDocument(html, { decodeEntities: true });
  const tags = DomUtils.getElementsByTagName('*', doc.children);
  type Element = (typeof tags)[number];
  const text = (element: Element) => DomUtils.textContent(element).replace(/\s+/g, ' ').trim();
  const hidden = (element: Element): boolean => {
    for (let node: Element | null = element; node; node = node.parent && 'attribs' in node.parent ? node.parent as Element : null) {
      if ('hidden' in node.attribs || 'inert' in node.attribs || node.attribs['aria-hidden'] === 'true' || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(node.attribs.style || '')) return true;
    }
    return false;
  };
  const links: DiscoveredLink[] = [], contacts: DiscoveredLink[] = [];
  for (const element of tags.filter(tag => tag.name === 'a' && tag.attribs.href && !hidden(tag))) {
    const label = text(element) || element.attribs['aria-label'] || element.attribs.title || DomUtils.getElementsByTagName('img', element.children).map(image => image.attribs.alt || '').join(' ');
    const around = element.parent ? DomUtils.textContent(element.parent).slice(0, 200) : '';
    if (!/\b(designed by|developed by|website by|powered by)\b/i.test(around)) {
      try { const profile = socialProfile(new URL(element.attribs.href, base).href); if (profile) links.push(profile); } catch { /* not a navigable link */ }
    }
    // An accessible label is required for a CTA. An unlabeled hidden icon is not sufficient.
    if (label.trim()) { const channel = contactChannel(element.attribs.href, label, base); if (channel) contacts.push(channel); }
  }
  // Only business/organization sameAs statements are supported; unrelated Person graphs are ignored.
  const walk = (value: unknown, depth = 0) => {
    if (depth > 15 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.slice(0, 100).forEach(item => walk(item, depth + 1)); return; }
    const object = value as Record<string, unknown>;
    const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']];
    if (types.some(type => typeof type === 'string' && /(?:Organization|Business|Restaurant|Store|Dentist|Physician|Salon|Hotel|Service)$/.test(type))) {
      const sameAs = Array.isArray(object.sameAs) ? object.sameAs : [object.sameAs];
      sameAs.slice(0, 30).forEach(raw => { if (typeof raw === 'string') { const profile = socialProfile(raw, 'structured-data'); if (profile) links.push(profile); } });
    }
    Object.entries(object).filter(([key]) => key !== 'sameAs').slice(0, 100).forEach(([, item]) => walk(item, depth + 1));
  };
  tags.filter(tag => tag.name === 'script' && tag.attribs.type?.toLowerCase() === 'application/ld+json').slice(0, 20).forEach(script => { try { walk(JSON.parse(DomUtils.textContent(script))); } catch { /* invalid JSON-LD is not evidence */ } });
  const forms = tags.filter(tag => tag.name === 'form' && !hidden(tag));
  const enquiryForm = forms.find(form => {
    const fields = DomUtils.getElementsByTagName('*', form.children).filter(field => !hidden(field) && !('disabled' in field.attribs));
    const email = fields.some(field => field.name === 'input' && field.attribs.type === 'email');
    const message = fields.some(field => field.name === 'textarea' || (field.name === 'input' && /message|enquiry|inquiry/i.test(field.attribs.name || '')));
    const submit = fields.some(field => (field.name === 'button' && (!field.attribs.type || field.attribs.type === 'submit')) || (field.name === 'input' && field.attribs.type === 'submit'));
    return email && message && submit;
  });
  if (enquiryForm) contacts.push({ label: 'Enquiry form', url: base, source: 'homepage-link' });
  const unique = (items: DiscoveredLink[]) => [...new Map(items.map(item => [item.url + item.label, item])).values()].slice(0, 30);
  const visibleBodyText = tags.filter(tag => ['p', 'h1', 'h2', 'address'].includes(tag.name) && !hidden(tag)).map(text).join(' ');
  const title = text(tags.find(tag => tag.name === 'title') || parseDocument('<title></title>').children[0] as Element).slice(0, 300);
  const description = tags.find(tag => tag.name === 'meta' && tag.attribs.name?.toLowerCase() === 'description')?.attribs.content?.trim().slice(0, 1000) || '';
  const challenge = /just a moment|attention required|verify (you are|that you are) human|access denied/i.test(`${title} ${visibleBodyText.slice(0, 500)}`);
  const scriptShell = visibleBodyText.length < 60 && tags.some(tag => tag.name === 'script' && tag.attribs.src) && !contacts.length;
  const reliable = !challenge && !scriptShell;
  const contactLinks = unique(contacts);
  const found = (match: boolean) => match ? true : reliable ? false : null;
  return { title: title || (reliable ? '' : null), metaDescription: description || (reliable ? '' : null), contentReliable: reliable,
    socialLinks: challenge ? [] : unique(links), contactLinks: challenge ? [] : contactLinks,
    cta: challenge ? null : found(contactLinks.length > 0), messaging: challenge ? null : found(contactLinks.some(link => ['WhatsApp', 'Messenger', 'Telegram'].includes(link.label))),
    emailOrForm: challenge ? null : found(contactLinks.some(link => ['Email', 'Enquiry form'].includes(link.label))), booking: challenge ? null : found(contactLinks.some(link => link.label === 'Booking / appointment')), challenge };
}
