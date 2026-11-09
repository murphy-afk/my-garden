import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import express from 'express';
import { queryRows, type Database } from '../db/pool.js';
import { ApiError } from '../errors.js';
import {
  invalidField,
  optionalDate,
  optionalText,
  readBody,
  requireChoice,
  requireDate,
  requireId,
  requireInteger,
} from '../validation.js';

/** The API speaks these words in lowercase; the database stores the uppercase ENUM. */
const sources = ['seed', 'seedling', 'cutting', 'bare_root', 'division', 'other'] as const;
type PlantingSource = (typeof sources)[number];

const statuses = ['active', 'ended'] as const;
type PlantingStatus = (typeof statuses)[number];

/**
 * Columns every read shares. The species and area are joined in, so a list of
 * plantings names what it planted and where it went without a second round
 * trip per row.
 */
const plantingColumns = `
  p.id, p.speciesId, p.areaId, p.plantedOn, p.quantity, p.source, p.status, p.endedOn, p.notes,
  s.name AS speciesName, s.variety AS speciesVariety, a.name AS areaName
`;

const plantingFrom = `
  FROM Planting p
  JOIN Species s ON s.id = p.speciesId
  JOIN GardenArea a ON a.id = p.areaId
`;

type PlantingRow = {
  id: number;
  speciesId: number;
  areaId: number;
  /** 'YYYY-MM-DD', from the pool's dateStrings setting. */
  plantedOn: string;
  quantity: number;
  source: string;
  status: string;
  endedOn: string | null;
  notes: string | null;
  speciesName: string;
  speciesVariety: string | null;
  areaName: string;
};

type Planting = {
  id: number;
  species: { id: number; name: string; variety: string | null };
  area: { id: number; name: string };
  plantedOn: string;
  quantity: number;
  source: PlantingSource;
  status: PlantingStatus;
  endedOn: string | null;
  notes: string | null;
};

type PlantingInput = {
  speciesId: number;
  areaId: number;
  plantedOn: string;
  quantity: number;
  source: PlantingSource;
  status: PlantingStatus;
  endedOn: string | null;
  notes: string | null;
};

/** Row to API shape. The enum columns are constrained by MySQL, so lowering them is safe. */
function toPlanting(row: PlantingRow): Planting {
  return {
    id: row.id,
    species: { id: row.speciesId, name: row.speciesName, variety: row.speciesVariety },
    area: { id: row.areaId, name: row.areaName },
    plantedOn: row.plantedOn,
    quantity: row.quantity,
    source: row.source.toLowerCase() as PlantingSource,
    status: row.status.toLowerCase() as PlantingStatus,
    endedOn: row.endedOn,
    notes: row.notes,
  };
}

/** Today's date in the API's own format, used when a planting is ended without a date. */
function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * The two date fields have to agree with the status: an ended planting needs
 * the date it ended, an active one has none, and neither can end before it
 * was planted.
 */
function assertDatesFitStatus(status: PlantingStatus, plantedOn: string, endedOn: string | null): void {
  if (status === 'ended' && endedOn === null) {
    throw invalidField('endedOn', 'An end date is required once the planting has ended.');
  }
  if (status === 'active' && endedOn !== null) {
    throw invalidField('endedOn', 'An end date only applies once the planting has ended.');
  }
  if (endedOn !== null && endedOn < plantedOn) {
    throw invalidField('endedOn', 'The end date cannot be before the planting date.');
  }
}

/** Reads the editable fields from a request body, failing on the first problem. */
function readInput(body: unknown): PlantingInput {
  const fields = readBody(body);
  const input: PlantingInput = {
    speciesId: requireInteger(fields, 'speciesId', { min: 1, label: 'Species' }),
    areaId: requireInteger(fields, 'areaId', { min: 1, label: 'Garden area' }),
    plantedOn: requireDate(fields, 'plantedOn', { label: 'Planted on' }),
    quantity: requireInteger(fields, 'quantity', { min: 1, max: 100000, label: 'Quantity' }),
    source: requireChoice(fields, 'source', sources, { label: 'Source' }),
    status: requireChoice(fields, 'status', statuses, { label: 'Status' }),
    endedOn: optionalDate(fields, 'endedOn', { label: 'Ended on' }),
    notes: optionalText(fields, 'notes', { maxLength: 4000, label: 'Notes' }),
  };
  assertDatesFitStatus(input.status, input.plantedOn, input.endedOn);
  return input;
}

type ReferenceRow = { id: number; archived: number };

async function loadReference(connection: PoolConnection, table: 'Species' | 'GardenArea', id: number): Promise<ReferenceRow> {
  const rows = await queryRows<ReferenceRow[]>(connection, `SELECT id, archived FROM ${table} WHERE id = ?`, [id]);
  const row = rows[0];
  if (row === undefined) {
    throw table === 'Species'
      ? invalidField('speciesId', 'Choose a species that exists.')
      : invalidField('areaId', 'Choose a garden area that exists.');
  }
  return row;
}

/**
 * Checks the two foreign keys before the write. Archived rows are refused
 * only when this planting is new to them, so a note can still be edited on a
 * planting whose bed was archived later.
 */
async function assertReferences(connection: PoolConnection, input: PlantingInput, existing?: PlantingRow): Promise<void> {
  const species = await loadReference(connection, 'Species', input.speciesId);
  if (species.archived === 1 && (existing === undefined || existing.speciesId !== input.speciesId)) {
    throw invalidField('speciesId', 'This species is archived. Restore it before planting it.');
  }

  const area = await loadReference(connection, 'GardenArea', input.areaId);
  if (area.archived === 1 && (existing === undefined || existing.areaId !== input.areaId)) {
    throw invalidField('areaId', 'This area is archived. Restore it before planting into it.');
  }
}

