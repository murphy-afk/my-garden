import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import express from 'express';
import { queryRows, type Database } from '../db/pool.js';
import { ApiError } from '../errors.js';
import { optionalText, readBody, requireChoice, requireId, requireInteger, requireText } from '../validation.js';

/** The API speaks these words in lowercase; the database stores the uppercase ENUM. */
const kinds = ['bed', 'raised_bed', 'pot', 'border', 'greenhouse', 'windowsill', 'other'] as const;
type AreaKind = (typeof kinds)[number];

/**
 * The layout grid, in centimetres. One slot is a standard raised bed, which is
 * what the example areas in the seed assume: at these dimensions they sit side
 * by side without overlapping. The canvas in client/src/api/areas.ts draws the
 * same grid, so an area the API accepts is always one the canvas can show.
 */
const gridColumns = 6;
const gridRows = 6;
const cellWidthCm = 240;
const cellHeightCm = 120;
const gridWidthCm = gridColumns * cellWidthCm;
const gridHeightCm = gridRows * cellHeightCm;

/** Below this an area would be too small to grab on the canvas. */
const minAreaCm = 60;

const areaColumns = 'id, name, kind, widthCm, depthCm, gridX, gridY, notes, archived';

type AreaRow = {
  id: number;
  name: string;
  kind: string;
  widthCm: number;
  depthCm: number;
  gridX: number;
  gridY: number;
  notes: string | null;
  archived: number;
};

type GardenArea = {
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

type AreaInput = Omit<GardenArea, 'id' | 'archived'>;

/** Row to API shape. The enum column is constrained by MySQL, so lowering it is safe. */
function toArea(row: AreaRow): GardenArea {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind.toLowerCase() as AreaKind,
    widthCm: row.widthCm,
    depthCm: row.depthCm,
    gridX: row.gridX,
    gridY: row.gridY,
    notes: row.notes,
    archived: row.archived === 1,
  };
}

/**
 * An area that reaches past the edge of the grid could not be drawn where it
 * was saved, so the position and the size are checked together. That check
 * needs both fields, which is why it sits after the per-field rules below.
 */
function assertFitsGrid(input: AreaInput): void {
  if (input.gridX * cellWidthCm + input.widthCm > gridWidthCm) {
    throw new ApiError(
      400,
      'grid_overflow',
      'This area would reach past the right edge of the grid. Move it left or make it narrower.',
    );
  }
  if (input.gridY * cellHeightCm + input.depthCm > gridHeightCm) {
    throw new ApiError(
      400,
      'grid_overflow',
      'This area would reach past the bottom edge of the grid. Move it up or make it shallower.',
    );
  }
}

/** Reads the editable fields from a request body, failing on the first problem. */
function readInput(body: unknown): AreaInput {
  const fields = readBody(body);
  const input: AreaInput = {
    name: requireText(fields, 'name', { maxLength: 120, label: 'Name' }),
    kind: requireChoice(fields, 'kind', kinds, { label: 'Type' }),
    widthCm: requireInteger(fields, 'widthCm', { min: minAreaCm, max: gridWidthCm, label: 'Width (cm)' }),
    depthCm: requireInteger(fields, 'depthCm', { min: minAreaCm, max: gridHeightCm, label: 'Depth (cm)' }),
    gridX: requireInteger(fields, 'gridX', { min: 0, max: gridColumns - 1, label: 'Grid column' }),
    gridY: requireInteger(fields, 'gridY', { min: 0, max: gridRows - 1, label: 'Grid row' }),
    notes: optionalText(fields, 'notes', { maxLength: 4000, label: 'Notes' }),
  };
  assertFitsGrid(input);
  return input;
}

/** The values the INSERT and UPDATE statements share, in column order. */
function columnValues(input: AreaInput): (string | number | null)[] {
  return [
    input.name,
    input.kind.toUpperCase(),
    input.widthCm,
    input.depthCm,
    input.gridX,
    input.gridY,
    input.notes,
  ];
}

const insertSql = `
  INSERT INTO GardenArea (name, kind, widthCm, depthCm, gridX, gridY, notes, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))
`;

const updateSql = `
  UPDATE GardenArea
  SET name = ?, kind = ?, widthCm = ?, depthCm = ?, gridX = ?, gridY = ?, notes = ?, updatedAt = CURRENT_TIMESTAMP(3)
  WHERE id = ?
`;

const archiveSql = 'UPDATE GardenArea SET archived = ?, updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?';

const deleteSql = 'DELETE FROM GardenArea WHERE id = ?';

const duplicateMessage = 'An area with this name already exists.';

function nameTaken(): ApiError {
  return new ApiError(409, 'area_exists', duplicateMessage, { fields: { name: duplicateMessage } });
}

