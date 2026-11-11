# Verification results

Verified on 22 October 2026 (Asia/Kuala_Lumpur).

## Direct Save as PDF download

This section supersedes earlier browser-print and unverified-PDF notes below.

- Save as PDF now dynamically loads a client-side jsPDF module and downloads the generated PDF. The application no longer calls `window.print()` or installs before/after-print handlers.
- Loading, duplicate-click prevention, and error states are implemented. Generation uses the current report, including manual reviews, without uploading data or making API calls.
- Updated suite: **62 tests passed**. PDF checks cover a real PDF header, multiple pages, long-evidence pagination, safe filenames, and absence of a print call from the component. Existing scoring/API/security tests remain included.
- Actual sample and live-fixture PDFs were generated with the same export function, rendered with Poppler, and visually inspected. The fictional sample has seven pages; the live fixture has six. All four categories and complete checklists are present. Text extraction and page-coordinate checks confirm content remains within margins.
- The live fixture used explicit sentinel business-name and source-evidence values; neither appeared in extracted PDF text. This verifies preservation of the existing raw-Google-data export exclusion.
- Pagination was corrected after the first render to keep criterion blocks together, retain category headings with their first check, and keep the method/limitations section together. Final rendered checks, headers, and footers were inspected.
- QA files are intermediate fixtures under ignored `tmp/pdfs/`; they contain no API credentials or live business records. Non-Latin lines use the browser's canvas font fallback; ordinary Latin PDF text stays searchable.
- Native browser download behavior was not exercised through blocked browser automation. The underlying PDF generator and output files were verified directly; the user can refresh the preview and click Save as PDF.

## Version 2.1 — Fixed 100-point scoring

This section supersedes the denominator/coverage rules in all earlier records below.

- **59 tests passed, 0 failed, 0 skipped**. Strict TypeScript passed.
- Every criterion returns numeric earned points. Missing, inaccessible, unassessed, and not-applicable criteria earn **0**. Their maximum weights are retained without exclusion or redistribution.
- Overall maximum is always **100**, with category maxima **60/20/5/15**. The engine rejects criterion configurations that do not total 100, or contain invalid maxima.
- Coverage is separate evidence metadata and cannot inflate, rescale, or hide the numeric score. An entirely unknown report now shows **0/100**; a lone verified 3-point business name yields **3/100**, not 100%.
- A listed but uninspectable website fixture yields **66/100** overall rather than a normalized 100. A blocked HTTP 403 fixture with verified TLS yields **69/100**; unverified content-dependent criteria show zero.
- Not-applicable booking and service-area criteria retain their evidence labels and zero-point allocations. They no longer reduce the total denominator under this policy.
- New printable-report regression confirms **0/100**, numeric zero checks, and **0/60**, **0/20**, **0/5**, **0/15** category totals, with no obsolete exclusion or score-withholding text.
- Unknown checks still do not create invented evidence or assert a field is absent. Recommendations remain based on actual weak findings; unknown checks retain manual verification guidance.

The production build and local preview are updated for policy version 2.1. The server remains local; no public deployment was performed.

## Version 2 — Unified Digital Presence upgrade

This section supersedes the version 1 results below.

- Final test suite: **56 passed, 0 failed, 0 skipped** (`tsx --test tests/*.test.ts`). Tests use local HTTP and HTML fixtures and make no paid Google calls.
- Strict TypeScript: **PASS**.
- Production client/server build: **PASS**. Vite transformed 1,585 modules. Client JS 273.51 kB / 85.68 kB gzip; CSS 36.14 kB / 8.74 kB gzip; server bundle 54.1 kB.
- Production `/api/demo` returned HTTP 200, policy version 2.0, 19 checks, and category maxima **60/20/5/15**. The fictional sample scores **79/100**, with **100% coverage**.
- Real public website transport smoke test: `https://example.com/` returned HTTP 200 with verified HTTPS, reliable HTML, and a non-empty title. This checked DNS pinning, TLS, robots handling, and parsing without using Google credentials.
- Existing configured Google key and live Places functionality are retained. No additional paid Google smoke calls were made during this upgrade.
- The report retains the existing design and print flow. Automated React-to-HTML verification confirms all four category headings live in printable containers and that the report includes website/social/contact sections and evidence. Checklist print expansion/styles are preserved.

