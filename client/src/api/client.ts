/**
 * The single way the front end talks to the API.
 *
 * Every call goes through `api`, so error handling, JSON parsing and the base
 * url live in one place. Do not call fetch directly from a component.
 */

const BASE_URL = '/api';

/** Body shape the API uses for every failure. */
type ApiErrorBody = {
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Structured context from the API, such as per-field validation messages. */
  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, status: number, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = 'unknown_error';
  let message = `Request failed with status ${response.status}`;
  let details: Record<string, unknown> | undefined;

  try {
    const body = (await response.json()) as ApiErrorBody;

    if (body.error !== undefined && typeof body.error === 'object') {
      if (typeof body.error.code === 'string') {
        code = body.error.code;
      }
      if (typeof body.error.message === 'string') {
        message = body.error.message;
      }
      if (
        body.error.details !== undefined &&
        typeof body.error.details === 'object' &&
        body.error.details !== null
      ) {
        details = body.error.details as Record<string, unknown>;
      }
    }
  } catch {
    // The response was not JSON, so the defaults above stand.
  }

  return new ApiError(message, response.status, code, details);
}

/**
 * The per-field messages a 400 carried, keyed by field name, so a form can
 * show each problem in place. Anything else (network failure, 500) has no
 * field to point at, so the caller falls back to `error.message`.
 */
export function readFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.details === undefined) return {};
  const fields = error.details['fields'];
  if (typeof fields !== 'object' || fields === null) return {};

  const messages: Record<string, string> = {};
  for (const [field, message] of Object.entries(fields as Record<string, unknown>)) {
    if (typeof message === 'string') messages[field] = message;
  }
  return messages;
}

/** The message to show a user when a request failed. */
export function messageFor(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
};
