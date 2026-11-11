// One minimal Text Search request. Never prints keys, business records, or raw upstream errors.
import { config } from '../server/config.js';
import { DailyBudget } from '../server/places.js';

if (!config.apiKey) {
  console.log(JSON.stringify({ configured: false }));
  process.exitCode = 1;
} else {
  new DailyBudget(config.dailyCap).consume();
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(config.apiTimeout),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': config.apiKey, 'X-Goog-FieldMask': 'places.id' },
      body: JSON.stringify({ textQuery: 'Google Sydney', pageSize: 1 }),
    });
    const payload = await response.json();
    const reasons = (Array.isArray(payload.error?.details) ? payload.error.details : [])
      .map((detail: { reason?: unknown }) => detail.reason)
      .filter((reason: unknown): reason is string => typeof reason === 'string' && /^[A-Z_]{1,80}$/.test(reason));
    const status = typeof payload.error?.status === 'string' && /^[A-Z_]{1,80}$/.test(payload.error.status) ? payload.error.status : undefined;
    // These booleans aid classification without disclosing Google's message or metadata.
    const message = typeof payload.error?.message === 'string' ? payload.error.message : '';
    console.log(JSON.stringify({ configured: true, httpStatus: response.status, status, reasons, billingMentioned: /billing/i.test(message), apiDisabledMentioned: /has not been used|disabled|not enabled/i.test(message), restrictionMentioned: /blocked|restriction|referer|ip address/i.test(message), invalidKeyMentioned: /api key not valid|invalid api key/i.test(message) }));
  } catch {
    console.log(JSON.stringify({ configured: true, networkOrTimeoutError: true }));
    process.exitCode = 1;
  }
}