### Requested scenario coverage

| Scenario | Verification |
| --- | --- |
| Complete profile + website | 100/100, 100% coverage; four exact category maxima |
| Confirmed no website | Website 0/20; dependent checks unavailable; social discovery unassessed |
| Listed but inaccessible site | Website listing retained; unverified downstream criteria excluded |
| HTTP 403 | Blocked; downstream unknown rather than false failures |
| HTTP without HTTPS | Only the observed HTTPS criterion loses its configured points |
| Missing meta description | Two-point criterion earns zero with reliable HTML evidence |
| One social profile | Three points |
| Multiple social profiles | Five total points |
| No discovered social links | Zero on a reliable homepage; account absence is not claimed |
| WhatsApp | Recognized direct link and messaging points |
| Email / enquiry form | Mailto and appropriate enquiry-form fixtures; newsletter excluded |
| Appointment-based without booking | Booking criterion earns zero |
| Retail, booking not relevant | Five-point criterion excluded; manual override tested |
| Zero reviews | Explicit zero assessed; unavailable rating excluded |
| Missing Places fields | Unknown criteria; Insufficient Data, no numeric score |
| Partial failures | Valid Google data survives website failure; JS-shell missing signals stay unknown |
| Service-area hidden address | Four-point criterion excluded, no penalty or lost coverage |
| Score and coverage | Exact 40%/70% gates, bounds, category/overall totals and configurable targets |
| PDF four-category content | Printable React markup and print CSS contract verified; native PDF save still manual |

Additional checks retain prior Maps URL security, selection tokens, origin validation, body limits, API error sanitization, rate limiting, and usage accounting. New website tests cover robots exclusions, redirect destination validation, cross-origin robots checks, protected hosts, timeouts, challenge pages, non-HTML responses, social-sharing exclusion, spoofed domains, and avoiding social/contact/booking link requests.

### Remaining limits

- A newly rendered desktop/mobile screenshot and actual saved PDF were not obtained during this upgrade. Browser automation had previously been blocked by its URL security policy; no alternate browser surface was used to bypass it. The final verification therefore uses API, HTML, CSS, unit/integration, and real website-transport evidence. Save a report in a regular Chrome/Edge print dialog for final PDF pagination inspection.
- The scanner inspects only bounded static homepage HTML. It does not execute JavaScript, inspect linked contact pages, establish ownership/activity of social accounts, test delivery, submit forms, or reserve appointments. Business-type applicability and confidence values are documented heuristics, with manual overrides.
- Omitted Google website data is unknown until the user confirms absence. This avoids claiming a business lacks a website solely because Google omitted a field.
- Raw Google details remain excluded from live printouts; Google policy review remains necessary before public distribution.
- No database, login, CRM, AI service, or public deployment was added. The final local preview is left running for the user.

## Follow-up verification

- After server credentials were configured, a minimal real Places Text Search request returned HTTP 200. The diagnostic prints status/reason classification only, never credentials or raw Google responses (`scripts/check-google-access.ts`).
- The user supplied a screenshot of a live Sura Sang audit showing 94/100 and 85% coverage. This establishes the real-data path worked for that report; it is not an independently repeated audit or a claim about future availability.
- Fixed long Maps URLs containing earlier search-context tokens such as `!1sRestaurants`: these previously passed the broad identifier syntax check. Search-context text and hex CIDs now fall back to the business-name search; recognizable later embedded IDs are considered, with conflict rejection preserved.
- Added regressions using the supplied URL shape, multiple embedded tokens, unknown embedded IDs, and place-name priority. Updated the HTTP fixture integration to use a long URL with search context.
- Google HTTP 400 responses now provide a sanitized identifier/request-parameter correction instead of suggesting an API-key problem.
- Updated suite: **33 tests passed, 0 failed**. Strict TypeScript passed; the production server was rebuilt and restarted. The preview is intentionally left running for the user.

