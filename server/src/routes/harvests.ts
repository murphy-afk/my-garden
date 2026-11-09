import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import express from 'express';
import { queryRows, type Database } from '../db/pool.js';
import { ApiError } from '../errors.js';
import { optionalText, readBody, requireChoice, requireDate, requireId, requireNumber } from '../validation.js';

/** The units a harvest can be counted in, in the words the schema stores. */
const units = ['gram', 'kilogram', 'piece', 'bunch', 'bucket', 'litre'] as const;
type HarvestUnit = (typeof units)[number];

/**
 * Every column the API returns, with the planting's species and area joined
 * in, so a harvest list says what was picked and where without a call per row.
 */
const harvestColumns = `
  h.id, h.plantingId, h.harvestedOn, h.quantity, h.unit, h.note,
  s.name AS speciesName, s.variety AS speciesVariety, a.id AS areaId, a.name AS areaName
`;

const harvestFrom = `
  FROM Harvest h
  JOIN Planting p ON p.id = h.plantingId
  JOIN Species s ON s.id = p.speciesId
  JOIN GardenArea a ON a.id = p.areaId
`;

type HarvestRow = {
  id: number;
  plantingId: number;
  /** 'YYYY-MM-DD', from the pool's dateStrings setting. */
  harvestedOn: string;
  /** DECIMAL comes back as text, so it is parsed on the way out. */
  quantity: string;
  unit: string;
  note: string | null;
  speciesName: string;
  speciesVariety: string | null;
  areaId: number;
  areaName: string;
};

type Harvest = {
  id: number;
  planting: {
    id: number;
    species: { name: string; variety: string | null };
    area: { id: number; name: string };
  };
  harvestedOn: string;
  quantity: number;
  unit: HarvestUnit;
  note: string | null;
};

/** The editable fields. The planting comes from the path, never the body. */
type HarvestInput = {
  harvestedOn: string;
  quantity: number;
  unit: HarvestUnit;
  note: string | null;
};

/** Row to API shape. The unit column is constrained by MySQL, so lowering it is safe. */
function toHarvest(row: HarvestRow): Harvest {
  return {
    id: row.id,
    planting: {
      id: row.plantingId,
      species: { name: row.speciesName, variety: row.speciesVariety },
      area: { id: row.areaId, name: row.areaName },
    },
    harvestedOn: row.harvestedOn,
    quantity: Number(row.quantity),
    unit: row.unit.toLowerCase() as HarvestUnit,
    note: row.note,
  };
}

/** Reads the editable fields from a request body, failing on the first problem. */
function readInput(body: unknown): HarvestInput {
  const fields = readBody(body);
  return {
    harvestedOn: requireDate(fields, 'harvestedOn', { label: 'Harvested on' }),
    quantity: requireNumber(fields, 'quantity', { min: 0.01, max: 99999999.99, label: 'Quantity' }),
    unit: requireChoice(fields, 'unit', units, { label: 'Unit' }),
    note: optionalText(fields, 'note', { maxLength: 4000, label: 'Note' }),
  };
}

/** The values the INSERT and UPDATE statements share, in column order. */
function columnValues(input: HarvestInput): (string | number | null)[] {
  return [input.harvestedOn, input.quantity, input.unit.toUpperCase(), input.note];
}

const insertSql = 'INSERT INTO Harvest (plantingId, harvestedOn, quantity, unit, note) VALUES (?, ?, ?, ?, ?)';

const updateSql = 'UPDATE Harvest SET harvestedOn = ?, quantity = ?, unit = ?, note = ? WHERE id = ?';

const deleteSql = 'DELETE FROM Harvest WHERE id = ?';

function harvestNotFound(id: number): ApiError {
  return new ApiError(404, 'harvest_not_found', `No harvest with id ${id}.`);
}

function plantingNotFound(plantingId: number): ApiError {
  return new ApiError(404, 'planting_not_found', `No planting with id ${plantingId}.`);
}

/** Reads one harvest inside the caller's transaction, or answers 404. */
async function loadHarvest(connection: PoolConnection, id: number): Promise<HarvestRow> {
  const rows = await queryRows<HarvestRow[]>(connection, `SELECT ${harvestColumns} ${harvestFrom} WHERE h.id = ?`, [id]);
  const row = rows[0];
  if (row === undefined) throw harvestNotFound(id);
  return row;
}

/**
 * A harvest hangs off a planting, so a nested path names a planting that has
 * to exist before anything is written under it.
 */
async function assertPlantingExists(connection: PoolConnection, plantingId: number): Promise<void> {
  const rows = await queryRows<{ id: number }[]>(connection, 'SELECT id FROM Planting WHERE id = ?', [plantingId]);
  if (rows.length === 0) throw plantingNotFound(plantingId);
}

export function createHarvestsRouter(database: Database) {
  const router = express.Router();

  /**
   * The list every view reads: a planting's page filters by its own id, the
   * harvests page by area. Each filter is read and rejected before it reaches
   * SQL, so a value never becomes part of a statement.
   */
  function readFilters(query: Record<string, unknown>): { where: string; parameters: (string | number)[] } {
    const conditions: string[] = [];
    const parameters: (string | number)[] = [];

    const plantingId = query['plantingId'];
    if (typeof plantingId === 'string' && plantingId !== '') {
      conditions.push('h.plantingId = ?');
      parameters.push(requireId(plantingId));
    }

    const areaId = query['areaId'];
    if (typeof areaId === 'string' && areaId !== '') {
      conditions.push('a.id = ?');
      parameters.push(requireId(areaId));
    }

    return { where: conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`, parameters };
  }

  router.get('/harvests', async (request, response) => {
    const { where, parameters } = readFilters(request.query as Record<string, unknown>);
    // Newest first, which reads like the season running backwards.
    const rows = await database.query<HarvestRow[]>(
      `SELECT ${harvestColumns} ${harvestFrom} ${where} ORDER BY h.harvestedOn DESC, h.id DESC`,
      parameters,
    );
    response.json({ harvests: rows.map(toHarvest) });
  });

  router.post('/plantings/:plantingId/harvests', async (request, response) => {
    const plantingId = requireId(request.params.plantingId);
    const input = readInput(request.body);

    const harvest = await database.withTransaction(async (connection) => {
      await assertPlantingExists(connection, plantingId);
      const [result] = await connection.execute<ResultSetHeader>(insertSql, [plantingId, ...columnValues(input)]);
      return toHarvest(await loadHarvest(connection, result.insertId));
    });

    response.status(201).json({ harvest });
  });

  router.put('/harvests/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const input = readInput(request.body);

    const harvest = await database.withTransaction(async (connection) => {
      await loadHarvest(connection, id);
      await connection.execute(updateSql, [...columnValues(input), id]);
      return toHarvest(await loadHarvest(connection, id));
    });

    response.json({ harvest });
  });

  router.delete('/harvests/:id', async (request, response) => {
    const id = requireId(request.params.id);

    await database.withTransaction(async (connection) => {
      await loadHarvest(connection, id);
      // SeedSave points at its harvest with ON DELETE CASCADE, so the seed
      // records go with it. The form warns before this runs.
      await connection.execute(deleteSql, [id]);
    });

    response.status(204).end();
  });

  return router;
}
