import type { DiscoveredLink } from '../../shared/types.js';
export function contactChannel(raw: string, text: string, base: string): DiscoveredLink | null {
  const trimmed = raw.trim();
  if (/^tel:\+?[\d().\s-]{5,30}$/i.test(trimmed)) return { label: 'Call', url: trimmed, source: 'homepage-link' };
  if (/^mailto:[^\s@?]+@[^\s@?]+\.[^\s@?]+(?:\?.*)?$/i.test(trimmed)) return { label: 'Email', url: trimmed.split('?')[0], source: 'homepage-link' };
  let url: URL;
  try { url = new URL(trimmed, base); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const path = url.pathname;
  if ((host === 'wa.me' && /^\/\d{7,15}\/??$/.test(path)) || (['api.whatsapp.com', 'web.whatsapp.com', 'whatsapp.com'].includes(host) && path === '/send' && /^\+?\d{7,15}$/.test(url.searchParams.get('phone') || ''))) return { label: 'WhatsApp', url: url.href, source: 'homepage-link' };
  if ((host === 'm.me' || host === 't.me') && /^\/[\w.]{3,}$/.test(path)) return { label: host === 'm.me' ? 'Messenger' : 'Telegram', url: url.href, source: 'homepage-link' };
  if (/\b(book(?:ing)?|appointment|reserve|reservation|consultation)\b/i.test(`${text} ${path.replace(/[-_/]/g, ' ')}`) && !/\b(bookstore|ebook|facebook|cancel)\b/i.test(text)) return { label: 'Booking / appointment', url: url.href, source: 'homepage-link' };
  if (/\b(contact|enquir(?:y|e)|inquiry|get in touch|call us)\b/i.test(text) || /^\/(contact|contact-us|enquiry)(\/|$)/i.test(path)) return { label: 'Contact', url: url.href, source: 'homepage-link' };
  return null;
}
