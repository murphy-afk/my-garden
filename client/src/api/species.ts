/**
 * The species catalogue: the words the API speaks and the calls that use them.
 * The type mirrors server/src/routes/species.ts, which is the contract.
 */

import { api } from './client';
export const speciesCategories = ['vegetable', 'fruit', 'flower', 'herb'] as const;
export type SpeciesCategory = (typeof speciesCategories)[number];

export const speciesCycles = ['annual', 'biennial', 'perennial'] as const;
export type SpeciesCycle = (typeof speciesCycles)[number];

export type Species = {
  id: number;
  name: string;
  variety: string | null;
  category: SpeciesCategory;
  scientificName: string | null;
  cycle: SpeciesCycle;
  spacingCm: number | null;
  daysToFlower: number | null;
  daysToHarvest: number | null;
  notes: string | null;
  archived: boolean;
};

export type SpeciesInput = Omit<Species, 'id' | 'archived'>;

/** Query keys for the species cache; every mutation invalidates the whole list. */
export const speciesKeys = { all: ['species'] as const };

export async function listSpecies(includeArchived: boolean): Promise<Species[]> {
  const query = includeArchived ? '?includeArchived=true' : '';
  const body = await api.get<{ species: Species[] }>(`/species${query}`);
  return body.species;
}

export async function getSpecies(id: number): Promise<Species> {
  const body = await api.get<{ species: Species }>(`/species/${id}`);
  return body.species;
}

export async function createSpecies(input: SpeciesInput): Promise<Species> {
  const body = await api.post<{ species: Species }>('/species', input);
  return body.species;
}

export async function updateSpecies(id: number, input: SpeciesInput): Promise<Species> {
  const body = await api.put<{ species: Species }>(`/species/${id}`, input);
  return body.species;
}

export async function archiveSpecies(id: number): Promise<Species> {
  const body = await api.post<{ species: Species }>(`/species/${id}/archive`);
  return body.species;
}

export async function restoreSpecies(id: number): Promise<Species> {
  const body = await api.post<{ species: Species }>(`/species/${id}/restore`);
  return body.species;
}

/** 'vegetable' becomes 'Vegetable'. Shared by the list and the form. */
export function labelFor(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
