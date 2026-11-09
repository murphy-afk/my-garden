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
  requireText,
} from '../validation.js';

/** What went wrong, in the words the schema stores. */
const kinds = ['pest', 'disease', 'nutrient_deficiency', 'weather_damage', 'physical_damage', 'competition', 'other'] as const;
type IssueKind = (typeof kinds)[number];

const severities = ['low', 'medium', 'high'] as const;
type IssueSeverity = (typeof severities)[number];

const statuses = ['open', 'monitoring', 'resolved'] as const;
type IssueStatus = (typeof statuses)[number];

/**
 * Every column the API returns, with the planting's species and area joined
 * in, so a list of issues says what was affected without a call per row.
 */
const issueColumns = `
  i.id, i.plantingId, i.kind, i.title, i.description, i.severity, i.status, i.openedOn, i.resolvedOn, i.resolution,
  s.name AS speciesName, s.variety AS speciesVariety, a.id AS areaId, a.name AS areaName
`;

const issueFrom = `
  FROM Issue i
  JOIN Planting p ON p.id = i.plantingId
  JOIN Species s ON s.id = p.speciesId
  JOIN GardenArea a ON a.id = p.areaId
`;

type IssueRow = {
  id: number;
  plantingId: number;
  kind: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  /** 'YYYY-MM-DD', from the pool's dateStrings setting. */
  openedOn: string;
  resolvedOn: string | null;
  resolution: string | null;
  speciesName: string;
  speciesVariety: string | null;
  areaId: number;
  areaName: string;
};

type Issue = {
  id: number;
  planting: {
    id: number;
    species: { name: string; variety: string | null };
    area: { id: number; name: string };
  };
  kind: IssueKind;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  openedOn: string;
  resolvedOn: string | null;
  resolution: string | null;
};

/** The editable fields. The planting comes from the path, never the body. */
type IssueInput = {
  kind: IssueKind;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  openedOn: string;
  resolvedOn: string | null;
  resolution: string | null;
};

/** Row to API shape. The enum columns are constrained by MySQL, so lowering them is safe. */
function toIssue(row: IssueRow): Issue {
  return {
    id: row.id,
    planting: {
      id: row.plantingId,
      species: { name: row.speciesName, variety: row.speciesVariety },
      area: { id: row.areaId, name: row.areaName },
    },
    kind: row.kind.toLowerCase() as IssueKind,
    title: row.title,
    description: row.description,
    severity: row.severity.toLowerCase() as IssueSeverity,
    status: row.status.toLowerCase() as IssueStatus,
    openedOn: row.openedOn,
    resolvedOn: row.resolvedOn,
    resolution: row.resolution,
  };
}

/**
 * The two date fields have to agree with the status: a resolved issue needs
 * the date it was resolved, anything else has none, and the resolution itself
 * belongs to a resolved issue. Neither can fall before the issue opened.
 */
function assertDatesFitStatus(status: IssueStatus, openedOn: string, resolvedOn: string | null, resolution: string | null): void {
  if (status === 'resolved' && resolvedOn === null) {
    throw invalidField('resolvedOn', 'A resolution date is required once the issue is resolved.');
  }
  if (status !== 'resolved' && resolvedOn !== null) {
    throw invalidField('resolvedOn', 'A resolution date only applies once the issue is resolved.');
  }
  if (status !== 'resolved' && resolution !== null) {
    throw invalidField('resolution', 'A resolution only applies once the issue is resolved.');
  }
  if (resolvedOn !== null && resolvedOn < openedOn) {
    throw invalidField('resolvedOn', 'The resolution date cannot be before the issue opened.');
  }
}

/** Reads the editable fields from a request body, failing on the first problem. */
function readInput(body: unknown): IssueInput {
  const fields = readBody(body);
  const input: IssueInput = {
    kind: requireChoice(fields, 'kind', kinds, { label: 'Type' }),
    title: requireText(fields, 'title', { maxLength: 200, label: 'Title' }),
    description: optionalText(fields, 'description', { maxLength: 4000, label: 'Description' }),
    severity: requireChoice(fields, 'severity', severities, { label: 'Severity' }),
    status: requireChoice(fields, 'status', statuses, { label: 'Status' }),
    openedOn: requireDate(fields, 'openedOn', { label: 'Opened on' }),
    resolvedOn: optionalDate(fields, 'resolvedOn', { label: 'Resolved on' }),
    resolution: optionalText(fields, 'resolution', { maxLength: 4000, label: 'Resolution' }),
  };
  assertDatesFitStatus(input.status, input.openedOn, input.resolvedOn, input.resolution);
  return input;
}

