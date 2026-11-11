# Biltech Solution — Unified Digital Presence Audit

Version 2.1 uses a fixed 100-point scoring total. Missing, inaccessible, unassessed, and not-applicable checks earn zero without removing or redistributing their weight. The Google Maps input, official Places API (New) retrieval, business match confirmation, and Biltech styling are retained. Save as PDF now downloads a generated PDF directly.

No database, accounts, CRM, paid AI, or public deployment is included.

## Local use

Requires Node.js 22.12+ and pnpm 11 (or npm). Dependencies are locked in `pnpm-lock.yaml`.

```powershell
pnpm install
# Only if you do not already have .env.local:
Copy-Item .env.example .env.local
pnpm dev
```

Open http://localhost:3000. Clearly labeled fictional demo data works without a Google key. The existing `.env.local` contains server configuration and is ignored by Git; do not overwrite it or expose its contents.

```powershell
pnpm test
pnpm build
pnpm start
```

Equivalent npm commands are available through the same package scripts. Production serves `dist/` and the API in one Node process. The local preview is intentionally left running after this upgrade; no public deployment is authorized.

## Google Cloud configuration

1. Select a Google Cloud project, enable billing, and enable **Places API (New)** (`places.googleapis.com`).
2. Create a separate server API key. Restrict API access to Places API (New); use allowed public outbound server IPs for application restrictions, rather than browser/referrer restrictions.
3. Put the key in `GOOGLE_PLACES_API_KEY` in `.env.local` and restart the Node server. Never use a `VITE_` prefix, commit it, or include it in browser code.
4. Configure method-specific Google Cloud quotas and billing alerts. Alerts do not stop spending.
5. Keep `APP_ORIGIN` equal to the browser origin, by default `http://localhost:3000`. The server binds to loopback.

`DAILY_GOOGLE_REQUEST_CAP` counts upstream attempts per UTC day **per process**; failed requests count. It resets on restart and is not shared across processes. Set Google Cloud quotas for durable spend enforcement. A zero cap disables live requests. Rate limiting defaults to 30 API requests per IP per 15 minutes. Express does not trust forwarded IP headers by default.

The diagnostic `node --import tsx scripts/check-google-access.ts` makes one minimal Google Text Search request and prints only sanitized status classifications, never the key or raw Google errors.

## Scoring configuration

All criterion weights, category assignments, labels, targets, booking applicability heuristics, coverage thresholds, and recommendation ranking weights are centralized in **`shared/policy.ts`**. The scoring engine is in `shared/scoring.ts`; normalization and recommendations are separate modules. Rebuild/restart after changing the shared configuration. Keep weights nonnegative, targets positive, and total configured weight 100.

| Category | Criteria and maximum points | Total |
| --- | --- | ---: |
| Google Business Profile | Rating 10; review count 10; name 3; primary category 6; business status 3; phone 6; address/service area 4; hours 8; photos 10 | 60 |
| Website Presence & Health | Website listed 6; accessibility 6; valid HTTPS 3; meaningful title 3; non-empty meta description 2 | 20 |
| Social Media Presence | One discovered relevant profile earns 3; two or more earn 5 total | 5 |
| Customer Enquiry Readiness | Contact CTA 4; direct messaging 3; email/enquiry form 3; relevant booking link 5 | 15 |

The old application used proportional review formulas, not discrete tier bands. Version 2 preserves them at the new weights:

```text
Rating points = min(rating / 4.5, 1) × 10
Review points = min(review count / 50, 1) × 10
```

These are Biltech heuristics, not official Google ranking thresholds. Category presence does not establish suitability. A limited photo-reference sample establishes presence only, not total count, recency, quality, or ownership.

Every criterion includes ID, category, maximum points, points earned, one of four assessment statuses, evidence, evidence source, evidence timestamp, explanation, and a corrective action.

- `PASS`: verified criterion earns full points.
- `NEEDS_IMPROVEMENT`: assessed criterion earns fewer than its maximum, including zero.
- `NOT_ASSESSED`: evidence is unavailable or applicability uncertain; earns **0** and retains its full configured weight.
- `NOT_APPLICABLE`: criterion does not apply; earns **0** and retains its full configured weight under the fixed-total policy.

```text
Overall score = total earned points / 100 × 100
Category percentage = category earned points / full configured category maximum × 100
Evidence coverage = verified weighted points / 100 × 100
```

Points are rounded to two decimals; category and overall totals use those same values. Overall scores round to a whole number; coverage uses two decimals. Every report displays a numeric score, including **0/100** when all evidence is unavailable. Below 70% evidence coverage the score is labeled **Preliminary Score**, but it is neither inflated nor hidden. With at least 70% coverage, labels are Excellent (90+), Good (75+), Needs Attention (60+), and Priority Improvements (below 60). Category denominators always remain 60/20/5/15, summing to exactly 100. Invalid total configurations are rejected.

