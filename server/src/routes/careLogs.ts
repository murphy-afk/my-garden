import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import express from 'express';
import { queryRows, type Database } from '../db/pool.js';
import { ApiError } from '../errors.js';
import {
  optionalNumber,
  optionalDate,
  optionalText,
  readBody,
  requireChoice,
  requireId,
} from '../validation.js';

/**
 * The care words the brief asks about: how often a plant was watered, cut or
 * tied up, and whether it was fed. The database also holds mulched, reppotted,
 * thinned and other, which are deliberately not offered until they are wanted.
 */
const kinds = ['watered', 'pruned', 'tied', 'fed'] as const;
type CareKind = (typeof kinds)[number];

const careColumns = 'id, plantingId, kind, performedOn, amount, note';

type CareRow = {
  id: number;
  plantingId: number;
  kind: string;
  /** 'YYYY-MM-DD', from the pool's dateStrings setting. */
  performedOn: string;
  /** DECIMAL comes back as text, so it is parsed on the way out. */
  amount: string | null;
  note: string | null;
};

type CareLog = {
  id: number;
  plantingId: number;
  kind: CareKind;
  performedOn: string;
  amount: number | null;
  note: string | null;
};

/** The editable fields. The planting comes from the path, never the body. */
type CareInput = {
  kind: CareKind;
  /** Null on create means "today", because a quick add carries no date. */
  performedOn: string | null;
  amount: number | null;
  note: string | null;
};

/** Row to API shape. The enum column is constrained by MySQL, so lowering it is safe. */
function toCareLog(row: CareRow): CareLog {
  return {
    id: row.id,
    plantingId: row.plantingId,
    kind: row.kind.toLowerCase() as CareKind,
    performedOn: row.performedOn,
    amount: row.amount === null ? null : Number(row.amount),
    note: row.note,
  };
}

/** Today in the API's own format, used when a quick add carries no date. */
function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Reads the editable fields from a request body, failing on the first problem. */
function readInput(body: unknown): CareInput {
  const fields = readBody(body);
  return {
    kind: requireChoice(fields, 'kind', kinds, { label: 'Care type' }),
    performedOn: optionalDate(fields, 'performedOn', { label: 'Date' }),
    amount: optionalNumber(fields, 'amount', { min: 0, max: 999999.99, label: 'Amount' }),
    note: optionalText(fields, 'note', { maxLength: 4000, label: 'Note' }),
  };
}

/** The values the INSERT and UPDATE statements share, in column order. */
function columnValues(input: CareInput, performedOn: string): (string | number | null)[] {
  return [input.kind.toUpperCase(), performedOn, input.amount, input.note];
}

const insertSql = 'INSERT INTO CareLog (plantingId, kind, performedOn, amount, note) VALUES (?, ?, ?, ?, ?)';

const updateSql = 'UPDATE CareLog SET kind = ?, performedOn = ?, amount = ?, note = ? WHERE id = ?';

const deleteSql = 'DELETE FROM CareLog WHERE id = ?';

function careNotFound(id: number): ApiError {
  return new ApiError(404, 'care_log_not_found', `No care log with id ${id}.`);
}

function plantingNotFound(plantingId: number): ApiError {
  return new ApiError(404, 'planting_not_found', `No planting with id ${plantingId}.`);
}

/** Reads one care log inside the caller's transaction, or answers 404. */
async function loadCareLog(connection: PoolConnection, id: number): Promise<CareRow> {
  const rows = await queryRows<CareRow[]>(connection, `SELECT ${careColumns} FROM CareLog WHERE id = ?`, [id]);
  const row = rows[0];
  if (row === undefined) throw careNotFound(id);
  return row;
}

/**
 * Care hangs off a planting, so a nested path names a planting that has to
 * exist before anything is written under it.
 */
async function assertPlantingExists(connection: PoolConnection, plantingId: number): Promise<void> {
  const rows = await queryRows<{ id: number }[]>(connection, 'SELECT id FROM Planting WHERE id = ?', [plantingId]);
  if (rows.length === 0) throw plantingNotFound(plantingId);
}

export function createCareLogsRouter(database: Database) {
  const router = express.Router();

  router.get('/plantings/:plantingId/care-logs', async (request, response) => {
    const plantingId = requireId(request.params.plantingId);

    await database.withTransaction(async (connection) => {
      await assertPlantingExists(connection, plantingId);
      const rows = await queryRows<CareRow[]>(
        connection,
        `SELECT ${careColumns} FROM CareLog WHERE plantingId = ? ORDER BY performedOn DESC, id DESC`,
        [plantingId],
      );
      response.json({ careLogs: rows.map(toCareLog) });
    });
  });

  router.post('/plantings/:plantingId/care-logs', async (request, response) => {
    const plantingId = requireId(request.params.plantingId);
    const input = readInput(request.body);
    const performedOn = input.performedOn ?? todayIsoDate();

    const careLog = await database.withTransaction(async (connection) => {
      await assertPlantingExists(connection, plantingId);
      const [result] = await connection.execute<ResultSetHeader>(insertSql, [
        plantingId,
        ...columnValues(input, performedOn),
      ]);
      return toCareLog(await loadCareLog(connection, result.insertId));
    });

    response.status(201).json({ careLog });
  });

  router.put('/care-logs/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const input = readInput(request.body);
    // The date is optional so a quick add can carry none. The edit form
    // always sends one, so this fallback only ever fires for a bare request.
    const performedOn = input.performedOn ?? todayIsoDate();

    const careLog = await database.withTransaction(async (connection) => {
      await loadCareLog(connection, id);
      await connection.execute(updateSql, [...columnValues(input, performedOn), id]);
      return toCareLog(await loadCareLog(connection, id));
    });

    response.json({ careLog });
  });

  router.delete('/care-logs/:id', async (request, response) => {
    const id = requireId(request.params.id);

    await database.withTransaction(async (connection) => {
      await loadCareLog(connection, id);
      await connection.execute(deleteSql, [id]);
    });

    response.status(204).end();
  });

  return router;
}
