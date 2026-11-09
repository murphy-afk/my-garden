import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import express from 'express';
import { queryRows, type Database } from '../db/pool.js';
import { ApiError } from '../errors.js';
import { optionalText, readBody, requireChoice, requireDate, requireId } from '../validation.js';

/**
 * The lifecycle words the timeline speaks, in the order they usually happen.
 * The database also holds HARVEST_ENDED for the harvest work in S10, which is
 * deliberately not offered here yet.
 */
const kinds = [
  'sown',
  'germinated',
  'transplanted',
  'first_flower',
  'first_fruit',
  'beginning_to_decline',
  'died',
] as const;
type MilestoneKind = (typeof kinds)[number];

const milestoneColumns = 'id, plantingId, kind, occurredOn, note';

type MilestoneRow = {
  id: number;
  plantingId: number;
  kind: string;
  /** 'YYYY-MM-DD', from the pool's dateStrings setting. */
  occurredOn: string;
  note: string | null;
};

type Milestone = {
  id: number;
  plantingId: number;
  kind: MilestoneKind;
  occurredOn: string;
  note: string | null;
};

/** The editable fields. The planting comes from the path, never the body. */
type MilestoneInput = {
  kind: MilestoneKind;
  occurredOn: string;
  note: string | null;
};

/** Row to API shape. The enum column is constrained by MySQL, so lowering it is safe. */
function toMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    plantingId: row.plantingId,
    kind: row.kind.toLowerCase() as MilestoneKind,
    occurredOn: row.occurredOn,
    note: row.note,
  };
}

/** Reads the editable fields from a request body, failing on the first problem. */
function readInput(body: unknown): MilestoneInput {
  const fields = readBody(body);
  return {
    kind: requireChoice(fields, 'kind', kinds, { label: 'Milestone' }),
    occurredOn: requireDate(fields, 'occurredOn', { label: 'Date' }),
    note: optionalText(fields, 'note', { maxLength: 4000, label: 'Note' }),
  };
}

/** The values the INSERT and UPDATE statements share, in column order. */
function columnValues(input: MilestoneInput): (string | number | null)[] {
  return [input.kind.toUpperCase(), input.occurredOn, input.note];
}

const insertSql = 'INSERT INTO Milestone (plantingId, kind, occurredOn, note) VALUES (?, ?, ?, ?)';

const updateSql = 'UPDATE Milestone SET kind = ?, occurredOn = ?, note = ? WHERE id = ?';

const deleteSql = 'DELETE FROM Milestone WHERE id = ?';

function milestoneNotFound(id: number): ApiError {
  return new ApiError(404, 'milestone_not_found', `No milestone with id ${id}.`);
}

function plantingNotFound(plantingId: number): ApiError {
  return new ApiError(404, 'planting_not_found', `No planting with id ${plantingId}.`);
}

/** Reads one milestone inside the caller's transaction, or answers 404. */
async function loadMilestone(connection: PoolConnection, id: number): Promise<MilestoneRow> {
  const rows = await queryRows<MilestoneRow[]>(connection, `SELECT ${milestoneColumns} FROM Milestone WHERE id = ?`, [id]);
  const row = rows[0];
  if (row === undefined) throw milestoneNotFound(id);
  return row;
}

/**
 * Milestones hang off a planting, so a nested path names a planting that has
 * to exist before anything is written under it.
 */
async function assertPlantingExists(connection: PoolConnection, plantingId: number): Promise<void> {
  const rows = await queryRows<{ id: number }[]>(connection, 'SELECT id FROM Planting WHERE id = ?', [plantingId]);
  if (rows.length === 0) throw plantingNotFound(plantingId);
}

export function createMilestonesRouter(database: Database) {
  const router = express.Router();

  router.get('/plantings/:plantingId/milestones', async (request, response) => {
    const plantingId = requireId(request.params.plantingId);

    await database.withTransaction(async (connection) => {
      await assertPlantingExists(connection, plantingId);
      const rows = await queryRows<MilestoneRow[]>(
        connection,
        `SELECT ${milestoneColumns} FROM Milestone WHERE plantingId = ? ORDER BY occurredOn ASC, id ASC`,
        [plantingId],
      );
      response.json({ milestones: rows.map(toMilestone) });
    });
  });

  router.post('/plantings/:plantingId/milestones', async (request, response) => {
    const plantingId = requireId(request.params.plantingId);
    const input = readInput(request.body);

    const milestone = await database.withTransaction(async (connection) => {
      await assertPlantingExists(connection, plantingId);
      const [result] = await connection.execute<ResultSetHeader>(insertSql, [
        plantingId,
        ...columnValues(input),
      ]);
      return toMilestone(await loadMilestone(connection, result.insertId));
    });

    response.status(201).json({ milestone });
  });

  router.put('/milestones/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const input = readInput(request.body);

    const milestone = await database.withTransaction(async (connection) => {
      await loadMilestone(connection, id);
      await connection.execute(updateSql, [...columnValues(input), id]);
      return toMilestone(await loadMilestone(connection, id));
    });

    response.json({ milestone });
  });

  router.delete('/milestones/:id', async (request, response) => {
    const id = requireId(request.params.id);

    await database.withTransaction(async (connection) => {
      await loadMilestone(connection, id);
      await connection.execute(deleteSql, [id]);
    });

    response.status(204).end();
  });

  return router;
}
