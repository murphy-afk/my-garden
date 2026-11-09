/**
 * Issues: the words the API speaks and the calls that use them.
 * The type mirrors server/src/routes/issues.ts, which is the contract.
 */

import { api } from './client';

export const issueKinds = [
  'pest',
  'disease',
  'nutrient_deficiency',
  'weather_damage',
  'physical_damage',
  'competition',
  'other',
] as const;
export type IssueKind = (typeof issueKinds)[number];

export const issueSeverities = ['low', 'medium', 'high'] as const;
export type IssueSeverity = (typeof issueSeverities)[number];

export const issueStatuses = ['open', 'monitoring', 'resolved'] as const;
export type IssueStatus = (typeof issueStatuses)[number];

/** The planting an issue belongs to, with enough context to read a list. */
export type IssuePlanting = {
  id: number;
  species: { name: string; variety: string | null };
  area: { id: number; name: string };
};

export type Issue = {
  id: number;
  planting: IssuePlanting;
  kind: IssueKind;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  /** 'YYYY-MM-DD'. */
  openedOn: string;
  /** 'YYYY-MM-DD', set only while the issue is resolved. */
  resolvedOn: string | null;
  resolution: string | null;
};

/** The editable fields. The planting comes from the path, never the body. */
export type IssueInput = {
  kind: IssueKind;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  openedOn: string;
  resolvedOn: string | null;
  resolution: string | null;
};

/** Optional list filters. Leaving one out keeps every issue of that kind. */
export type IssueFilters = {
  status?: IssueStatus | undefined;
  plantingId?: number | undefined;
};

/** Query keys for the issue cache; every mutation invalidates the whole list. */
export const issueKeys = {
  all: ['issues'] as const,
  forPlanting: (plantingId: number) => ['issues', 'planting', plantingId] as const,
};

/** Written out rather than derived, so 'nutrient_deficiency' reads properly. */
const kindLabels: Record<IssueKind, string> = {
  pest: 'Pest',
  disease: 'Disease',
  nutrient_deficiency: 'Nutrient deficiency',
  weather_damage: 'Weather damage',
  physical_damage: 'Physical damage',
  competition: 'Competition',
  other: 'Other',
};

const severityLabels: Record<IssueSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const statusLabels: Record<IssueStatus, string> = {
  open: 'Open',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
};

export function issueLabel(kind: IssueKind): string {
  return kindLabels[kind];
}

export function severityLabel(severity: IssueSeverity): string {
  return severityLabels[severity];
}

export function statusLabel(status: IssueStatus): string {
  return statusLabels[status];
}

export async function listIssues(filters: IssueFilters = {}): Promise<Issue[]> {
  const query = new URLSearchParams();
  if (filters.status !== undefined) query.set('status', filters.status);
  if (filters.plantingId !== undefined) query.set('plantingId', String(filters.plantingId));

  const suffix = query.toString() === '' ? '' : `?${query.toString()}`;
  const body = await api.get<{ issues: Issue[] }>(`/issues${suffix}`);
  return body.issues;
}

export async function createIssue(plantingId: number, input: IssueInput): Promise<Issue> {
  const body = await api.post<{ issue: Issue }>(`/plantings/${plantingId}/issues`, input);
  return body.issue;
}

export async function updateIssue(id: number, input: IssueInput): Promise<Issue> {
  const body = await api.put<{ issue: Issue }>(`/issues/${id}`, input);
  return body.issue;
}

/**
 * How many issues are still open in each area, which is what the layout view
 * flags. Monitoring and resolved issues do not count: the indicator is about
 * what needs attention now.
 */
export function openIssueCounts(issues: Issue[]): Record<number, number> {
  const counts: Record<number, number> = {};

  for (const issue of issues) {
    if (issue.status !== 'open') continue;
    const areaId = issue.planting.area.id;
    counts[areaId] = (counts[areaId] ?? 0) + 1;
  }

  return counts;
}