### Unknowns, absent websites, and manual decisions

- An omitted Google field stays labeled unknown and earns **0**. API omission does not prove a field or business website is absent. An explicit zero review count and an unknown count both earn zero, while keeping different evidence labels.
- A pure service-area business is not required to publish a street address. Its address criterion stays labeled not applicable, earns zero, and retains its 4-point allocation under the requested fixed-total policy.
- If Google returns no website URI, the website category immediately shows **0/20**. The user can confirm that no website exists to clarify the evidence and mark dependencies unavailable. Without confirmation, the reason remains unknown; the zero points are unchanged.
- A confirmed absent website also makes website-based enquiry paths unavailable; their applicable criteria earn zero. Social discovery remains unassessed, because social accounts may exist without a website.
- When a listed site is blocked, times out, is unsafe, or cannot be inspected reliably, unverified downstream criteria earn zero. Verified positive signals can still earn their points; incomplete discovery does not prove missing features.
- Booking relevance is inferred only for the limited machine-readable Google `primaryType` lists in policy. Other types remain unknown. The report provides relevant / not relevant / uncertain / heuristic options. Both uncertain and not-applicable booking checks earn zero without changing the 15-point enquiry maximum. Manual overrides remain documented in evidence.
- Manual decisions are stored only in the current report’s memory, labeled as manual statements with a timestamp, and can be reversed. They are not Google verification. Recalculation makes no new API calls.

Every report states that Biltech’s score is an independent assessment, not a Google ranking or SEO algorithm metric.

## Website inspection and security

Only the Places-returned website URI is inspected; there is no arbitrary URL-fetch endpoint. The server inspects the homepage and robots.txt, does not execute JavaScript, and does not follow discovered social, contact, or booking links. No enquiry, reservation, or test booking is submitted.

- HTTP/HTTPS only, default ports only, no credentials in URLs, no private/internal/reserved network destinations.
- DNS results must all be public unicast addresses; the chosen IP is pinned to the request to prevent rebinding. HTTPS certificate verification remains enabled.
- Every redirect destination is validated before a request. Homepage redirects are limited to three, with loop detection; robots redirects have a separate bound. Total inspection limit: ten requests and ten seconds.
- Maximum homepage response: 1 MiB. Maximum robots response: 512 KiB. Bodies are bounded while streaming. Unsupported compression or content types leave dependent checks unassessed.
- Robots rules are checked per destination origin, including after redirects. Disallowed pages and unreachable server-side robots policies stop inspection.
- HTTP 401/403/429 and challenge pages are classified as blocked, not as proof of a customer-facing outage or missing features. Other observed non-success HTTP statuses assess accessibility only; content checks stay unknown.
- Known Google and social platform destinations are not crawled. Google Maps URLs are resolved separately through the existing allowlisted short-link resolver and are never scraped.
- Server errors are sanitized. No business records, raw HTML, request bodies, or credentials are logged or persisted. API responses use `Cache-Control: no-store`.

HTML parsing uses the small `htmlparser2` dependency. Visible homepage anchors and supported business/organization JSON-LD `sameAs` statements can supply social profiles. Matching uses exact platform hosts and profile paths; share URLs, posts, common navigation paths, and spoofed domains are excluded. Website-linked accounts are candidates, not proof of account ownership or linkage to Google Business Profile.

Contact discovery recognizes labeled call/contact links, WhatsApp, Messenger/Telegram, mailto links, enquiry forms with email/message/submit fields, and booking/appointment links. A Google phone number does not earn enquiry points. Discovery is an HTML heuristic, not an accessibility certification or a successful enquiry test. JS-only widgets, custom button handlers, linked contact pages, CSS visibility rules, non-UTF8 pages, and external form behavior may require manual review.

## Google API and Maps URL behavior

Endpoints:

- `GET /api/config`: key availability and public scoring configuration, never the key.
- `GET /api/demo`: fictional four-category report.
- `POST /api/analyze` with `{ "url": "https://..." }`: resolve/parse Maps URL. Explicit Place IDs fetch details; name searches return candidates for confirmation, even when only one result exists.
- `POST /api/select` with `{ "placeId": "...", "selectionToken": "..." }`: confirm a signed, client-bound candidate, fetch details, inspect its website, and score. Tokens expire in five minutes.

The existing Maps host allowlist is retained in `server/maps-url.ts`. Short links have safe manual redirect handling, pinned public DNS, timeouts, and loop/hop limits. Long URLs are parsed without fetching Maps HTML. Explicit `query_place_id`, `place_id`, `q=place_id:...`, and recognizable embedded `ChI...` IDs are supported. Search text such as `!1sRestaurants` and hexadecimal CIDs are never treated as Place IDs. Unknown embedded forms fall back to a business-name search. CID/coordinate-only URLs require a name-bearing link or explicit Place ID.

Details field mask:

