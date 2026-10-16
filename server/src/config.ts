import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';
import { readDatabaseConfig, type DatabaseConfig } from './db/config.js';

export const logLevels = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof logLevels)[number];

export type AppConfig = {
  port: number;
  logLevel: LogLevel;
  database: DatabaseConfig;
};

const defaultPort = 3001;
const defaultLogLevel: LogLevel = 'info';

/**
 * Reads server/.env by a path relative to this file rather than to the working
 * directory, so the API starts the same way from the repository root, from
 * server/, or from the compiled bundle in server/dist.
 *
 * Values already present in the environment win over the file, so a real
 * deployment never needs a .env at all.
 */
function loadEnvironmentFile(): void {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  loadEnvFile({ path: path.join(directory, '..', '.env'), quiet: true });
}

function readPort(): number {
  const raw = process.env['PORT'];

  if (raw === undefined || raw.length === 0) {
    return defaultPort;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a whole number between 1 and 65535, got "${raw}".`);
  }

  return port;
}

function readLogLevel(): LogLevel {
  const raw = process.env['LOG_LEVEL'];

  if (raw === undefined || raw.length === 0) {
    return defaultLogLevel;
  }

  if (!logLevels.includes(raw as LogLevel)) {
    throw new Error(`LOG_LEVEL must be one of ${logLevels.join(', ')}, got "${raw}".`);
  }

  return raw as LogLevel;
}

/** Reads and validates every environment variable the API needs. */
export function readAppConfig(): AppConfig {
  loadEnvironmentFile();

  return {
    port: readPort(),
    logLevel: readLogLevel(),
    database: readDatabaseConfig(),
  };
}
