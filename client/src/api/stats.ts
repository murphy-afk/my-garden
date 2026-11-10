/**
 * The statistics behind the dashboard: the words the API speaks and the calls
 * that use them. The types mirror server/src/routes/stats.ts, which is the
 * contract.
 *
 * Every call takes the same scope, so one set of filters drives every panel.
 */

import { api } from './client';
import type { IssueKind, IssueSeverity } from './issues';

export type StatsFilters = {
  from?: string | undefined;
  to?: string | undefined;
  speciesId?: number | undefined;
  areaId?: number | undefined;
};

/** Query keys for the statistics cache; every panel keys on the same scope. */
export const statsKeys = { all: ['stats'] as const };

/** Yield for one species in one unit, since kilograms and pieces do not add up. */
export type SpeciesYield = {
  species: { id: number; name: string; variety: string | null };
  unit: string;
  total: number;
  harvestCount: number;
};

/** Yield for one area in one unit. */
export type AreaYield = {
  area: { id: number; name: string };
  unit: string;
  total: number;
  harvestCount: number;
};

/** One month of harvests in one unit, where 'period' is 'YYYY-MM'. */
export type PeriodYield = {
  period: string;
  unit: string;
  total: number;
  harvestCount: number;
};

/** One average with the sample it was taken over, so one sample is not a trend. */
export type TimingStat = {
  averageDays: number | null;
  count: number;
};

export type Timing = {
  firstFlower: TimingStat;
  firstFruit: TimingStat;
};

export type CareFrequencyRow = {
  species: { id: number; name: string; variety: string | null };
  watered: number;
  pruned: number;
};

export type Survival = {
  total: number;
  active: number;
  ended: number;
  died: number;
};

export type IssueStatRow = {
  kind: IssueKind;
  severity: IssueSeverity;
  count: number;
};

function queryFor(filters: StatsFilters): string {
  const query = new URLSearchParams();
  if (filters.from !== undefined) query.set('from', filters.from);
  if (filters.to !== undefined) query.set('to', filters.to);
  if (filters.speciesId !== undefined) query.set('speciesId', String(filters.speciesId));
  if (filters.areaId !== undefined) query.set('areaId', String(filters.areaId));

  return query.toString() === '' ? '' : `?${query.toString()}`;
}

export async function yieldBySpecies(filters: StatsFilters): Promise<SpeciesYield[]> {
  const body = await api.get<{ rows: SpeciesYield[] }>(`/stats/yield-by-species${queryFor(filters)}`);
  return body.rows;
}

export async function yieldByArea(filters: StatsFilters): Promise<AreaYield[]> {
  const body = await api.get<{ rows: AreaYield[] }>(`/stats/yield-by-area${queryFor(filters)}`);
  return body.rows;
}

export async function harvestsOverTime(filters: StatsFilters): Promise<PeriodYield[]> {
  const body = await api.get<{ rows: PeriodYield[] }>(`/stats/harvests-over-time${queryFor(filters)}`);
  return body.rows;
}

export async function timing(filters: StatsFilters): Promise<Timing> {
  return api.get<Timing>(`/stats/timing${queryFor(filters)}`);
}

export async function careFrequency(filters: StatsFilters): Promise<CareFrequencyRow[]> {
  const body = await api.get<{ rows: CareFrequencyRow[] }>(`/stats/care-frequency${queryFor(filters)}`);
  return body.rows;
}

export async function survival(filters: StatsFilters): Promise<Survival> {
  return api.get<Survival>(`/stats/survival${queryFor(filters)}`);
}

export async function issueStats(filters: StatsFilters): Promise<IssueStatRow[]> {
  const body = await api.get<{ rows: IssueStatRow[] }>(`/stats/issues${queryFor(filters)}`);
  return body.rows;
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-07' becomes 'Jul 2026', which is how a month is read on an axis. */
export function periodLabel(period: string): string {
  const [year, month] = period.split('-');
  const index = Number(month) - 1;
  return `${monthNames[index] ?? month} ${year}`;
}

/** Every month between two periods, so a chart can show the empty ones too. */
export function monthRange(from: string, to: string): string[] {
  const start = from.split('-').map(Number);
  const end = to.split('-').map(Number);
  const startYear = start[0] ?? 0;
  const startMonth = start[1] ?? 1;
  const endYear = end[0] ?? 0;
  const endMonth = end[1] ?? 1;

  const periods: string[] = [];
  let year = startYear;
  let month = startMonth;

  // A ceiling keeps a bad range from building a chart the browser cannot draw.
  while ((year < endYear || (year === endYear && month <= endMonth)) && periods.length < 120) {
    periods.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return periods;
}