The initial results and limitations below are retained as the original implementation record; the follow-up above supersedes its credential/server-state notes.

## Automated checks

| Check | Result |
| --- | --- |
| Strict TypeScript (`tsc --noEmit`) | PASS |
| Vite production client build | PASS, 1,581 modules transformed |
| esbuild production server bundle | PASS |
| Node/tsx test suite | **30 passed, 0 failed, 0 skipped** |
| Production Node server | Started successfully on loopback port 3000 |
| Real short-link transport smoke check | An intentionally invalid `maps.app.goo.gl` URL returned HTTP 404; DNS validation, pinned IP lookup, and TLS request completed without API credentials |

Final client assets: JavaScript 252.73 kB (79.15 kB gzip), CSS 32.41 kB (8.08 kB gzip). Server bundle: 22.8 kB. These are build outputs, not performance benchmark scores.

The test suite covers:

- Place ID parameters and embedded identifiers, CID/hex distinction, name-based search extraction, conflicting IDs, malformed encoding, coordinate-only rejection.
- Hostname/scheme/port/credential validation, public/private/reserved IP classification, validated redirect destinations, loops, hop limits, and avoiding final Maps-page fetches.
- Category weights, proportional bounded rating/review awards, configurable targets, zero versus omitted counts, empty field samples, score normalization, assessment coverage, closed statuses, and service-area address exemption.
- Expiring client-bound candidate tokens, forged/out-of-search selections, daily budget accounting and UTC rollover, explicit masks without full reviews.
- HTTP demo labeling, no-store responses, input/origin/body-size rejection, missing-key responses, uncertain-match confirmation even for a single result, selected Place Details, sanitized upstream failures/timeouts, and rate limiting.

HTTP integration tests use a local server and fixture Google responses. The fixture search → confirmation → details → score path passed. These tests do not make paid Google Places calls.

## Browser checks

The production build was opened in the Codex in-app browser at http://localhost:3000.

- Desktop interface rendered with the fictional sample report, score **87/100**, **85% coverage**, and ten checks.
- Measured viewport width and document width were both **1,328 px**: no horizontal overflow at the checked desktop size.
- No browser console warnings or errors were captured after the final reload.
- CID-only input showed an actionable message requesting a name-bearing place link or Place ID.
- An explicit Place ID without credentials returned the live-configuration error, with no automatic sample-data substitution.
- “Explore a sample report” restored the clearly labeled sample report.
- Help dialog opened and closed; the unknown website check expanded to show its evidence and manual action.
- Final desktop screenshot: `artifacts/desktop-preview.png`.

## Verification limits and operational notes

- No Google API key was supplied. Real billable Text Search/Place Details responses remain to be smoke-tested after key restrictions, billing, and quotas are configured.
- Responsive layouts are implemented for desktop, tablet, and mobile breakpoints. This browser surface did not expose viewport emulation, so mobile layouts were reviewed in source rather than visually validated on a device.
- Print styles and before/after-print checklist expansion are implemented. The in-app browser did not expose a usable native print preview through automation; saving and inspecting an actual PDF remains a manual check in Chrome/Edge. Live printouts omit raw Google business data and source evidence, as documented in README.
- The daily app cap is process-local and resets after a restart. Google Cloud method quotas must be configured for durable spend enforcement.
- Google Maps terms restrict deriving and exporting content. Confirm the intended commercial score/PDF use with Google before public release; attribution and no caching alone do not grant that permission.
- No public deployment, database, account system, or paid AI integration was created. The local verification server is stopped at handoff; run `pnpm dev` or `pnpm start` to use the application.

Initial sandbox runs could not connect to local test HTTP ports. Rerunning with permitted loopback access passed; this was an environment restriction, not an application test failure.