function notFound(id: number): ApiError {
  return new ApiError(404, 'area_not_found', `No garden area with id ${id}.`);
}

/** MySQL rejects a repeat of the unique name index with ER_DUP_ENTRY. */
function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ER_DUP_ENTRY';
}

/**
 * A delete that hits a foreign key answers 409 rather than 500: Planting
 * references GardenArea with ON DELETE RESTRICT, so an area with plantings
 * recorded against it has to be archived instead.
 */
function isReferencedRow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === 'ER_ROW_IS_REFERENCED_1' || code === 'ER_ROW_IS_REFERENCED_2';
}

/**
 * Answers 409 when another area already holds this name. The unique index on
 * (name) is the backstop for a concurrent insert, so this only improves the
 * message and the timing.
 */
async function assertNameFree(
  connection: PoolConnection,
  name: string,
  excludeId?: number,
): Promise<void> {
  const sql =
    excludeId === undefined
      ? 'SELECT id FROM GardenArea WHERE name = ? LIMIT 1'
      : 'SELECT id FROM GardenArea WHERE name = ? AND id <> ? LIMIT 1';
  const parameters: (string | number)[] = excludeId === undefined ? [name] : [name, excludeId];
  const rows = await queryRows<{ id: number }[]>(connection, sql, parameters);
  if (rows.length > 0) throw nameTaken();
}

/** Reads one area inside the caller's transaction, or answers 404. */
async function loadArea(connection: PoolConnection, id: number): Promise<AreaRow> {
  const rows = await queryRows<AreaRow[]>(
    connection,
    `SELECT ${areaColumns} FROM GardenArea WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  if (row === undefined) throw notFound(id);
  return row;
}

export function createAreasRouter(database: Database) {
  const router = express.Router();

  router.get('/areas', async (request, response) => {
    const includeArchived = request.query['includeArchived'] === 'true';
    // `filter` is a literal chosen from a boolean, never user input.
    const filter = includeArchived ? '' : 'WHERE archived = 0';
    // Position order reads like a walk across the garden, top row first.
    const rows = await database.query<AreaRow[]>(
      `SELECT ${areaColumns} FROM GardenArea ${filter} ORDER BY archived ASC, gridY ASC, gridX ASC, name ASC`,
    );
    response.json({ areas: rows.map(toArea) });
  });

  router.get('/areas/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const rows = await database.query<AreaRow[]>(
      `SELECT ${areaColumns} FROM GardenArea WHERE id = ?`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound(id);
    response.json({ area: toArea(row) });
  });

  router.post('/areas', async (request, response) => {
    const input = readInput(request.body);

    const area = await database.withTransaction(async (connection) => {
      await assertNameFree(connection, input.name);
      try {
        const [result] = await connection.execute<ResultSetHeader>(insertSql, columnValues(input));
        const created = await loadArea(connection, result.insertId);
        return toArea(created);
      } catch (error) {
        // The pre-check cannot see a concurrent insert, so the index stays the backstop.
        if (isDuplicateKey(error)) throw nameTaken();
        throw error;
      }
    });

    response.status(201).json({ area });
  });

  router.put('/areas/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const input = readInput(request.body);

    const area = await database.withTransaction(async (connection) => {
      const existing = await loadArea(connection, id);
      await assertNameFree(connection, input.name, id);
      try {
        await connection.execute(updateSql, [...columnValues(input), id]);
      } catch (error) {
        if (isDuplicateKey(error)) throw nameTaken();
        throw error;
      }
      // The update only touches the fields the caller sent, so the response
      // is those values plus the id and archived flag the update left alone.
      return { ...input, id, archived: existing.archived === 1 };
    });

    response.json({ area });
  });

  async function setArchived(id: number, archived: boolean): Promise<GardenArea> {
    return database.withTransaction(async (connection) => {
      const existing = await loadArea(connection, id);
      await connection.execute(archiveSql, [archived ? 1 : 0, id]);
      return { ...toArea(existing), archived };
    });
  }

  router.post('/areas/:id/archive', async (request, response) => {
    response.json({ area: await setArchived(requireId(request.params.id), true) });
  });

  router.post('/areas/:id/restore', async (request, response) => {
    response.json({ area: await setArchived(requireId(request.params.id), false) });
  });

  router.delete('/areas/:id', async (request, response) => {
    const id = requireId(request.params.id);

    await database.withTransaction(async (connection) => {
      await loadArea(connection, id);
      try {
        await connection.execute(deleteSql, [id]);
      } catch (error) {
        if (isReferencedRow(error)) {
          throw new ApiError(
            409,
            'area_in_use',
            'This area still has plantings recorded against it. Archive it instead.',
          );
        }
        throw error;
      }
    });

    response.status(204).end();
  });

  return router;
}
