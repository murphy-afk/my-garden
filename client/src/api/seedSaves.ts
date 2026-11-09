/**
 * Seed saves: the words the API speaks and the calls that use them.
 * The type mirrors server/src/routes/seedSaves.ts, which is the contract.
 */

import { api } from './client';

export const seedStorages = ['paper_envelope', 'glass_jar', 'plastic_bag', 'frozen', 'other'] as const;
export type SeedStorage = (typeof seedStorages)[number];

/** The planting a seed save's harvest came from, so an inventory can name it. */
export type SeedSavePlanting = {
  id: number;
  species: { name: string; variety: string | null };
  area: { name: string };
};

export type SeedSave = {
  id: number;
  harvestId: number;
  planting: SeedSavePlanting;
  kept: boolean;
  /** Seeds, grams or whatever the gardener counts in. */
  quantity: number | null;
  storageMethod: SeedStorage;
  storageLocation: string | null;
  /** 'YYYY-MM-DD', set only while the seeds were kept. */
  savedOn: string | null;
  note: string | null;
  /** 'YYYY-MM-DD' of the harvest the seeds came from. */
  harvestedOn: string;
};

/** The editable fields. The harvest comes from the path, never the body. */
export type SeedSaveInput = {
  kept: boolean;
  quantity: number | null;
  storageMethod: SeedStorage;
  storageLocation: string | null;
  savedOn: string | null;
  note: string | null;
};

/** Optional list filters. Leaving one out keeps every record of that kind. */
export type SeedSaveFilters = {
  plantingId?: number | undefined;
  kept?: boolean | undefined;
};

/** Query keys for the seed cache, grouped by the planting they came from. */
export const seedSaveKeys = {
  all: ['seed-saves'] as const,
  forPlanting: (plantingId: number) => ['seed-saves', 'planting', plantingId] as const,
};

/** Written out rather than derived, so 'paper_envelope' reads properly. */
const storageLabels: Record<SeedStorage, string> = {
  paper_envelope: 'Paper envelope',
  glass_jar: 'Glass jar',
  plastic_bag: 'Plastic bag',
  frozen: 'Frozen',
  other: 'Other',
};

export function storageLabel(method: SeedStorage): string {
  return storageLabels[method];
}

export async function listSeedSaves(filters: SeedSaveFilters = {}): Promise<SeedSave[]> {
  const query = new URLSearchParams();
  if (filters.plantingId !== undefined) query.set('plantingId', String(filters.plantingId));
  if (filters.kept !== undefined) query.set('kept', String(filters.kept));

  const suffix = query.toString() === '' ? '' : `?${query.toString()}`;
  const body = await api.get<{ seedSaves: SeedSave[] }>(`/seed-saves${suffix}`);
  return body.seedSaves;
}

export async function createSeedSave(harvestId: number, input: SeedSaveInput): Promise<SeedSave> {
  const body = await api.post<{ seedSave: SeedSave }>(`/harvests/${harvestId}/seed-saves`, input);
  return body.seedSave;
}

export async function updateSeedSave(id: number, input: SeedSaveInput): Promise<SeedSave> {
  const body = await api.put<{ seedSave: SeedSave }>(`/seed-saves/${id}`, input);
  return body.seedSave;
}

/** Removes a seed save for good, so a wrong entry can be taken back. */
export async function deleteSeedSave(id: number): Promise<void> {
  await api.delete(`/seed-saves/${id}`);
}
