import { ApiError } from './errors.js';

/** Field name to message, the shape carried in `error.details.fields`. */
export type FieldErrors = Record<string, string>;

type TextRule = {
  /** Inclusive upper bound on the trimmed length. */
  maxLength?: number;
  /** Human name used in messages. Defaults to the field name. */
  label?: string;
};

type IntegerRule = {
  min?: number;
  max?: number;
  label?: string;
};

type ChoiceRule = {
  label?: string;
};

function labelOf(field: string, rule: { label?: string }): string {
  return rule.label ?? field;
}

/** The 400 every reader throws; `details.fields` names the field so a form can show the message in place. */
function invalid(field: string, message: string): ApiError {
  return new ApiError(400, 'validation_failed', message, { fields: { [field]: message } });
}

function valueOf(body: unknown, field: string): unknown {
  if (typeof body !== 'object' || body === null) return undefined;
  return (body as Record<string, unknown>)[field];
}

/**
 * Reads the request body as an object before any field is read from it.
 * A missing body reads as empty so required fields report themselves, while
 * a body that is not an object is rejected outright.
 */
export function readBody(body: unknown): Record<string, unknown> {
  if (body === undefined || body === null) return {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'invalid_body', 'The request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

/** Reads a required text field: non-empty after trimming, at most maxLength. */
export function requireText(body: unknown, field: string, rule: TextRule = {}): string {
  const value = optionalText(body, field, rule);
  if (value === null) {
    throw invalid(field, `${labelOf(field, rule)} is required.`);
  }
  return value;
}

/** Reads an optional text field. Absent or blank means "not set" (null). */
export function optionalText(body: unknown, field: string, rule: TextRule = {}): string | null {
  const label = labelOf(field, rule);
  const raw = valueOf(body, field);

  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw invalid(field, `${label} must be text.`);

  const value = raw.trim();
  if (value === '') return null;
  if (rule.maxLength !== undefined && value.length > rule.maxLength) {
    throw invalid(field, `${label} must be at most ${rule.maxLength} characters.`);
  }
  return value;
}

/** Reads an optional whole number inside [min, max]. Absent means "not set" (null). */
export function optionalInteger(body: unknown, field: string, rule: IntegerRule = {}): number | null {
  const label = labelOf(field, rule);
  const raw = valueOf(body, field);

  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    throw invalid(field, `${label} must be a whole number.`);
  }
  if (rule.min !== undefined && raw < rule.min) {
    throw invalid(field, `${label} must be at least ${rule.min}.`);
  }
  if (rule.max !== undefined && raw > rule.max) {
    throw invalid(field, `${label} must be no more than ${rule.max}.`);
  }
  return raw;
}

/** Reads a required whole number inside [min, max]. */
export function requireInteger(body: unknown, field: string, rule: IntegerRule = {}): number {
  const value = optionalInteger(body, field, rule);
  if (value === null) {
    throw invalid(field, `${labelOf(field, rule)} is required.`);
  }
  return value;
}

/** Reads a required member of a fixed vocabulary. */
export function requireChoice<T extends string>(
  body: unknown,
  field: string,
  allowed: readonly T[],
  rule: ChoiceRule = {},
): T {
  const label = labelOf(field, rule);
  const raw = valueOf(body, field);

  if (raw === undefined || raw === null || raw === '') {
    throw invalid(field, `${label} is required.`);
  }
  const match = typeof raw === 'string' ? allowed.find((option) => option === raw) : undefined;
  if (match === undefined) {
    throw invalid(field, `${label} must be one of ${allowed.join(', ')}.`);
  }
  return match;
}

/** Reads a `:id` path parameter as a positive whole number. */
export function requireId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'invalid_id', 'The id must be a positive whole number.');
  }
  return id;
}
