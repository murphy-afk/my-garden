/**
 * Harvests: the words the API speaks and the calls that use them.
 * The type mirrors server/src/routes/harvests.ts, which is the contract.
 */

import { api } from './client';

export const harvestUnits = ['gram', 'kilogram', 'piece', 'bunch', 'bucket', 'litre'] as const;
export type HarvestUnit = (typeof harvestUnits)[number];

/** The planting a harvest came from, with enough context to read a list. */
export type HarvestPlanting = {
  id: number;
  species: { name: string; variety: string | null };
  area: { id: number; name: string };
};

export type Harvest = {
  id: number;
  planting: HarvestPlanting;
  /** 'YYYY-MM-DD'. */
  harvestedOn: string;
  quantity: number;
  unit: HarvestUnit;
  note: string | null;
};

/** The editable fields. The planting comes from the path, never the body. */
export type HarvestInput = {
  harvestedOn: string;
  quantity: number;
  unit: HarvestUnit;
  note: string | null;
};

/** Optional list filters. Leaving one out keeps every harvest of that kind. */
export type HarvestFilters = {
  plantingId?: number | undefined;
  areaId?: number | undefined;
};

/** Query keys for the harvest cache, grouped by the planting they came from. */
export const harvestKeys = {
  all: ['harvests'] as const,
  forPlanting: (plantingId: number) => ['harvests', 'planting', plantingId] as const,
};

/** 'kilogram' becomes 'Kilogram'. Shared by the lists and the form. */
export function unitLabel(unit: string): string {
  return unit.charAt(0).toUpperCase() + unit.slice(1);
}

export async function listHarvests(filters: HarvestFilters = {}): Promise<Harvest[]> {
  const query = new URLSearchParams();
  if (filters.plantingId !== undefined) query.set('plantingId', String(filters.plantingId));
  if (filters.areaId !== undefined) query.set('areaId', String(filters.areaId));

  const suffix = query.toString() === '' ? '' : `?${query.toString()}`;
  const body = await api.get<{ harvests: Harvest[] }>(`/harvests${suffix}`);
  return body.harvests;
}

export async function createHarvest(plantingId: number, input: HarvestInput): Promise<Harvest> {
  const body = await api.post<{ harvest: Harvest }>(`/plantings/${plantingId}/harvests`, input);
  return body.harvest;
}

export async function updateHarvest(id: number, input: HarvestInput): Promise<Harvest> {
  const body = await api.put<{ harvest: Harvest }>(`/harvests/${id}`, input);
  return body.harvest;
}

/** Removes a harvest for good; any seed record linked to it goes with it. */
export async function deleteHarvest(id: number): Promise<void> {
  await api.delete(`/harvests/${id}`);
}
