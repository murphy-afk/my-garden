/**
 * Guides: the words the API speaks and the calls that use them.
 * The type mirrors server/src/routes/guides.ts, which is the contract.
 */

import { api } from './client';

/** The library's five shelves. */
export const guideCategories = [
  'vegetable_growing',
  'flower_care',
  'pests_and_disease',
  'soil_and_compost',
  'seed_saving',
] as const;
export type GuideCategory = (typeof guideCategories)[number];

/** A guide as a list row: everything except the body, which is only read once. */
export type GuideSummary = {
  id: number;
  title: string;
  slug: string;
  category: GuideCategory;
  summary: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  /** 'YYYY-MM-DD', set only when the source carries a date. */
  publishedOn: string | null;
  tags: string[];
};

export type Guide = GuideSummary & {
  body: string;
};

/** The editable fields. Tags travel as names; the API writes the join table. */
export type GuideInput = {
  title: string;
  category: GuideCategory;
  summary: string | null;
  body: string;
  sourceName: string | null;
  sourceUrl: string | null;
  publishedOn: string | null;
  tags: string[];
};

export type GuideFilters = {
  category?: GuideCategory | undefined;
  tag?: string | undefined;
};

/** Query keys for the guide cache; every mutation invalidates the whole list. */
export const guideKeys = {
  all: ['guides'] as const,
  forGuide: (id: number) => ['guides', 'guide', id] as const,
};

/** Written out rather than derived, so 'pests_and_disease' reads properly. */
const categoryLabels: Record<GuideCategory, string> = {
  vegetable_growing: 'Vegetable growing',
  flower_care: 'Flower care',
  pests_and_disease: 'Pests and diseases',
  soil_and_compost: 'Soil and compost',
  seed_saving: 'Seed saving',
};

export function categoryLabel(category: GuideCategory): string {
  return categoryLabels[category];
}

export async function listGuides(filters: GuideFilters = {}): Promise<GuideSummary[]> {
  const query = new URLSearchParams();
  if (filters.category !== undefined) query.set('category', filters.category);
  if (filters.tag !== undefined) query.set('tag', filters.tag);

  const suffix = query.toString() === '' ? '' : `?${query.toString()}`;
  const body = await api.get<{ guides: GuideSummary[] }>(`/guides${suffix}`);
  return body.guides;
}

export async function getGuide(id: number): Promise<Guide> {
  const body = await api.get<{ guide: Guide }>(`/guides/${id}`);
  return body.guide;
}

export async function createGuide(input: GuideInput): Promise<Guide> {
  const body = await api.post<{ guide: Guide }>('/guides', input);
  return body.guide;
}

export async function updateGuide(id: number, input: GuideInput): Promise<Guide> {
  const body = await api.put<{ guide: Guide }>(`/guides/${id}`, input);
  return body.guide;
}

/** Removes a guide for good; its tags survive for the guides still using them. */
export async function deleteGuide(id: number): Promise<void> {
  await api.delete(`/guides/${id}`);
}

/** The tags across a list, alphabetically and without repeats. */
export function tagsOf(guides: GuideSummary[]): string[] {
  const tags = new Set<string>();
  for (const guide of guides) {
    for (const tag of guide.tags) tags.add(tag);
  }
  return [...tags].sort((left, right) => left.localeCompare(right));
}
