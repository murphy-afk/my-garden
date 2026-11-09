/**
 * Care logs: the words the API speaks and the calls that use them.
 * The type mirrors server/src/routes/careLogs.ts, which is the contract.
 */

import { api } from './client';

export const careKinds = ['watered', 'pruned', 'tied', 'fed'] as const;
export type CareKind = (typeof careKinds)[number];

export type CareLog = {
  id: number;
  plantingId: number;
  kind: CareKind;
  /** 'YYYY-MM-DD'. */
  performedOn: string;
  /** Litres, handfuls or anything else the gardener counted. */
  amount: number | null;
  note: string | null;
};

/** The editable fields. The planting comes from the path, never the body. */
export type CareLogInput = {
  kind: CareKind;
  performedOn: string;
  amount: number | null;
  note: string | null;
};

/** The three questions the brief asks about a planting's care. */
export type CareSummary = {
  lastWatered: string | null;
  lastPruned: string | null;
  /** Whether this planting has ever been tied up. */
  tied: boolean;
};

/** Query keys for the care cache, grouped by the planting they hang from. */
export const careKeys = {
  all: ['care-logs'] as const,
  forPlanting: (plantingId: number) => ['care-logs', plantingId] as const,
};

const careLabels: Record<CareKind, string> = {
  watered: 'Watered',
  pruned: 'Pruned',
  tied: 'Tied',
  fed: 'Fed',
};

export function careLabel(kind: CareKind): string {
  return careLabels[kind];
}

/** Newest first, which is how a log is read: what happened most recently. */
export async function listCareLogs(plantingId: number): Promise<CareLog[]> {
  const body = await api.get<{ careLogs: CareLog[] }>(`/plantings/${plantingId}/care-logs`);
  return body.careLogs;
}

export async function createCareLog(plantingId: number, input: CareLogInput): Promise<CareLog> {
  const body = await api.post<{ careLog: CareLog }>(`/plantings/${plantingId}/care-logs`, input);
  return body.careLog;
}

export async function updateCareLog(id: number, input: CareLogInput): Promise<CareLog> {
  const body = await api.put<{ careLog: CareLog }>(`/care-logs/${id}`, input);
  return body.careLog;
}

/** Removes a care log for good, so a misfired quick add can be taken back. */
export async function deleteCareLog(id: number): Promise<void> {
  await api.delete(`/care-logs/${id}`);
}

/**
 * The summary line, read from the log the page already holds. Dates compare
 * as text because they are all 'YYYY-MM-DD', so the latest one wins without
 * parsing anything.
 */
export function summarizeCare(logs: CareLog[]): CareSummary {
  let lastWatered: string | null = null;
  let lastPruned: string | null = null;
  let tied = false;

  for (const log of logs) {
    if (log.kind === 'watered' && (lastWatered === null || log.performedOn > lastWatered)) {
      lastWatered = log.performedOn;
    }
    if (log.kind === 'pruned' && (lastPruned === null || log.performedOn > lastPruned)) {
      lastPruned = log.performedOn;
    }
    if (log.kind === 'tied') tied = true;
  }

  return { lastWatered, lastPruned, tied };
}
