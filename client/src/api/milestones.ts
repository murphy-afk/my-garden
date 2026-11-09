/**
 * Milestones: the words the API speaks and the calls that use them.
 * The type mirrors server/src/routes/milestones.ts, which is the contract.
 */

import { api } from './client';

export const milestoneKinds = [
  'sown',
  'germinated',
  'transplanted',
  'first_flower',
  'first_fruit',
  'beginning_to_decline',
  'died',
] as const;
export type MilestoneKind = (typeof milestoneKinds)[number];

export type Milestone = {
  id: number;
  plantingId: number;
  kind: MilestoneKind;
  /** 'YYYY-MM-DD'. */
  occurredOn: string;
  note: string | null;
};

/** The editable fields. The planting comes from the path, never the body. */
export type MilestoneInput = {
  kind: MilestoneKind;
  occurredOn: string;
  note: string | null;
};

/**
 * The words shown for each kind. 'first_fruit' reads as first ripe fruit and
 * 'beginning_to_decline' as began declining, which is what the gardener calls
 * them, so these are written out rather than derived from the value.
 */
const milestoneLabels: Record<MilestoneKind, string> = {
  sown: 'Sown',
  germinated: 'Germinated',
  transplanted: 'Transplanted',
  first_flower: 'First flower',
  first_fruit: 'First ripe fruit',
  beginning_to_decline: 'Began declining',
  died: 'Died',
};

export function milestoneLabel(kind: MilestoneKind): string {
  return milestoneLabels[kind];
}

/** Query keys for the milestone cache, grouped by the planting they hang from. */
export const milestoneKeys = {
  all: ['milestones'] as const,
  forPlanting: (plantingId: number) => ['milestones', plantingId] as const,
};

export async function listMilestones(plantingId: number): Promise<Milestone[]> {
  const body = await api.get<{ milestones: Milestone[] }>(`/plantings/${plantingId}/milestones`);
  return body.milestones;
}

export async function createMilestone(plantingId: number, input: MilestoneInput): Promise<Milestone> {
  const body = await api.post<{ milestone: Milestone }>(`/plantings/${plantingId}/milestones`, input);
  return body.milestone;
}

export async function updateMilestone(id: number, input: MilestoneInput): Promise<Milestone> {
  const body = await api.put<{ milestone: Milestone }>(`/milestones/${id}`, input);
  return body.milestone;
}

/** Removes a milestone for good, so a misfired entry can be taken back. */
export async function deleteMilestone(id: number): Promise<void> {
  await api.delete(`/milestones/${id}`);
}
