import express from 'express';
import type { Database } from '../db/pool.js';
import { invalidField, optionalDate, requireId } from '../validation.js';

/**
 * The aggregation endpoints behind the dashboard.
 *
 * Every statistic answers over the same scope: an optional date window on the
 * event the statistic is about, plus an optional species and area filter.
 * Nothing here writes, so every route is a single read.
 *
 * Numbers come back as raw counts and totals. Percentages, averages across
 * charts and anything else derived is left to the dashboard, so what a panel
 * shows can be checked against a manual count.
 */
type StatFilters = {
  from: string | null;
  to: string | null;
  speciesId: number | null;
  areaId: number | null;
};

/** A `:id` filter that is absent rather than wrong: nothing to filter on. */
function optionalId(query: Record<string, unknown>, field: string): number | null {
  const raw = query[field];
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') throw invalidField(field, `${field} must be a whole number.`);
  return requireId(raw);
}

function readFilters(query: Record<string, unknown>): StatFilters {
  return {
    from: optionalDate(query, 'from', { label: 'From' }),
    to: optionalDate(query, 'to', { label: 'To' }),
    speciesId: optionalId(query, 'speciesId'),
    areaId: optionalId(query, 'areaId'),
  };
}

/**
 * The WHERE clause every statistic shares. The column is a name written in
 * this file, never user input, and every value travels as a placeholder.
 * The date column differs per statistic: harvests count from the pick, care
 * from the visit, issues from the day they opened, plantings from the day
 * they went in.
 */
function scopeClause(filters: StatFilters, dateColumn: string): { sql: string; parameters: (string | number)[] } {
  const parts: string[] = [];
  const parameters: (string | number)[] = [];

  if (filters.from !== null) {
    parts.push(`${dateColumn} >= ?`);
    parameters.push(filters.from);
  }
  if (filters.to !== null) {
    parts.push(`${dateColumn} <= ?`);
    parameters.push(filters.to);
  }
  if (filters.speciesId !== null) {
    parts.push('p.speciesId = ?');
    parameters.push(filters.speciesId);
  }
  if (filters.areaId !== null) {
    parts.push('p.areaId = ?');
    parameters.push(filters.areaId);
  }

  return { sql: parts.length === 0 ? '' : `WHERE ${parts.join(' AND ')}`, parameters };
}

