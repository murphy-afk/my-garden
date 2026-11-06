import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import express from 'express';
import { queryRows, type Database } from '../db/pool.js';
import { ApiError } from '../errors.js';
import { optionalInteger, optionalText, readBody, requireChoice, requireId, requireText } from '../validation.js';

/** The API speaks these words in lowercase; the database stores the uppercase ENUM. */
const categories = ['vegetable', 'fruit', 'flower', 'herb'] as const;
type Category = (typeof categories)[number];

const cycles = ['annual', 'biennial', 'perennial'] as const;
type Cycle = (typeof cycles)[number];

/** Every column the API returns, so the selects stay in step with each other. */
const speciesColumns =
  'id, name, variety, category, scientificName, cycle, spacingCm, daysToFlower, daysToHarvest, notes, archived';

type SpeciesRow = {
  id: number;
  name: string;
  variety: string | null;
  category: string;
  scientificName: string | null;
  cycle: string;
  spacingCm: number | null;
  daysToFlower: number | null;
  daysToHarvest: number | null;
  notes: string | null;
  archived: number;
};

type Species = {
  id: number;
  name: string;
  variety: string | null;
  category: Category;
  scientificName: string | null;
  cycle: Cycle;
  spacingCm: number | null;
  daysToFlower: number | null;
  daysToHarvest: number | null;
  notes: string | null;
  archived: boolean;
};

type SpeciesInput = Omit<Species, 'id' | 'archived'>;

/** Row to API shape. The enum columns are constrained by MySQL, so lowering them is safe. */
function toSpecies(row: SpeciesRow): Species {
  return {
    id: row.id,
    name: row.name,
    variety: row.variety,
    category: row.category.toLowerCase() as Category,
    scientificName: row.scientificName,
    cycle: row.cycle.toLowerCase() as Cycle,
    spacingCm: row.spacingCm,
    daysToFlower: row.daysToFlower,
    daysToHarvest: row.daysToHarvest,
    notes: row.notes,
    archived: row.archived === 1,
  };
}

/** Reads the editable fields from a request body, failing on the first problem. */
function readInput(body: unknown): SpeciesInput {
  const fields = readBody(body);
  return {
    name: requireText(fields, 'name', { maxLength: 120, label: 'Name' }),
    variety: optionalText(fields, 'variety', { maxLength: 120, label: 'Variety' }),
    category: requireChoice(fields, 'category', categories, { label: 'Category' }),
    scientificName: optionalText(fields, 'scientificName', { maxLength: 160, label: 'Scientific name' }),
    cycle: requireChoice(fields, 'cycle', cycles, { label: 'Life cycle' }),
    spacingCm: optionalInteger(fields, 'spacingCm', { min: 1, max: 10000, label: 'Spacing (cm)' }),
    daysToFlower: optionalInteger(fields, 'daysToFlower', { min: 0, max: 999, label: 'Days to flower' }),
    daysToHarvest: optionalInteger(fields, 'daysToHarvest', { min: 0, max: 999, label: 'Days to harvest' }),
    notes: optionalText(fields, 'notes', { maxLength: 4000, label: 'Notes' }),
  };
}

/** The values the INSERT and UPDATE statements share, in column order. */
function columnValues(input: SpeciesInput): (string | number | null)[] {
  return [
    input.name,
    input.variety,
    input.category.toUpperCase(),
    input.scientificName,
    input.cycle.toUpperCase(),
    input.spacingCm,
    input.daysToFlower,
    input.daysToHarvest,
    input.notes,
  ];
}

const insertSql = `
  INSERT INTO Species (name, variety, category, scientificName, cycle, spacingCm, daysToFlower, daysToHarvest, notes, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))
`;

const updateSql = `
  UPDATE Species
  SET name = ?, variety = ?, category = ?, scientificName = ?, cycle = ?, spacingCm = ?, daysToFlower = ?, daysToHarvest = ?, notes = ?, updatedAt = CURRENT_TIMESTAMP(3)
  WHERE id = ?
`;

