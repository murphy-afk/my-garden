import type { RequestHandler } from 'express';
import type { LogLevel } from './config.js';

const severity: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let threshold = severity.info;

/** Applied once at startup from LOG_LEVEL. Messages below it are dropped. */
export function setLogLevel(level: LogLevel): void {
  threshold = severity[level];
}

export type LogFields = Record<string, unknown>;

/**
 * One JSON object per line on stdout, so the log stays machine readable and
 * keeps its order. Levels use stdout rather than a mix of streams for the same
 * reason.
 */
function write(level: LogLevel, message: string, fields: LogFields): void {
  if (severity[level] < threshold) {
    return;
  }

  console.log(JSON.stringify({ time: new Date().toISOString(), level, message, ...fields }));
}

export const logger = {
  debug: (message: string, fields: LogFields = {}) => write('debug', message, fields),
  info: (message: string, fields: LogFields = {}) => write('info', message, fields),
  warn: (message: string, fields: LogFields = {}) => write('warn', message, fields),
  error: (message: string, fields: LogFields = {}) => write('error', message, fields),
};

/** Turns any thrown value into fields that JSON.stringify can handle. */
export function describeError(error: unknown): LogFields {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, stack: error.stack };
  }

  return { errorMessage: String(error) };
}

/**
 * Logs one line per completed request: method, url, status and duration.
 * The line is written when the response finishes, so it always carries the
 * final status, including responses produced by the error handler.
 */
export function requestLogger(): RequestHandler {
  return (request, response, next) => {
    const startedAt = performance.now();

    response.on('finish', () => {
      logger.info('request', {
        method: request.method,
        url: request.originalUrl,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      });
    });

    next();
  };
}
