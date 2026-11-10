import express from 'express';
import type { Database } from './db/pool.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { requestLogger } from './logger.js';
import { createAreasRouter } from './routes/areas.js';
import { createCareLogsRouter } from './routes/careLogs.js';
import { createGuidesRouter } from './routes/guides.js';
import { createHealthRouter } from './routes/health.js';
import { createHarvestsRouter } from './routes/harvests.js';
import { createIssuesRouter } from './routes/issues.js';
import { createMilestonesRouter } from './routes/milestones.js';
import { createPlantingsRouter } from './routes/plantings.js';
import { createSeedSavesRouter } from './routes/seedSaves.js';
import { createSpeciesRouter } from './routes/species.js';
import { createStatsRouter } from './routes/stats.js';

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
  app.use('/api', createSpeciesRouter(database));
  app.use('/api', createAreasRouter(database));
  app.use('/api', createPlantingsRouter(database));
  app.use('/api', createMilestonesRouter(database));
  app.use('/api', createCareLogsRouter(database));
  app.use('/api', createGuidesRouter(database));
  app.use('/api', createIssuesRouter(database));
  app.use('/api', createHarvestsRouter(database));
  app.use('/api', createSeedSavesRouter(database));
  app.use('/api', createStatsRouter(database));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