const archiveSql = 'UPDATE Species SET archived = ?, updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?';

const duplicateMessage = 'A species with this name and variety already exists.';

function nameTaken(): ApiError {
  return new ApiError(409, 'species_exists', duplicateMessage, { fields: { name: duplicateMessage } });
}

function notFound(id: number): ApiError {
  return new ApiError(404, 'species_not_found', `No species with id ${id}.`);
}

/** MySQL rejects a repeat of the unique (name, variety) index with ER_DUP_ENTRY. */
function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ER_DUP_ENTRY';
}

/**
 * Answers 409 when another species already holds this name and variety.
 * `variety <=> ?` is MySQL's null-safe equality, so two species with no
 * variety collide the same way two with the same variety do, which the
 * unique index alone cannot catch because NULLs compare unequal.
 */
async function assertNameFree(
  connection: PoolConnection,
  name: string,
  variety: string | null,
  excludeId?: number,
): Promise<void> {
  const sql =
    excludeId === undefined
      ? 'SELECT id FROM Species WHERE name = ? AND variety <=> ? LIMIT 1'
      : 'SELECT id FROM Species WHERE name = ? AND variety <=> ? AND id <> ? LIMIT 1';
  const parameters: (string | number | null)[] =
    excludeId === undefined ? [name, variety] : [name, variety, excludeId];
  const rows = await queryRows<{ id: number }[]>(connection, sql, parameters);
  if (rows.length > 0) throw nameTaken();
}

/** Reads one species inside the caller's transaction, or answers 404. */
async function loadSpecies(connection: PoolConnection, id: number): Promise<SpeciesRow> {
  const rows = await queryRows<SpeciesRow[]>(
    connection,
    `SELECT ${speciesColumns} FROM Species WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  if (row === undefined) throw notFound(id);
  return row;
}

export function createSpeciesRouter(database: Database) {
  const router = express.Router();

  router.get('/species', async (request, response) => {
    const includeArchived = request.query['includeArchived'] === 'true';
    // `filter` is a literal chosen from a boolean, never user input.
    const filter = includeArchived ? '' : 'WHERE archived = 0';
    const rows = await database.query<SpeciesRow[]>(
      `SELECT ${speciesColumns} FROM Species ${filter} ORDER BY archived ASC, name ASC, variety ASC`,
    );
    response.json({ species: rows.map(toSpecies) });
  });

  router.get('/species/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const rows = await database.query<SpeciesRow[]>(
      `SELECT ${speciesColumns} FROM Species WHERE id = ?`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound(id);
    response.json({ species: toSpecies(row) });
  });

  router.post('/species', async (request, response) => {
    const input = readInput(request.body);

    const species = await database.withTransaction(async (connection) => {
      await assertNameFree(connection, input.name, input.variety);
      try {
        const [result] = await connection.execute<ResultSetHeader>(insertSql, columnValues(input));
        const created = await loadSpecies(connection, result.insertId);
        return toSpecies(created);
      } catch (error) {
        // The pre-check cannot see a concurrent insert, so the index stays the backstop.
        if (isDuplicateKey(error)) throw nameTaken();
        throw error;
      }
    });

    response.status(201).json({ species });
  });

  router.put('/species/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const input = readInput(request.body);

    const species = await database.withTransaction(async (connection) => {
      const existing = await loadSpecies(connection, id);
      await assertNameFree(connection, input.name, input.variety, id);
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

    response.json({ species });
  });

  async function setArchived(id: number, archived: boolean): Promise<Species> {
    return database.withTransaction(async (connection) => {
      const existing = await loadSpecies(connection, id);
      await connection.execute(archiveSql, [archived ? 1 : 0, id]);
      return { ...toSpecies(existing), archived };
    });
  }

  router.post('/species/:id/archive', async (request, response) => {
    response.json({ species: await setArchived(requireId(request.params.id), true) });
  });

  router.post('/species/:id/restore', async (request, response) => {
    response.json({ species: await setArchived(requireId(request.params.id), false) });
  });

  return router;
}
