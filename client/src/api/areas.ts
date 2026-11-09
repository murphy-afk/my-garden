/**
 * Garden areas: the words the API speaks and the calls that use them.
 * The type mirrors server/src/routes/areas.ts, which is the contract.
 */

import { api } from './client';

export const areaKinds = ['bed', 'raised_bed', 'pot', 'border', 'greenhouse', 'windowsill', 'other'] as const;
export type AreaKind = (typeof areaKinds)[number];

/**
 * The layout grid, in centimetres. One slot is a standard raised bed, which is
 * what the example areas in the seed assume. These numbers must match the
 * constants in server/src/routes/areas.ts: the API rejects anything that would
 * not fit the grid the canvas draws here.
 */
export const areaGrid = {
  columns: 6,
  rows: 6,
  cellWidthCm: 240,
  cellHeightCm: 120,
  /** Below this an area would be too small to grab on the canvas. */
  minAreaCm: 60,
  /** Sizes snap to this step while dragging the resize handle. */
  resizeStepCm: 10,
  /** Pixels per centimetre, so one cell renders at 150 x 75 pixels. */
  pxPerCm: 0.625,
} as const;

/** Full size of the grid in centimetres, the bounds every area is checked against. */
export const areaGridWidthCm = areaGrid.columns * areaGrid.cellWidthCm;
export const areaGridHeightCm = areaGrid.rows * areaGrid.cellHeightCm;

export type GardenArea = {
  id: number;
  name: string;
  kind: AreaKind;
  widthCm: number;
  depthCm: number;
  gridX: number;
  gridY: number;
  notes: string | null;
  archived: boolean;
};

export type AreaInput = Omit<GardenArea, 'id' | 'archived'>;

/** The part of an area that dragging and resizing change. */
export type AreaGeometry = Pick<AreaInput, 'gridX' | 'gridY' | 'widthCm' | 'depthCm'>;

/** Query keys for the area cache; every mutation invalidates the whole list. */
export const areaKeys = { all: ['areas'] as const };

export async function listAreas(includeArchived: boolean): Promise<GardenArea[]> {
  const query = includeArchived ? '?includeArchived=true' : '';
  const body = await api.get<{ areas: GardenArea[] }>(`/areas${query}`);
  return body.areas;
}

export async function getArea(id: number): Promise<GardenArea> {
  const body = await api.get<{ area: GardenArea }>(`/areas/${id}`);
  return body.area;
}

export async function createArea(input: AreaInput): Promise<GardenArea> {
  const body = await api.post<{ area: GardenArea }>('/areas', input);
  return body.area;
}

export async function updateArea(id: number, input: AreaInput): Promise<GardenArea> {
  const body = await api.put<{ area: GardenArea }>(`/areas/${id}`, input);
  return body.area;
}

export async function archiveArea(id: number): Promise<GardenArea> {
  const body = await api.post<{ area: GardenArea }>(`/areas/${id}/archive`);
  return body.area;
}

export async function restoreArea(id: number): Promise<GardenArea> {
  const body = await api.post<{ area: GardenArea }>(`/areas/${id}/restore`);
  return body.area;
}

/** Removes an area for good; the API refuses while plantings reference it. */
export async function deleteArea(id: number): Promise<void> {
  await api.delete(`/areas/${id}`);
}

/** 'raised_bed' becomes 'Raised bed'. Shared by the list and the form. */
export function kindLabel(value: string): string {
  const words = value.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Bounding box of an area in centimetres, measured from the top left of the grid. */
function toBox(area: AreaGeometry): { left: number; right: number; top: number; bottom: number } {
  const left = area.gridX * areaGrid.cellWidthCm;
  const top = area.gridY * areaGrid.cellHeightCm;
  return { left, right: left + area.widthCm, top, bottom: top + area.depthCm };
}

function overlaps(a: AreaGeometry, b: AreaGeometry): boolean {
  const first = toBox(a);
  const second = toBox(b);
  return first.left < second.right && second.left < first.right && first.top < second.bottom && second.top < first.bottom;
}

/**
 * The first slot that has room for an area of this size, reading row by row
 * from the top left. The create form starts here so a new area does not land
 * on top of an existing one.
 */
export function firstFreeSlot(areas: AreaGeometry[], widthCm: number, depthCm: number): AreaGeometry {
  for (let gridY = 0; gridY < areaGrid.rows; gridY += 1) {
    for (let gridX = 0; gridX < areaGrid.columns; gridX += 1) {
      const candidate: AreaGeometry = { gridX, gridY, widthCm, depthCm };
      if (!areas.some((area) => overlaps(candidate, area))) return candidate;
    }
  }

  // The grid is full: fall back to the origin, where the overlap is visible and fixable.
  return { gridX: 0, gridY: 0, widthCm, depthCm };
}
