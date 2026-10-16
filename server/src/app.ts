import express from 'express';
import type { Database } from './db/pool.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { requestLogger } from './logger.js';
import { createHealthRouter } from './routes/health.js';

/**
 * Builds the express application without listening, so the same wiring is used
 * by the server in index.ts and by anything that drives the app in process.
 *
 * Order matters: logging first so nothing escapes it, body parsing before the
 * routes so handlers see parsed input, then the routes, then the two handlers
 * that answer everything that did not match.
 */
export function createApp(database: Database) {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestLogger());
  app.use(express.json());
  app.use('/api', createHealthRouter(database));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
