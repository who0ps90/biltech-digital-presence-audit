import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

function integer(name: string, fallback: number, min: number, max: number) {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name} configuration.`);
  return value;
}
export const config = {
  port: integer('PORT', 3000, 1, 65535),
  host: process.env.HOST || '127.0.0.1',
  origin: process.env.APP_ORIGIN || 'http://localhost:3000',
  apiKey: process.env.GOOGLE_PLACES_API_KEY || '',
  apiTimeout: integer('API_TIMEOUT_MS', 8000, 1000, 15000),
  redirectTimeout: integer('REDIRECT_TIMEOUT_MS', 5000, 1000, 8000),
  maxRedirects: integer('MAX_REDIRECTS', 4, 0, 5),
  rateLimit: integer('RATE_LIMIT_PER_15_MIN', 30, 1, 1000),
  dailyCap: integer('DAILY_GOOGLE_REQUEST_CAP', 100, 0, 100000),
};
