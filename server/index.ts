import { resolve } from 'node:path';
import express from 'express';
import { createApp } from './app.js';
import { config } from './config.js';

if (process.argv[1]?.includes('dist-server')) process.env.NODE_ENV = 'production';
const app = createApp();
if (process.env.NODE_ENV === 'production' || process.argv[1]?.includes('dist-server')) {
  app.use(express.static(resolve('dist'), { index: false }));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const server = app.listen(config.port, config.host, () => console.log(`Biltech Profile Audit: http://localhost:${config.port}`));
server.requestTimeout = 30000;
server.headersTimeout = 10000;