/** The values the INSERT and UPDATE statements share, in column order. */
function columnValues(input: IssueInput): (string | number | null)[] {
  return [
    input.kind.toUpperCase(),
    input.title,
    input.description,
    input.severity.toUpperCase(),
    input.status.toUpperCase(),
    input.openedOn,
    input.resolvedOn,
    input.resolution,
  ];
}

const insertSql = `
  INSERT INTO Issue (plantingId, kind, title, description, severity, status, openedOn, resolvedOn, resolution, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))
`;

const updateSql = `
  UPDATE Issue
  SET kind = ?, title = ?, description = ?, severity = ?, status = ?, openedOn = ?, resolvedOn = ?, resolution = ?, updatedAt = CURRENT_TIMESTAMP(3)
  WHERE id = ?
`;

function issueNotFound(id: number): ApiError {
  return new ApiError(404, 'issue_not_found', `No issue with id ${id}.`);
}

function plantingNotFound(plantingId: number): ApiError {
  return new ApiError(404, 'planting_not_found', `No planting with id ${plantingId}.`);
}

/** Reads one issue inside the caller's transaction, or answers 404. */
async function loadIssue(connection: PoolConnection, id: number): Promise<IssueRow> {
  const rows = await queryRows<IssueRow[]>(connection, `SELECT ${issueColumns} ${issueFrom} WHERE i.id = ?`, [id]);
  const row = rows[0];
  if (row === undefined) throw issueNotFound(id);
  return row;
}

/**
 * An issue hangs off a planting, so a nested path names a planting that has
 * to exist before anything is written under it.
 */
async function assertPlantingExists(connection: PoolConnection, plantingId: number): Promise<void> {
  const rows = await queryRows<{ id: number }[]>(connection, 'SELECT id FROM Planting WHERE id = ?', [plantingId]);
  if (rows.length === 0) throw plantingNotFound(plantingId);
}

export function createIssuesRouter(database: Database) {
  const router = express.Router();

  /**
   * The list every view reads: the issues page filters by status, a planting's
   * page by its own id, and the layout view asks for the open ones to know
   * which areas to flag. Each filter is read and rejected before it reaches
   * SQL, so a value never becomes part of a statement.
   */
  function readFilters(query: Record<string, unknown>): { where: string; parameters: (string | number)[] } {
    const conditions: string[] = [];
    const parameters: (string | number)[] = [];

    const status = query['status'];
    if (typeof status === 'string' && status !== '') {
      const match = statuses.find((option) => option === status);
      if (match === undefined) {
        throw invalidField('status', `Status must be one of ${statuses.join(', ')}.`);
      }
      conditions.push('i.status = ?');
      parameters.push(match.toUpperCase());
    }

    const plantingId = query['plantingId'];
    if (typeof plantingId === 'string' && plantingId !== '') {
      conditions.push('i.plantingId = ?');
      parameters.push(requireId(plantingId));
    }

    return { where: conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`, parameters };
  }

  router.get('/issues', async (request, response) => {
    const { where, parameters } = readFilters(request.query as Record<string, unknown>);
    // Newest first, which reads like the season running backwards.
    const rows = await database.query<IssueRow[]>(
      `SELECT ${issueColumns} ${issueFrom} ${where} ORDER BY i.openedOn DESC, i.id DESC`,
      parameters,
    );
    response.json({ issues: rows.map(toIssue) });
  });

  router.post('/plantings/:plantingId/issues', async (request, response) => {
    const plantingId = requireId(request.params.plantingId);
    const input = readInput(request.body);

    const issue = await database.withTransaction(async (connection) => {
      await assertPlantingExists(connection, plantingId);
      const [result] = await connection.execute<ResultSetHeader>(insertSql, [plantingId, ...columnValues(input)]);
      return toIssue(await loadIssue(connection, result.insertId));
    });

    response.status(201).json({ issue });
  });

  router.put('/issues/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const input = readInput(request.body);

    const issue = await database.withTransaction(async (connection) => {
      await loadIssue(connection, id);
      await connection.execute(updateSql, [...columnValues(input), id]);
      return toIssue(await loadIssue(connection, id));
    });

    response.json({ issue });
  });

  return router;
}
