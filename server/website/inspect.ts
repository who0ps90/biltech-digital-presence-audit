import type { WebsiteInspection } from '../../shared/types.js';
import { uninspectedWebsite } from '../../shared/normalize.js';
import { inspectHtml } from './html.js';
import { InspectionError, publicRequest, validateWebsiteUrl, type PageTransport } from './transport.js';

export function robotsAllows(text: string, path: string): boolean {
  // Apply matching BiltechAuditBot groups, otherwise wildcard groups; longest path wins.
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let group = { agents: [] as string[], rules: [] as { allow: boolean; path: string }[] };
  for (const line of text.split(/\r?\n/)) {
    const match = line.replace(/#.*/, '').match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/); if (!match) continue;
    const key = match[1].toLowerCase(), value = match[2];
    if (key === 'user-agent') { if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; } group.agents.push(value.toLowerCase()); }
    else if ((key === 'allow' || key === 'disallow') && value && group.agents.length && value.length <= 2048) group.rules.push({ allow: key === 'allow', path: value });
  }
  groups.push(group);
  const specific = groups.filter(g => g.agents.some(agent => agent !== '*' && 'biltechauditbot'.includes(agent)));
  const selected = specific.length ? specific : groups.filter(g => g.agents.includes('*'));
  const rules = selected.flatMap(g => g.rules).filter(rule => {
    // Match wildcards without compiling attacker-controlled regular expressions.
    const anchored = rule.path.endsWith('$');
    const parts = (anchored ? rule.path.slice(0, -1) : rule.path).split('*');
    let offset = 0;
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      const position = index === 0 ? (path.startsWith(part) ? 0 : -1) : path.indexOf(part, offset);
      if (position < 0) return false;
      offset = position + part.length;
    }
    return !anchored || offset === path.length;
  }).sort((a, b) => b.path.replace(/[*$]/g, '').length - a.path.replace(/[*$]/g, '').length || Number(b.allow) - Number(a.allow));
  return rules[0]?.allow ?? true;
}
export async function inspectWebsite(raw?: string, transport: PageTransport = publicRequest): Promise<WebsiteInspection> {
  const result = uninspectedWebsite();
  if (!raw) return result;
  result.requestedUrl = raw; result.notes = [];
  const deadline = Date.now() + 10000;
  let requests = 0;
  const robotsByOrigin = new Map<string, string>();
  const request = async (url: URL, maxBytes: number) => { if (++requests > 10) throw new InspectionError('error', 'Website request limit reached.'); if (Date.now() >= deadline) throw new InspectionError('timeout', 'Website inspection timed out.'); return transport(url, deadline, maxBytes); };
  const robotsFor = async (origin: string) => {
    if (robotsByOrigin.has(origin)) return robotsByOrigin.get(origin)!;
    let url = validateWebsiteUrl(`${origin}/robots.txt`);
    for (let redirects = 0; ; redirects++) {
      const page = await request(url, 512 * 1024);
      if ([301, 302, 303, 307, 308].includes(page.status) && page.headers.location) { if (redirects >= 5) throw new InspectionError('error', 'Robots redirect limit reached.'); url = validateWebsiteUrl(new URL(page.headers.location, url).href); continue; }
      if (page.status >= 500) throw new InspectionError('error', 'Robots policy could not be reached; website inspection was skipped.');
      if (page.headers['content-encoding'] && page.headers['content-encoding'] !== 'identity') throw new InspectionError('error', 'Robots policy could not be decoded safely; inspection was skipped.');
      const text = page.status >= 200 && page.status < 300 ? page.body : '';
      robotsByOrigin.set(origin, text); return text;
    }
  };
  try {
    let url = validateWebsiteUrl(raw); const visited = new Set<string>();
    for (let redirects = 0; ; redirects++) {
      if (visited.has(url.href)) throw new InspectionError('error', 'Website redirect loop detected.'); visited.add(url.href);
      const robots = await robotsFor(url.origin);
      if (!robotsAllows(robots, url.pathname + url.search)) { result.state = 'robots'; result.notes.push('Website robots policy disallows this page. Downstream discovery is not assessed.'); return result; }
      const page = await request(url, 1024 * 1024);
      if ([301, 302, 303, 307, 308].includes(page.status) && page.headers.location) {
        if (redirects >= 3) throw new InspectionError('error', 'Website redirect limit reached.');
        url = validateWebsiteUrl(new URL(page.headers.location, url).href); continue;
      }
      result.finalUrl = url.href; result.httpStatus = page.status; result.https = url.protocol === 'https:';
      if ([401, 403, 429].includes(page.status)) { result.state = 'blocked'; result.notes.push(`HTTP ${page.status}: crawler access is restricted; customer accessibility and downstream checks remain unknown.`); return result; }
      if (page.status < 200 || page.status >= 300) { result.state = 'error'; result.accessible = false; result.notes.push(`Website returned HTTP ${page.status}. Content discovery was not assessed.`); return result; }
      result.accessible = true;
      if (!/^text\/html|^application\/xhtml\+xml/i.test(page.headers['content-type'] || '')) { result.state = 'non-html'; result.notes.push('Website response was not supported HTML. Downstream checks remain unknown.'); return result; }
      if (page.headers['content-encoding'] && page.headers['content-encoding'] !== 'identity') { result.state = 'partial'; result.notes.push('Server returned an unsupported compressed response. Content checks remain unknown.'); return result; }
      const parsed = inspectHtml(page.body, url.href);
      if (parsed.challenge) { result.state = 'blocked'; result.accessible = null; result.notes.push('A challenge or access-denied page was detected. It was not bypassed.'); return result; }
      Object.assign(result, parsed);
      result.state = parsed.contentReliable ? 'inspected' : 'partial';
      result.notes.push('Only the server-rendered homepage was inspected. Links were discovered, not followed or verified as official accounts. Forms and bookings were not submitted.');
      if (!parsed.contentReliable) result.notes.push('Page appears to require JavaScript; missing content-dependent checks remain unknown.');
      return result;
    }
  } catch (error) { result.state = error instanceof InspectionError ? error.kind : 'error'; result.notes.push(error instanceof InspectionError ? error.message : 'Website inspection could not be completed safely.'); return result; }
}
