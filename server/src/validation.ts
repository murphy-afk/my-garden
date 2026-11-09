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

type NumberRule = {
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

/**
 * The 400 every reader throws; `details.fields` names the field so a form can
 * show the message in place. Exported so a route can report a rule that spans
 * two fields, such as an end date that falls before the planting date.
 */
export function invalidField(field: string, message: string): ApiError {
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
    throw invalidField(field, `${labelOf(field, rule)} is required.`);
  }
  return value;
}

/** Reads an optional text field. Absent or blank means "not set" (null). */
export function optionalText(body: unknown, field: string, rule: TextRule = {}): string | null {
  const label = labelOf(field, rule);
  const raw = valueOf(body, field);

  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw invalidField(field, `${label} must be text.`);

  const value = raw.trim();
  if (value === '') return null;
  if (rule.maxLength !== undefined && value.length > rule.maxLength) {
    throw invalidField(field, `${label} must be at most ${rule.maxLength} characters.`);
  }
  return value;
}

/** Reads an optional whole number inside [min, max]. Absent means "not set" (null). */
export function optionalInteger(body: unknown, field: string, rule: IntegerRule = {}): number | null {
  const label = labelOf(field, rule);
  const raw = valueOf(body, field);

  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    throw invalidField(field, `${label} must be a whole number.`);
  }
  if (rule.min !== undefined && raw < rule.min) {
    throw invalidField(field, `${label} must be at least ${rule.min}.`);
  }
  if (rule.max !== undefined && raw > rule.max) {
    throw invalidField(field, `${label} must be no more than ${rule.max}.`);
  }
  return raw;
}

/** Reads a required whole number inside [min, max]. */
export function requireInteger(body: unknown, field: string, rule: IntegerRule = {}): number {
  const value = optionalInteger(body, field, rule);
  if (value === null) {
    throw invalidField(field, `${labelOf(field, rule)} is required.`);
  }
  return value;
}

/**
 * Reads an optional decimal number inside [min, max]. Absent means "not set"
 * (null). Amounts are stored as DECIMAL(8, 2), so the caller's range has to
 * stay inside 999999.99 or MySQL refuses the write.
 */
export function optionalNumber(body: unknown, field: string, rule: NumberRule = {}): number | null {
  const label = labelOf(field, rule);
  const raw = valueOf(body, field);

  if (raw === undefined || raw === null || raw === '') return null;
  // A JSON body can carry 1e400, which parses to Infinity rather than failing.
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw invalidField(field, `${label} must be a number.`);
  }
  if (rule.min !== undefined && raw < rule.min) {
    throw invalidField(field, `${label} must be at least ${rule.min}.`);
  }
  if (rule.max !== undefined && raw > rule.max) {
    throw invalidField(field, `${label} must be no more than ${rule.max}.`);
  }
  return raw;
}

/** Reads a required decimal number inside [min, max]. */
export function requireNumber(body: unknown, field: string, rule: NumberRule = {}): number {
  const value = optionalNumber(body, field, rule);
  if (value === null) {
    throw invalidField(field, `${labelOf(field, rule)} is required.`);
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
    throw invalidField(field, `${label} is required.`);
  }
  const match = typeof raw === 'string' ? allowed.find((option) => option === raw) : undefined;
  if (match === undefined) {
    throw invalidField(field, `${label} must be one of ${allowed.join(', ')}.`);
  }
  return match;
}

/** Reads a required true or false, the shape a checkbox is sent in. */
export function requireBoolean(body: unknown, field: string, rule: ChoiceRule = {}): boolean {
  const label = labelOf(field, rule);
  const raw = valueOf(body, field);

  if (raw === undefined || raw === null) {
    throw invalidField(field, `${label} is required.`);
  }
  if (typeof raw !== 'boolean') {
    throw invalidField(field, `${label} must be true or false.`);
  }
  return raw;
}

/** Reads a `:id` path parameter as a positive whole number. */
export function requireId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'invalid_id', 'The id must be a positive whole number.');
  }
  return id;
}

/**
 * Business dates travel as 'YYYY-MM-DD' text, the same form MySQL stores them
 * in, so a date never carries a time or a timezone offset.
 */
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Reads a required calendar date as 'YYYY-MM-DD'. */
export function requireDate(body: unknown, field: string, rule: ChoiceRule = {}): string {
  const value = optionalDate(body, field, rule);
  if (value === null) {
    throw invalidField(field, `${labelOf(field, rule)} is required.`);
  }
  return value;
}

/** Reads an optional calendar date. Absent or blank means "not set" (null). */
export function optionalDate(body: unknown, field: string, rule: ChoiceRule = {}): string | null {
  const label = labelOf(field, rule);
  const raw = valueOf(body, field);

  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') throw invalidField(field, `${label} must be a date.`);

  const value = raw.trim();
  const parts = datePattern.exec(value);
  if (parts === null) {
    throw invalidField(field, `${label} must be a date in the form YYYY-MM-DD.`);
  }

  // Round trip through a real calendar date, which rejects 2026-02-30 while
  // keeping 2026-02-28. Date.UTC anchors the check so daylight saving cannot
  // shift the result.
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isRealDay =
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  if (!isRealDay) {
    throw invalidField(field, `${label} must be a real calendar date.`);
  }

  return value;
}
