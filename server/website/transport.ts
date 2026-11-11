import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isPublicAddress } from '../maps-url.js';

export class InspectionError extends Error { constructor(public kind: 'unsafe' | 'timeout' | 'error', message: string) { super(message); } }
const protectedHosts = ['google.com', 'google.com.my', 'google.co.uk', 'goo.gl', 'maps.app.goo.gl', 'facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'linkedin.com', 'x.com', 'twitter.com'];
export function validateWebsiteUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new InspectionError('unsafe', 'Website URL is invalid.'); }
  if (/^maps\.google\./i.test(url.hostname) || (/(^|\.)google\.[a-z.]+$/i.test(url.hostname) && /^\/(maps|local)(\/|$)/i.test(url.pathname))) throw new InspectionError('unsafe', 'Google Maps pages are not crawled.');
  if (raw.length > 4096 || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80')) || !url.hostname.includes('.') || /\.(local|localhost|internal|test|invalid)$/i.test(url.hostname) || protectedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new InspectionError('unsafe', 'Website destination is private, unsupported, or a protected platform. It was not crawled.');
  url.hash = '';
  return url;
}
export interface PageResponse { url: string; status: number; headers: Record<string, string | undefined>; body: string; }
export type PageTransport = (url: URL, deadline: number, maxBytes: number) => Promise<PageResponse>;
export const publicRequest: PageTransport = async (url, deadline, maxBytes) => {
  validateWebsiteUrl(url.href);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));
  try {
    if (Date.now() >= deadline) throw new InspectionError('timeout', 'Website inspection timed out.');
    const addresses = await Promise.race([lookup(url.hostname, { all: true, verbatim: true }), new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new InspectionError('timeout', 'Website DNS lookup timed out.')), { once: true }))]);
    if (!addresses.length || addresses.some(address => !isPublicAddress(address.address))) throw new InspectionError('unsafe', 'Website DNS resolved to a non-public destination.');
    const selected = addresses.find(address => address.family === 4) || addresses[0];
    return await new Promise<PageResponse>((resolve, reject) => {
      const request = (url.protocol === 'https:' ? https : http).request(url, { method: 'GET', agent: false, signal: controller.signal, family: selected.family, lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family), headers: { 'User-Agent': 'BiltechAuditBot/2.0', Accept: 'text/html,text/plain;q=0.8', 'Accept-Encoding': 'identity' } }, response => {
        const headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value]));
        if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) { response.destroy(); resolve({ url: url.href, status: response.statusCode!, headers, body: '' }); return; }
        const chunks: Buffer[] = []; let bytes = 0;
        response.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > maxBytes) { response.destroy(new InspectionError('error', 'Website response exceeded the inspection size limit.')); return; } chunks.push(chunk); });
        response.on('error', reject);
        response.on('end', () => resolve({ url: url.href, status: response.statusCode || 0, headers, body: Buffer.concat(chunks).toString('utf8') }));
      });
      request.on('error', reject); request.end();
    });
  } catch (error) { if (error instanceof InspectionError) throw error; throw new InspectionError(controller.signal.aborted ? 'timeout' : 'error', controller.signal.aborted ? 'Website inspection timed out.' : 'Website connection or TLS verification could not be completed.'); }
  finally { clearTimeout(timer); }
};
