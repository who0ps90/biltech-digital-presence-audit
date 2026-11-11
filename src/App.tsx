import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight, CircleHelp, ExternalLink, FileCheck2, Link2, LoaderCircle, LockKeyhole, Menu, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { AnalyzeResponse, Place, Report as ReportData } from '../shared/types';
import Report, { Attribution } from './components/Report';
import { reviewReport } from '../shared/review';

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(40000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
export default function App() {
  const [url, setUrl] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [matches, setMatches] = useState<Extract<AnalyzeResponse, { kind: 'matches' }> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState<boolean | null>(null);
  const [dialog, setDialog] = useState<'help' | 'privacy' | 'terms' | null>(null);
  const [menu, setMenu] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const matchesRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const interacted = useRef(false);
  useEffect(() => { let active = true; Promise.all([request<{ liveAvailable: boolean }>('/api/config'), request<ReportData>('/api/demo')]).then(([configuration, sample]) => { if (active) { setLive(configuration.liveAvailable); if (!interacted.current) setReport(sample); } }).catch(() => { if (active && !interacted.current) setError('Could not connect to the audit server. Refresh to try again.'); }); return () => { active = false; }; }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (matches) matchesRef.current?.focus(); }, [matches]);
  useEffect(() => { if (dialog) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [dialog]);
  async function analyze(event: React.FormEvent) {
    event.preventDefault(); interacted.current = true; setError(''); setMatches(null); setReport(null); setBusy('Resolving your link and finding the business…');
    try {
      const result = await request<AnalyzeResponse>('/api/analyze', { url });
      if (result.kind === 'matches') setMatches(result); else setReport(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed. Please try again.'); } finally { setBusy(null); }
  }
  async function select(place: Place) {
    setError(''); setBusy('Retrieving business data and inspecting the public website…');
    try { setReport(await request<ReportData>('/api/select', { placeId: place.id, selectionToken: matches?.selectionToken })); setMatches(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not retrieve this business.'); } finally { setBusy(null); }
  }
  async function demo() {
    interacted.current = true; setError(''); setMatches(null); setReport(null); setBusy('Preparing the sample report…');
    try { setReport(await request<ReportData>('/api/demo')); } catch { setError('Could not load the sample report. Please try again.'); } finally { setBusy(null); }
  }
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className={`sidebar no-print ${menu ? 'open' : ''}`}>
      <a href="#main" className="brand" aria-label="Biltech Solution home"><span className="brand-mark"><BarChart3 size={23} strokeWidth={2.8} /></span><span>BILTECH<span>SOLUTION</span></span></a>
      <div className="workspace-label">BUSINESS TOOLS</div><nav aria-label="Main navigation"><a href="#main" className="nav-item active" onClick={() => setMenu(false)}><FileCheck2 size={18} /> Presence audit <ChevronRight size={14} /></a><a href="#scoring-guide" className="nav-item" onClick={() => setMenu(false)}><BarChart3 size={18} /> Scoring guide</a><button className="nav-item" onClick={() => { setDialog('help'); setMenu(false); }}><CircleHelp size={18} /> How it works</button></nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><div className="tiny-icon"><Sparkles size={18} /></div><strong>Clarity. Then action.</strong><p>Turn public profile data into practical next steps.</p><button onClick={() => setDialog('help')}>About this tool <ArrowUpRight size={14} /></button></div><div className="sidebar-credit"><span className="mini-mark">B</span><div>Biltech Solution<span>Business growth, made clearer.</span></div></div></div>
    </aside>
    <div className="app-shell"><header className="topbar no-print"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Toggle navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={20} /></button><span>Business tools</span><ChevronRight size={13} /><strong>Presence audit</strong></div><div className="header-meta"><span className="status-dot" /> Independent business insights</div></header>
    <main id="main"><section className="intro no-print"><div><div className="eyebrow"><span className="eyebrow-line" /> DIGITAL PRESENCE AUDIT</div><h1>A clearer picture of<br />your digital presence<span>.</span></h1><p>Know what’s working. See what needs attention.<br className="desktop-break" /> Get a practical plan to strengthen your first impression.</p></div><div className="intro-art" aria-hidden="true"><div className="art-grid" /><div className="art-circle" /><div className="art-sheet"><div className="art-sheet-top"><span /><ShieldCheck size={24} /></div><div className="art-lines"><i /><i /><i /></div><div className="art-bars"><i /><i /><i /><i /><i /></div></div><div className="art-check"><Check size={24} strokeWidth={3} /></div></div></section>
    <section className="card analyze-card no-print" aria-label="Analyze a business"><div className="input-heading"><span className="input-icon"><Link2 size={18} /></span><div><h2>Start with your Google Maps link</h2><p>Paste a business listing or share link. We’ll take it from here.</p></div><span className={`connection-badge ${live ? 'configured' : ''}`}><span />{live === null ? 'Connecting' : live ? 'Live API ready' : 'Demo available'}</span></div><form onSubmit={analyze}><label htmlFor="maps-url" className="sr-only">Google Maps business URL</label><div className="url-field"><Link2 size={18} /><input id="maps-url" type="url" required maxLength={4096} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://maps.app.goo.gl/your-business" disabled={Boolean(busy)} autoComplete="off" spellCheck={false} /></div><button className="button primary" type="submit" disabled={Boolean(busy)}>{busy ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />} Analyze Business <ArrowRight size={16} /></button></form><div className="input-footer"><span><LockKeyhole size={13} /> Public business data only. No account access needed.</span><button className="text-button" onClick={demo} disabled={Boolean(busy)}>Explore a sample report <ArrowUpRight size={14} /></button></div>{live === false ? <p className="setup-note">Live analysis needs a server API key. The sample report is ready to explore.</p> : null}</section>
    {error ? <div className="error-banner no-print" role="alert" tabIndex={-1} ref={errorRef}><CircleHelp size={20} /><div><strong>We couldn’t complete that request</strong><p>{error}</p></div></div> : null}
    {busy ? <div className="loading-panel" role="status" aria-live="polite"><LoaderCircle size={30} className="spin" /><h2>Building a clearer picture</h2><p>{busy}</p><span>Public evidence only. Unverified checks stay unknown.</span></div> : null}
    {matches ? <div className="card matches no-print" tabIndex={-1} ref={matchesRef}><span className="eyebrow">ONE QUICK CONFIRMATION</span><h2>Which business did you mean?</h2><p>Search results can be uncertain. Confirm the correct name and location before the audit. Selection expires in 5 minutes.</p><div className="match-list">{matches.candidates.map(p => <div className="match" key={p.id}><div><h3>{p.displayName?.text || 'Name not returned'}</h3><p>{p.pureServiceAreaBusiness ? 'Service-area business' : p.formattedAddress || 'Address not returned'}</p><span className="small muted">{p.primaryTypeDisplayName?.text || 'Category not returned'}</span><Attribution place={p} /></div><button className="button secondary" disabled={Boolean(busy)} onClick={() => select(p)}>Audit this business <ArrowRight size={15} /></button></div>)}</div></div> : null}
    {report && !busy ? <Report report={report} onManualReview={update => setReport(current => current ? reviewReport(current, update) : current)} /> : null}
    <footer className="site-footer no-print"><span>© {new Date().getFullYear()} Biltech Solution</span><div><button onClick={() => setDialog('privacy')}>Privacy</button><button onClick={() => setDialog('terms')}>Terms</button><span>Built for better business decisions <ExternalLink size={12} /></span></div></footer>
    </main></div>
    <dialog className="info-dialog" ref={dialogRef} onCancel={() => setDialog(null)} onClick={e => { if (e.target === e.currentTarget) setDialog(null); }}><div className="dialog-header"><span className="eyebrow">BILTECH SOLUTION</span><button className="icon-button" aria-label="Close dialog" onClick={() => setDialog(null)}><X size={20} /></button></div>{dialog === 'help' ? <><h2>From a link to a clear next step.</h2><ol><li>Paste a supported HTTPS Google Maps business URL.</li><li>Confirm a business when a name-based search is needed.</li><li>Review the health score, assessment coverage, and evidence.</li><li>Work through prioritized improvements and manual checks.</li><li>Save the assessment as a PDF from your browser.</li></ol><p>The tool uses Places API (New). It cannot access private Business Profile settings, verification, review replies, historical performance, or search rankings.</p><p>A CID-only link cannot be converted directly using Places API (New). Use a place link containing the business name or an explicit Place ID.</p><p>For live reports, print includes Biltech’s assessment and guidance; source business details and raw API evidence are excluded from print to limit export of Google Maps content.</p></> : dialog === 'privacy' ? <><h2>Privacy notice</h2><p>Biltech Solution processes the Maps URL you submit and your IP address to provide the audit and apply request limits. Submitted URLs may contain personal query text; share only a public business link.</p><p>Live lookups are sent from this server to Google Maps Platform. Public business websites may also receive bounded homepage and robots.txt requests from the server. Business data, website findings, and manual confirmations are held only in the current request and page memory. This app uses no database, analytics, cookies, or browser storage for reports. Reloading clears the report.</p><p>IP rate counters expire after 15 minutes; daily request counts contain no business data. No request bodies or business records are logged by the application. Hosting providers may maintain infrastructure logs under their own policies.</p><p>Google Maps features and content are subject to the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>. Sample data is fictional.</p></> : <><h2>Terms of use</h2><p>This tool provides independent informational assessments. Biltech’s targets are configurable and do not represent Google ranking criteria or verification. Validate business changes with the business owner.</p><p>This application includes Google Maps features and content. Their use is subject to the <a href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noreferrer">Google Maps End User Additional Terms of Service</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>.</p><p>Google Maps content remains subject to Google’s applicable usage and storage restrictions. Do not bulk extract, cache, resell, or redistribute source content. Live report printouts omit source business details and raw API evidence.</p><p>Biltech Digital Presence Score — independent assessment, not a Google ranking or SEO algorithm metric.</p></>}</dialog>
  </>;
}
