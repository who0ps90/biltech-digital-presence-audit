import type { DiscoveredLink } from '../../shared/types.js';
export function socialProfile(raw: string, source: DiscoveredLink['source'] = 'homepage-link'): DiscoveredLink | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean);
  let label: string | undefined;
  if (host === 'facebook.com' && ((parts.length === 1 && !/^(share|sharer|sharer.php|dialog|login|plugins|watch|reel|stories|help|groups)$/i.test(parts[0])) || /^\/pages\/[^/]+\/\d+$/.test(path))) label = 'Facebook';
  if (host === 'instagram.com' && parts.length === 1 && !/^(p|reel|reels|stories|accounts|explore|share|direct)$/i.test(parts[0])) label = 'Instagram';
  if (host === 'tiktok.com' && /^\/@[\w.-]+$/.test(path)) label = 'TikTok';
  if ((host === 'youtube.com') && (/^\/@[^/]+$/.test(path) || /^\/(channel|c|user)\/[^/]+$/.test(path))) label = 'YouTube';
  if (host === 'linkedin.com' && /^\/(company|school)\/[^/]+$/.test(path)) label = 'LinkedIn';
  if (['x.com', 'twitter.com'].includes(host) && parts.length === 1 && /^[\w]{1,15}$/.test(parts[0]) && !/^(intent|share|home|search|explore|login|signup|i)$/i.test(parts[0])) label = 'X / Twitter';
  if (!label) return null;
  url.protocol = 'https:'; url.hostname = ['twitter.com', 'x.com'].includes(host) ? 'x.com' : host;
  url.hash = ''; url.pathname = path;
  const facebookId = host === 'facebook.com' && path === '/profile.php' ? url.searchParams.get('id') : null;
  if (path === '/profile.php' && !/^\d+$/.test(facebookId || '')) return null;
  url.search = facebookId ? `?id=${facebookId}` : '';
  return { label, url: url.href, source };
}
