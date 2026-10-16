import express from 'express';
import { ApiError } from '../errors.js';
import type { Database } from '../db/pool.js';

/** How long a database check may take before it counts as unreachable. */
const checkTimeoutMs = 2000;

type DatabaseOk = { connected: true; latencyMs: number };
type DatabaseDown = { connected: false; reason: string };

function withTimeout(operation: Promise<number>, milliseconds: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No answer after ${milliseconds} ms.`)), milliseconds);

    operation.then(
      (latencyMs) => {
        clearTimeout(timer);
        resolve(latencyMs);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function checkDatabase(database: Database): Promise<DatabaseOk | DatabaseDown> {
  try {
    const latencyMs = await withTimeout(database.ping(), checkTimeoutMs);
    return { connected: true, latencyMs };
  } catch (error) {
    return { connected: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * GET /api/health
 *
 * Answers whether the API is up and whether it can reach MySQL. A healthy
 * check reports the measured latency; an unreachable database answers 503 in
 * the standard error shape, with the database status inside `error.details`,
 * so the caller learns the reason either way.
 */
export function createHealthRouter(database: Database) {
  const router = express.Router();

  router.get('/health', async (_request, response, next) => {
    const result = await checkDatabase(database);

    if (!result.connected) {
      next(new ApiError(503, 'database_unavailable', 'The database is not reachable.', { database: result }));
      return;
    }

    response.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), database: result });
  });

  return router;
}