```text
id,displayName,primaryType,primaryTypeDisplayName,formattedAddress,pureServiceAreaBusiness,businessStatus,nationalPhoneNumber,websiteUri,regularOpeningHours,rating,userRatingCount,photos,googleMapsUri,attributions
```

Search field mask:

```text
places.id,places.displayName,places.formattedAddress,places.primaryTypeDisplayName,places.pureServiceAreaBusiness,places.googleMapsUri,places.attributions
```

No wildcard, full reviews, or photo-image download is requested. Contact/rating/hours fields can trigger higher-tier Google billing; field masks do not make them free.

## Report and print

The existing Biltech layout now displays **Biltech Digital Presence Audit Report**, overall score/coverage, four category bars, grouped criterion checks, detected website/social URLs, customer enquiry channels, manual applicability controls, Top 3 Improvement Opportunities, timestamps, and evidence limitations.

Recommendations come only from assessed weak checks. Ranking combines configurable business impact, severity, rule confidence, and recoverable points. Rule confidence is a heuristic weight, not an empirically calibrated probability. Dependent no-website failures remain in the complete checklist, while Top 3 avoids repeating their root cause. No guaranteed rankings, leads, or revenue are claimed.

**Save as PDF generates and downloads a `.pdf` directly. It does not call `window.print()`, open a print dialog, or depend on expanded DOM checklist details.** The PDF module is loaded only on click, runs entirely in the browser, and makes no external/API requests. The button shows a saving state, prevents duplicate clicks during generation, and reports errors.

`src/pdf/report-pdf.ts` generates a branded A4 document with a score/coverage summary, all four category bars, Top 3 opportunities, website/social/contact findings, every criterion and its guidance, timestamps, evidence limits, and numbered page headers/footers. It measures complete check blocks before page breaks. Manual review values from the current report are included.

The existing export exclusion of raw Google business details and API evidence remains; sample PDFs contain clearly fictional data. The screen retains Google attribution and returned place-provider attributions. No actual photos are downloaded or displayed. Ordinary text is vector-based; non-Latin lines use high-resolution browser font rendering so Unicode evidence does not become broken glyphs. Filenames use the date and sample label or Place ID, not raw Google business names.

Google’s terms restrict deriving, exporting, and caching Maps content. No storage and attribution alone do not establish permission for every commercial audit/PDF use. Confirm the intended use under the agreement applicable to your billing region before a separately approved public release. Privacy/terms notices remain available in the footer.

## Structure and modified files

```text
shared/policy.ts                 NEW: centralized criteria, targets and heuristics
shared/normalize.ts              NEW: normalized website and applicability evidence
shared/scoring.ts                UPDATED: fixed 100-point engine and evidence coverage
shared/recommendations.ts        NEW: rule-based ranking and recommendation output
shared/review.ts                 NEW: reversible in-memory manual confirmation
shared/types.ts                  UPDATED: evidence, statuses, website and report types
server/audit.ts                  NEW: Places/website/report orchestration
server/website/transport.ts      NEW: bounded public network transport and SSRF checks
server/website/inspect.ts        NEW: robots, redirects and website failure handling
server/website/html.ts           NEW: static HTML/JSON-LD parsing
server/website/social.ts         NEW: relevant profile URL matching
server/website/contacts.ts       NEW: enquiry channel discovery
server/app.ts                   UPDATED: existing routes generate unified reports
server/places.ts                UPDATED: explicit primaryType field for applicability
server/demo.ts                  UPDATED: clearly fictional multi-source demo
src/components/Report.tsx       UPDATED: unified report using existing design/print flow
src/pdf/report-pdf.ts           NEW: direct-download PDF generation and pagination
src/App.tsx                     UPDATED: report review and scoped product wording
src/styles.css                  UPDATED: added sections, responsive and print rules
index.html                      UPDATED: digital presence title/description
package.json, pnpm-lock.yaml    UPDATED: htmlparser2 and lazily loaded jsPDF
tests/fixtures.ts               NEW: complete profile/website fixtures
tests/scoring.test.ts           UPDATED: version 2 scoring scenarios
tests/website.test.ts           NEW: website/link/robots/safety/failure tests
tests/report.test.ts            NEW: four-category printable report contract
tests/pdf.test.ts               NEW: PDF bytes, pagination, filenames, no print dependency
tests/api.test.ts               UPDATED: unified endpoint responses
README.md, VERIFICATION.md      UPDATED: current handoff and test results
```

Existing configuration, Maps resolution, signed selection, rate limits, and server-only secrets are retained. See `VERIFICATION.md` for test/build evidence and the remaining manual PDF/device verification limits.

Primary references:

- [Google field masks and omission behavior](https://developers.google.com/maps/documentation/places/web-service/choose-fields)
- [Place fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Places attribution and storage policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Google Maps Platform terms](https://cloud.google.com/maps-platform/terms)
- [Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)
- [htmlparser2](https://github.com/fb55/htmlparser2)