/** The values the INSERT and UPDATE statements share, in column order. */
function columnValues(input: PlantingInput): (string | number | null)[] {
  return [
    input.speciesId,
    input.areaId,
    input.plantedOn,
    input.quantity,
    input.source.toUpperCase(),
    input.status.toUpperCase(),
    input.endedOn,
    input.notes,
  ];
}

const insertSql = `
  INSERT INTO Planting (speciesId, areaId, plantedOn, quantity, source, status, endedOn, notes, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))
`;

const updateSql = `
  UPDATE Planting
  SET speciesId = ?, areaId = ?, plantedOn = ?, quantity = ?, source = ?, status = ?, endedOn = ?, notes = ?, updatedAt = CURRENT_TIMESTAMP(3)
  WHERE id = ?
`;

function notFound(id: number): ApiError {
  return new ApiError(404, 'planting_not_found', `No planting with id ${id}.`);
}

/** Reads one planting inside the caller's transaction, or answers 404. */
async function loadPlanting(connection: PoolConnection, id: number): Promise<PlantingRow> {
  const rows = await queryRows<PlantingRow[]>(connection, `SELECT ${plantingColumns} ${plantingFrom} WHERE p.id = ?`, [id]);
  const row = rows[0];
  if (row === undefined) throw notFound(id);
  return row;
}

export function createPlantingsRouter(database: Database) {
  const router = express.Router();

  /**
   * Filters are optional and combined. Each one is read and rejected before
   * it reaches SQL, so a filter value never becomes part of a statement.
   */
  function readFilters(query: Record<string, unknown>): { where: string; parameters: (string | number)[] } {
    const conditions: string[] = [];
    const parameters: (string | number)[] = [];

    const areaId = query['areaId'];
    if (typeof areaId === 'string' && areaId !== '') {
      conditions.push('p.areaId = ?');
      parameters.push(requireId(areaId));
    }

    const speciesId = query['speciesId'];
    if (typeof speciesId === 'string' && speciesId !== '') {
      conditions.push('p.speciesId = ?');
      parameters.push(requireId(speciesId));
    }

    const status = query['status'];
    if (typeof status === 'string' && status !== '') {
      const match = statuses.find((option) => option === status);
      if (match === undefined) {
        throw invalidField('status', `Status must be one of ${statuses.join(', ')}.`);
      }
      conditions.push('p.status = ?');
      parameters.push(match.toUpperCase());
    }

    return { where: conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`, parameters };
  }

  router.get('/plantings', async (request, response) => {
    const { where, parameters } = readFilters(request.query as Record<string, unknown>);
    // Newest first, which reads like the season running backwards.
    const rows = await database.query<PlantingRow[]>(
      `SELECT ${plantingColumns} ${plantingFrom} ${where} ORDER BY p.plantedOn DESC, p.id DESC`,
      parameters,
    );
    response.json({ plantings: rows.map(toPlanting) });
  });

  router.get('/plantings/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const rows = await database.query<PlantingRow[]>(
      `SELECT ${plantingColumns} ${plantingFrom} WHERE p.id = ?`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound(id);
    response.json({ planting: toPlanting(row) });
  });

  router.post('/plantings', async (request, response) => {
    const input = readInput(request.body);

    const planting = await database.withTransaction(async (connection) => {
      await assertReferences(connection, input);
      const [result] = await connection.execute<ResultSetHeader>(insertSql, columnValues(input));
      return toPlanting(await loadPlanting(connection, result.insertId));
    });

    response.status(201).json({ planting });
  });

  router.put('/plantings/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const input = readInput(request.body);

    const planting = await database.withTransaction(async (connection) => {
      const existing = await loadPlanting(connection, id);
      await assertReferences(connection, input, existing);
      await connection.execute(updateSql, [...columnValues(input), id]);
      return toPlanting(await loadPlanting(connection, id));
    });

    response.json({ planting });
  });

  /**
   * Ends a planting. The date is optional and defaults to today, because the
   * usual case is ending it on the day the gardener noticed.
   */
  router.post('/plantings/:id/end', async (request, response) => {
    const id = requireId(request.params.id);
    const fields = readBody(request.body);
    const endedOn = optionalDate(fields, 'endedOn', { label: 'End date' }) ?? todayIsoDate();

    const planting = await database.withTransaction(async (connection) => {
      const existing = await loadPlanting(connection, id);
      if (endedOn < existing.plantedOn) {
        throw invalidField('endedOn', 'The end date cannot be before the planting date.');
      }
      await connection.execute(
        `UPDATE Planting SET status = 'ENDED', endedOn = ?, updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?`,
        [endedOn, id],
      );
      return toPlanting(await loadPlanting(connection, id));
    });

    response.json({ planting });
  });

  /** Puts an ended planting back in play and clears the date it ended. */
  router.post('/plantings/:id/reopen', async (request, response) => {
    const id = requireId(request.params.id);

    const planting = await database.withTransaction(async (connection) => {
      await loadPlanting(connection, id);
      await connection.execute(
        `UPDATE Planting SET status = 'ACTIVE', endedOn = NULL, updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?`,
        [id],
      );
      return toPlanting(await loadPlanting(connection, id));
    });

    response.json({ planting });
  });

  return router;
}
