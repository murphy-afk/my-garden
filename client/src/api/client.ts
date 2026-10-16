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
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = 'unknown_error';
  let message = `Request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as ApiErrorBody;

    if (body.error !== undefined && typeof body.error === 'object') {
      if (typeof body.error.code === 'string') {
        code = body.error.code;
      }
      if (typeof body.error.message === 'string') {
        message = body.error.message;
      }
    }
  } catch {
    // The response was not JSON, so the defaults above stand.
  }

  return new ApiError(message, response.status, code);
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
  post: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
};