/** mysql2 hands back DECIMAL and AVG as text, so every figure is parsed here. */
function numberOf(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** A nullable text column, where an empty string means the same as nothing. */
function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** The dashboard filters a chart by unit, so the unit travels with each figure. */
type YieldRow = {
  unit: string;
  total: number;
  harvestCount: number;
};

type SpeciesYieldRow = YieldRow & {
  species: { id: number; name: string; variety: string | null };
};

type AreaYieldRow = YieldRow & {
  area: { id: number; name: string };
};

type PeriodRow = YieldRow & {
  period: string;
};

type CareRow = {
  species: { id: number; name: string; variety: string | null };
  watered: number;
  pruned: number;
};

type IssueRow = {
  kind: string;
  severity: string;
  count: number;
};

export function createStatsRouter(database: Database) {
  const router = express.Router();

  /** Yield, split by species and by unit, because kilograms and pieces do not add up. */
  router.get('/stats/yield-by-species', async (request, response) => {
    const filters = readFilters(request.query as Record<string, unknown>);
    const scope = scopeClause(filters, 'h.harvestedOn');

    const rows = await database.query<Record<string, unknown>[]>(
      `SELECT s.id AS speciesId, s.name AS speciesName, s.variety AS speciesVariety, h.unit AS unit,
              SUM(h.quantity) AS total, COUNT(*) AS harvestCount
       FROM Harvest h
       JOIN Planting p ON p.id = h.plantingId
       JOIN Species s ON s.id = p.speciesId
       ${scope.sql}
       GROUP BY s.id, s.name, s.variety, h.unit
       ORDER BY total DESC, s.name ASC`,
      scope.parameters,
    );

    response.json({
      rows: rows.map(
        (row): SpeciesYieldRow => ({
          species: {
            id: numberOf(row['speciesId']),
            name: String(row['speciesName']),
            variety: textOrNull(row['speciesVariety']),
          },
          unit: String(row['unit']).toLowerCase(),
          total: numberOf(row['total']),
          harvestCount: numberOf(row['harvestCount']),
        }),
      ),
    });
  });

  /** The same yield, read by the bed it came out of. */
  router.get('/stats/yield-by-area', async (request, response) => {
    const filters = readFilters(request.query as Record<string, unknown>);
    const scope = scopeClause(filters, 'h.harvestedOn');

    const rows = await database.query<Record<string, unknown>[]>(
      `SELECT a.id AS areaId, a.name AS areaName, h.unit AS unit,
              SUM(h.quantity) AS total, COUNT(*) AS harvestCount
       FROM Harvest h
       JOIN Planting p ON p.id = h.plantingId
       JOIN GardenArea a ON a.id = p.areaId
       ${scope.sql}
       GROUP BY a.id, a.name, h.unit
       ORDER BY total DESC, a.name ASC`,
      scope.parameters,
    );

    response.json({
      rows: rows.map(
        (row): AreaYieldRow => ({
          area: { id: numberOf(row['areaId']), name: String(row['areaName']) },
          unit: String(row['unit']).toLowerCase(),
          total: numberOf(row['total']),
          harvestCount: numberOf(row['harvestCount']),
        }),
      ),
    });
  });

  /** What came out, month by month, for the season shape. */
  router.get('/stats/harvests-over-time', async (request, response) => {
    const filters = readFilters(request.query as Record<string, unknown>);
    const scope = scopeClause(filters, 'h.harvestedOn');

    const rows = await database.query<Record<string, unknown>[]>(
      `SELECT DATE_FORMAT(h.harvestedOn, '%Y-%m') AS period, h.unit AS unit,
              SUM(h.quantity) AS total, COUNT(*) AS harvestCount
       FROM Harvest h
       JOIN Planting p ON p.id = h.plantingId
       ${scope.sql}
       GROUP BY DATE_FORMAT(h.harvestedOn, '%Y-%m'), h.unit
       ORDER BY period ASC`,
      scope.parameters,
    );

    response.json({
      rows: rows.map(
        (row): PeriodRow => ({
          period: String(row['period']),
          unit: String(row['unit']).toLowerCase(),
          total: numberOf(row['total']),
          harvestCount: numberOf(row['harvestCount']),
        }),
      ),
    });
  });

  /**
   * How long a plant takes to flower and to fruit, counted from the sowing
   * milestone when one was recorded and from the planting date otherwise, so
   * a planting without a sowing entry still contributes. Each average reports
   * how many plantings it was taken over, because an average of one is not
   * a trend.
   */
  router.get('/stats/timing', async (request, response) => {
    const filters = readFilters(request.query as Record<string, unknown>);
    const scope = scopeClause(filters, 'p.plantedOn');

    const rows = await database.query<Record<string, unknown>[]>(
      `SELECT COUNT(flowerDays) AS flowerCount, AVG(flowerDays) AS avgDaysToFlower,
              COUNT(fruitDays) AS fruitCount, AVG(fruitDays) AS avgDaysToFruit
       FROM (
         SELECT DATEDIFF(firstFlowerOn, startOn) AS flowerDays,
                DATEDIFF(firstFruitOn, startOn) AS fruitDays
         FROM (
           SELECT COALESCE(sown.occurredOn, p.plantedOn) AS startOn,
                  flower.occurredOn AS firstFlowerOn,
                  fruit.occurredOn AS firstFruitOn
           FROM Planting p
           LEFT JOIN (
             SELECT plantingId, MIN(occurredOn) AS occurredOn FROM Milestone WHERE kind = 'SOWN' GROUP BY plantingId
           ) sown ON sown.plantingId = p.id
           LEFT JOIN (
             SELECT plantingId, MIN(occurredOn) AS occurredOn FROM Milestone WHERE kind = 'FIRST_FLOWER' GROUP BY plantingId
           ) flower ON flower.plantingId = p.id
           LEFT JOIN (
             SELECT plantingId, MIN(occurredOn) AS occurredOn FROM Milestone WHERE kind = 'FIRST_FRUIT' GROUP BY plantingId
           ) fruit ON fruit.plantingId = p.id
           ${scope.sql}
         ) timings
       ) counted`,
      scope.parameters,
    );

    const row = rows[0] ?? {};
    response.json({
      firstFlower: {
        averageDays: row['avgDaysToFlower'] === null ? null : numberOf(row['avgDaysToFlower']),
        count: numberOf(row['flowerCount']),
      },
      firstFruit: {
        averageDays: row['avgDaysToFruit'] === null ? null : numberOf(row['avgDaysToFruit']),
        count: numberOf(row['fruitCount']),
      },
    });
  });

  /** Watering and pruning counts per species inside the chosen window. */
  router.get('/stats/care-frequency', async (request, response) => {
    const filters = readFilters(request.query as Record<string, unknown>);
    const scope = scopeClause(filters, 'c.performedOn');

    const rows = await database.query<Record<string, unknown>[]>(
      `SELECT s.id AS speciesId, s.name AS speciesName, s.variety AS speciesVariety,
              SUM(CASE WHEN c.kind = 'WATERED' THEN 1 ELSE 0 END) AS watered,
              SUM(CASE WHEN c.kind = 'PRUNED' THEN 1 ELSE 0 END) AS pruned
       FROM CareLog c
       JOIN Planting p ON p.id = c.plantingId
       JOIN Species s ON s.id = p.speciesId
       ${scope.sql}
       GROUP BY s.id, s.name, s.variety
       ORDER BY watered DESC, pruned DESC, s.name ASC`,
      scope.parameters,
    );

    response.json({
      rows: rows.map(
        (row): CareRow => ({
          species: {
            id: numberOf(row['speciesId']),
            name: String(row['speciesName']),
            variety: textOrNull(row['speciesVariety']),
          },
          watered: numberOf(row['watered']),
          pruned: numberOf(row['pruned']),
        }),
      ),
    });
  });

  /**
   * Survival, counted from the died milestone rather than the planting status,
   * since a planting can end without the plant dying: cleared after harvest
   * is an ending, not a death.
   */
  router.get('/stats/survival', async (request, response) => {
    const filters = readFilters(request.query as Record<string, unknown>);
    const scope = scopeClause(filters, 'p.plantedOn');

    const rows = await database.query<Record<string, unknown>[]>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN p.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN died.plantingId IS NOT NULL THEN 1 ELSE 0 END) AS died
       FROM Planting p
       LEFT JOIN (SELECT DISTINCT plantingId FROM Milestone WHERE kind = 'DIED') died ON died.plantingId = p.id
       ${scope.sql}`,
      scope.parameters,
    );

    const row = rows[0] ?? {};
    const total = numberOf(row['total']);
    const active = numberOf(row['active']);
    response.json({
      total,
      active,
      ended: total - active,
      died: numberOf(row['died']),
    });
  });

  /**
   * Issues split by type and severity in one pass, so the two charts on the
   * dashboard are read from the same counts. Ordered by how common each
   * combination is: these columns are ENUMs, and MySQL sorts those by the
   * order the values were declared rather than by name.
   */
  router.get('/stats/issues', async (request, response) => {
    const filters = readFilters(request.query as Record<string, unknown>);
    const scope = scopeClause(filters, 'i.openedOn');

    const rows = await database.query<Record<string, unknown>[]>(
      `SELECT i.kind AS kind, i.severity AS severity, COUNT(*) AS count
       FROM Issue i
       JOIN Planting p ON p.id = i.plantingId
       ${scope.sql}
       GROUP BY i.kind, i.severity
       ORDER BY COUNT(*) DESC, i.kind ASC, i.severity ASC`,
      scope.parameters,
    );

    response.json({
      rows: rows.map(
        (row): IssueRow => ({
          kind: String(row['kind']).toLowerCase(),
          severity: String(row['severity']).toLowerCase(),
          count: numberOf(row['count']),
        }),
      ),
    });
  });

  return router;
}
