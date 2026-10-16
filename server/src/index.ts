import type { Server } from 'node:http';
import { createApp } from './app.js';
import { readAppConfig, type AppConfig } from './config.js';
import { createDatabase, type Database } from './db/pool.js';
import { describeError, logger, setLogLevel } from './logger.js';

async function shutdown(server: Server, database: Database, signal: string): Promise<void> {
  logger.info('shutting down', { signal });

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await database.close();
}

async function main(): Promise<void> {
  const config: AppConfig = readAppConfig();
  setLogLevel(config.logLevel);

  const database = createDatabase(config.database);
  const app = createApp(database);

  const server = app.listen(config.port, () => {
    logger.info('api listening', { port: config.port, logLevel: config.logLevel });
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      shutdown(server, database, signal).catch((error: unknown) => {
        logger.error('shutdown failed', { signal, ...describeError(error) });
        process.exitCode = 1;
      });
    });
  }
}

main().catch((error: unknown) => {
  logger.error('api failed to start', describeError(error));
  process.exitCode = 1;
});
