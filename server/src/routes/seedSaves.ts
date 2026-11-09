import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import express from 'express';
import { queryRows, type Database } from '../db/pool.js';
import { ApiError } from '../errors.js';
import {
  invalidField,
  optionalDate,
  optionalNumber,
  optionalText,
  readBody,
  requireBoolean,
  requireChoice,
  requireId,
} from '../validation.js';

/** Where a seed save can be put, in the words the schema stores. */
const storages = ['paper_envelope', 'glass_jar', 'plastic_bag', 'frozen', 'other'] as const;
type SeedStorage = (typeof storages)[number];

/**
 * Every column the API returns, with the harvest and its planting joined in,
 * so the seed inventory says what the seeds are and where they came from
 * without a call per row.
 */
const seedSaveColumns = `
  ss.id, ss.harvestId, ss.kept, ss.quantity, ss.storageMethod, ss.storageLocation, ss.savedOn, ss.note,
  h.harvestedOn,
  p.id AS plantingId, s.name AS speciesName, s.variety AS speciesVariety, a.name AS areaName
`;

const seedSaveFrom = `
  FROM SeedSave ss
  JOIN Harvest h ON h.id = ss.harvestId
  JOIN Planting p ON p.id = h.plantingId
  JOIN Species s ON s.id = p.speciesId
  JOIN GardenArea a ON a.id = p.areaId
`;

type SeedSaveRow = {
  id: number;
  harvestId: number;
  kept: number;
  /** DECIMAL comes back as text, so it is parsed on the way out. */
  quantity: string | null;
  storageMethod: string;
  storageLocation: string | null;
  /** 'YYYY-MM-DD', from the pool's dateStrings setting. */
  savedOn: string | null;
  note: string | null;
  harvestedOn: string;
  plantingId: number;
  speciesName: string;
  speciesVariety: string | null;
  areaName: string;
};

type SeedSave = {
  id: number;
  harvestId: number;
  planting: {
    id: number;
    species: { name: string; variety: string | null };
    area: { name: string };
  };
  kept: boolean;
  quantity: number | null;
  storageMethod: SeedStorage;
  storageLocation: string | null;
  savedOn: string | null;
  note: string | null;
  harvestedOn: string;
};

/** The editable fields. The harvest comes from the path, never the body. */
type SeedSaveInput = {
  kept: boolean;
  quantity: number | null;
  storageMethod: SeedStorage;
  storageLocation: string | null;
  savedOn: string | null;
  note: string | null;
};

/** Row to API shape. The enum and boolean columns are constrained by MySQL. */
function toSeedSave(row: SeedSaveRow): SeedSave {
  return {
    id: row.id,
    harvestId: row.harvestId,
    planting: {
      id: row.plantingId,
      species: { name: row.speciesName, variety: row.speciesVariety },
      area: { name: row.areaName },
    },
    kept: row.kept === 1,
    quantity: row.quantity === null ? null : Number(row.quantity),
    storageMethod: row.storageMethod.toLowerCase() as SeedStorage,
    storageLocation: row.storageLocation,
    savedOn: row.savedOn,
    note: row.note,
    harvestedOn: row.harvestedOn,
  };
}

/**
 * Reads the editable fields from a request body, failing on the first problem.
 * The storage method is required either way because the column is: a save
 * that was not kept records 'other', which is what the form sends.
 */
function readInput(body: unknown): SeedSaveInput {
  const fields = readBody(body);
  return {
    kept: requireBoolean(fields, 'kept', { label: 'Seeds kept' }),
    quantity: optionalNumber(fields, 'quantity', { min: 0.01, max: 99999999.99, label: 'Quantity' }),
    storageMethod: requireChoice(fields, 'storageMethod', storages, { label: 'Storage method' }),
    storageLocation: optionalText(fields, 'storageLocation', { maxLength: 160, label: 'Storage location' }),
    savedOn: optionalDate(fields, 'savedOn', { label: 'Saved on' }),
    note: optionalText(fields, 'note', { maxLength: 4000, label: 'Note' }),
  };
}

/** The values the INSERT and UPDATE statements share, in column order. */
function columnValues(input: SeedSaveInput): (string | number | null)[] {
  return [
    input.kept ? 1 : 0,
    input.quantity,
    input.storageMethod.toUpperCase(),
    input.storageLocation,
    input.savedOn,
    input.note,
  ];
}

