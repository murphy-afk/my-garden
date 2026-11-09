/**
 * Plantings: the words the API speaks and the calls that use them.
 * The type mirrors server/src/routes/plantings.ts, which is the contract.
 */

import { api } from './client';

export const plantingSources = ['seed', 'seedling', 'cutting', 'bare_root', 'division', 'other'] as const;
export type PlantingSource = (typeof plantingSources)[number];

export const plantingStatuses = ['active', 'ended'] as const;
export type PlantingStatus = (typeof plantingStatuses)[number];

export type PlantingSpecies = { id: number; name: string; variety: string | null };
export type PlantingArea = { id: number; name: string };

export type Planting = {
  id: number;
  species: PlantingSpecies;
  area: PlantingArea;
  /** 'YYYY-MM-DD'. */
  plantedOn: string;
  quantity: number;
  source: PlantingSource;
  status: PlantingStatus;
  /** 'YYYY-MM-DD', set only while the planting has ended. */
  endedOn: string | null;
  notes: string | null;
};

export type PlantingInput = {
  speciesId: number;
  areaId: number;
  plantedOn: string;
  quantity: number;
  source: PlantingSource;
  status: PlantingStatus;
  endedOn: string | null;
  notes: string | null;
};

/** Optional list filters. Leaving one out keeps every planting of that kind. */
export type PlantingFilters = {
  areaId?: number | undefined;
  speciesId?: number | undefined;
  status?: PlantingStatus | undefined;
};

/** Query keys for the planting cache; every mutation invalidates the whole list. */
export const plantingKeys = { all: ['plantings'] as const };

export async function listPlantings(filters: PlantingFilters = {}): Promise<Planting[]> {
  const query = new URLSearchParams();
  if (filters.areaId !== undefined) query.set('areaId', String(filters.areaId));
  if (filters.speciesId !== undefined) query.set('speciesId', String(filters.speciesId));
  if (filters.status !== undefined) query.set('status', filters.status);

  const suffix = query.toString() === '' ? '' : `?${query.toString()}`;
  const body = await api.get<{ plantings: Planting[] }>(`/plantings${suffix}`);
  return body.plantings;
}

export async function getPlanting(id: number): Promise<Planting> {
  const body = await api.get<{ planting: Planting }>(`/plantings/${id}`);
  return body.planting;
}

export async function createPlanting(input: PlantingInput): Promise<Planting> {
  const body = await api.post<{ planting: Planting }>('/plantings', input);
  return body.planting;
}

export async function updatePlanting(id: number, input: PlantingInput): Promise<Planting> {
  const body = await api.put<{ planting: Planting }>(`/plantings/${id}`, input);
  return body.planting;
}

/** Ends a planting on a date; without one the API ends it today. */
export async function endPlanting(id: number, endedOn: string | null): Promise<Planting> {
  const body = await api.post<{ planting: Planting }>(`/plantings/${id}/end`, { endedOn });
  return body.planting;
}

/** Puts an ended planting back to active and clears its end date. */
export async function reopenPlanting(id: number): Promise<Planting> {
  const body = await api.post<{ planting: Planting }>(`/plantings/${id}/reopen`);
  return body.planting;
}

/** 'bare_root' becomes 'Bare root'. Shared by the list, the form and the detail page. */
export function labelFor(value: string): string {
  const words = value.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The name shown for a planting, with the variety when it has one. */
export function plantingName(planting: Planting): string {
  return planting.species.variety === null ? planting.species.name : `${planting.species.name} ${planting.species.variety}`;
}

/** Today as 'YYYY-MM-DD', the format every business date travels in. */
export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
