import type { ErrorRequestHandler, RequestHandler } from 'express';
import { describeError, logger } from './logger.js';

export type ErrorDetails = Record<string, unknown>;

/**
 * Thrown by a route to reply with a chosen status, machine readable code and
 * human message. The error handler turns it into the standard response body.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Optional structured context for the client. Never a place for secrets. */
  readonly details: ErrorDetails | undefined;

  constructor(status: number, code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Sends unmatched routes through the same error path as everything else. */
export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new ApiError(404, 'not_found', `No route matches ${request.method} ${request.originalUrl}.`));
};

/** Shape body-parser and similar middleware give to a rejected request. */
type ClientErrorShape = {
  status?: number;
  statusCode?: number;
  type?: string;
};

type NormalizedError = {
  status: number;
  code: string;
  message: string;
  details: ErrorDetails | undefined;
};

/**
 * Recognises errors that describe the caller's own mistake, such as a body
 * that is not valid JSON or a payload over the size limit. Those are reported
 * back as they came in, because the client can act on them.
 */
function readClientError(error: unknown): NormalizedError | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const candidate = error as ClientErrorShape;
  const status = typeof candidate.status === 'number' ? candidate.status : candidate.statusCode;

  if (typeof status !== 'number' || status < 400 || status > 499) {
    return undefined;
  }

  if (candidate.type === 'entity.parse.failed') {
    return { status: 400, code: 'invalid_json', message: 'The request body is not valid JSON.', details: undefined };
  }

  const message =
    error instanceof Error && error.message.length > 0 ? error.message : 'The request could not be processed.';

  return { status, code: candidate.type ?? 'bad_request', message, details: undefined };
}

/**
 * Anything without a 4xx status is a fault on this side. The original message
 * is kept out of the response so stack traces and SQL never reach a client.
 */
function normalize(error: unknown): NormalizedError {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  const clientError = readClientError(error);

  if (clientError !== undefined) {
    return clientError;
  }

  return { status: 500, code: 'internal_error', message: 'Something went wrong on the server.', details: undefined };
}

/**
 * The single place a response body goes wrong. Every error, thrown or passed
 * with next, is logged with its cause and answered in the shape the front end
 * expects: { error: { code, message, details? } }.
 */
export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (response.headersSent) {
    // Too late to build a response, so the framework takes it from here.
    next(error);
    return;
  }

  const normalized = normalize(error);
  const context = {
    method: request.method,
    url: request.originalUrl,
    status: normalized.status,
    code: normalized.code,
  };

  if (normalized.status >= 500) {
    // An ApiError is a deliberate answer, so its message is enough. Anything
    // else is a fault, and its stack is the useful part.
    const cause = error instanceof ApiError ? { errorMessage: error.message } : describeError(error);
    logger.error('request failed', { ...context, ...cause });
  } else {
    logger.warn('request rejected', context);
  }

  response.status(normalized.status).json({
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details !== undefined ? { details: normalized.details } : {}),
    },
  });
};
