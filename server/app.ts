import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { AppError } from './errors.js';
import { extractIdentity, isPlaceId, resolveMapsUrl } from './maps-url.js';
import { getPlace, searchPlaces } from './places.js';
import { selectionToken, verifySelection } from './selection.js';
import { demoReport } from './demo.js';
import { SCORING_POLICY } from '../shared/scoring.js';
import { buildReport } from './audit.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { 'script-src': ["'self'", ...(process.env.NODE_ENV !== 'production' ? ["'unsafe-inline'"] : [])], 'connect-src': ["'self'", ...(process.env.NODE_ENV !== 'production' ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : [])], 'img-src': ["'self'", 'data:'], 'upgrade-insecure-requests': null } }, strictTransportSecurity: config.origin.startsWith('https:') ? undefined : false }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store, max-age=0'); next(); });
  // No proxy trust by default: forwarded client IP headers cannot bypass rate limits.
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: config.rateLimit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Please try again in 15 minutes.' } }));
  app.use(express.json({ limit: '8kb', strict: true }));
  app.use('/api', (req, _res, next) => {
    if (req.method === 'POST' && req.get('origin') && req.get('origin') !== config.origin) return next(new AppError(403, 'This request origin is not allowed.'));
    if (req.method === 'POST' && !req.is('application/json')) return next(new AppError(415, 'Send a JSON request.'));
    next();
  });
  app.get('/api/config', (_req, res) => res.json({ liveAvailable: Boolean(config.apiKey), policy: SCORING_POLICY }));
  app.get('/api/demo', (_req, res) => res.json(demoReport()));
  app.post('/api/analyze', async (req, res) => {
    const url = await resolveMapsUrl(req.body?.url, { maxRedirects: config.maxRedirects, timeout: config.redirectTimeout });
    const identity = extractIdentity(url);
    if (identity.placeId) return res.json(await buildReport(await getPlace(identity.placeId)));
    const candidates = await searchPlaces(identity);
    // Every textual lookup requires the user's explicit selection, including one result.
    res.json({ kind: 'matches', candidates, selectionToken: selectionToken(candidates.map(p => p.id), req.ip || ''), expiresInSeconds: 300 });
  });
  app.post('/api/select', async (req, res) => {
    const id = req.body?.placeId;
    if (typeof id !== 'string' || !isPlaceId(id)) throw new AppError(400, 'Choose a valid business from the search results.');
    verifySelection(req.body?.selectionToken, id, req.ip || '');
    res.json(await buildReport(await getPlace(id)));
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof AppError) return res.status(error.status).json({ error: error.message, code: error.code });
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'The request contains invalid JSON.' });
    if ((error as { type?: string })?.type === 'entity.too.large') return res.status(413).json({ error: 'This request is too large.' });
    res.status(500).json({ error: 'The audit could not be completed. Please try again.' });
  });
  return app;
}