const insertSql = `
  INSERT INTO SeedSave (harvestId, kept, quantity, storageMethod, storageLocation, savedOn, note, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))
`;

const updateSql = `
  UPDATE SeedSave
  SET kept = ?, quantity = ?, storageMethod = ?, storageLocation = ?, savedOn = ?, note = ?, updatedAt = CURRENT_TIMESTAMP(3)
  WHERE id = ?
`;

const deleteSql = 'DELETE FROM SeedSave WHERE id = ?';

function seedSaveNotFound(id: number): ApiError {
  return new ApiError(404, 'seed_save_not_found', `No seed save with id ${id}.`);
}

function harvestNotFound(harvestId: number): ApiError {
  return new ApiError(404, 'harvest_not_found', `No harvest with id ${harvestId}.`);
}

/** Reads one seed save inside the caller's transaction, or answers 404. */
async function loadSeedSave(connection: PoolConnection, id: number): Promise<SeedSaveRow> {
  const rows = await queryRows<SeedSaveRow[]>(connection, `SELECT ${seedSaveColumns} ${seedSaveFrom} WHERE ss.id = ?`, [id]);
  const row = rows[0];
  if (row === undefined) throw seedSaveNotFound(id);
  return row;
}

/**
 * A seed save hangs off a harvest, so a nested path names a harvest that has
 * to exist before anything is written under it.
 */
async function assertHarvestExists(connection: PoolConnection, harvestId: number): Promise<void> {
  const rows = await queryRows<{ id: number }[]>(connection, 'SELECT id FROM Harvest WHERE id = ?', [harvestId]);
  if (rows.length === 0) throw harvestNotFound(harvestId);
}

export function createSeedSavesRouter(database: Database) {
  const router = express.Router();

  /**
   * The list every view reads: a planting's page filters by its own id, the
   * seed inventory asks only for what was kept. Each filter is read and
   * rejected before it reaches SQL, so a value never becomes part of a
   * statement.
   */
  function readFilters(query: Record<string, unknown>): { where: string; parameters: (string | number)[] } {
    const conditions: string[] = [];
    const parameters: (string | number)[] = [];

    const plantingId = query['plantingId'];
    if (typeof plantingId === 'string' && plantingId !== '') {
      conditions.push('p.id = ?');
      parameters.push(requireId(plantingId));
    }

    const kept = query['kept'];
    if (typeof kept === 'string' && kept !== '') {
      if (kept !== 'true' && kept !== 'false') {
        throw invalidField('kept', 'Seeds kept must be true or false.');
      }
      conditions.push('ss.kept = ?');
      parameters.push(kept === 'true' ? 1 : 0);
    }

    return { where: conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`, parameters };
  }

  router.get('/seed-saves', async (request, response) => {
    const { where, parameters } = readFilters(request.query as Record<string, unknown>);
    // Most recently saved first, which is how a seed drawer is rummaged.
    const rows = await database.query<SeedSaveRow[]>(
      `SELECT ${seedSaveColumns} ${seedSaveFrom} ${where} ORDER BY ss.savedOn DESC, ss.id DESC`,
      parameters,
    );
    response.json({ seedSaves: rows.map(toSeedSave) });
  });

  router.post('/harvests/:harvestId/seed-saves', async (request, response) => {
    const harvestId = requireId(request.params.harvestId);
    const input = readInput(request.body);

    const seedSave = await database.withTransaction(async (connection) => {
      await assertHarvestExists(connection, harvestId);
      const [result] = await connection.execute<ResultSetHeader>(insertSql, [harvestId, ...columnValues(input)]);
      return toSeedSave(await loadSeedSave(connection, result.insertId));
    });

    response.status(201).json({ seedSave });
  });

  router.put('/seed-saves/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const input = readInput(request.body);

    const seedSave = await database.withTransaction(async (connection) => {
      await loadSeedSave(connection, id);
      await connection.execute(updateSql, [...columnValues(input), id]);
      return toSeedSave(await loadSeedSave(connection, id));
    });

    response.json({ seedSave });
  });

  router.delete('/seed-saves/:id', async (request, response) => {
    const id = requireId(request.params.id);

    await database.withTransaction(async (connection) => {
      await loadSeedSave(connection, id);
      await connection.execute(deleteSql, [id]);
    });

    response.status(204).end();
  });

  return router;
}
