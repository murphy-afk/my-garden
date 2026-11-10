import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import express from 'express';
import { queryRows, type Database } from '../db/pool.js';
import { ApiError } from '../errors.js';
import {
  invalidField,
  optionalDate,
  optionalText,
  optionalTextList,
  readBody,
  requireChoice,
  requireId,
  requireText,
} from '../validation.js';

/**
 * The library's shelves, in the words the schema stores. The database also
 * holds GENERAL, which is deliberately not offered: these five are the
 * sections the library is organised into.
 */
const categories = ['vegetable_growing', 'flower_care', 'pests_and_disease', 'soil_and_compost', 'seed_saving'] as const;
type GuideCategory = (typeof categories)[number];

/** Every column a list row carries. The body is only read for one guide. */
const guideColumns = 'g.id, g.title, g.slug, g.category, g.summary, g.sourceName, g.sourceUrl, g.publishedOn';

/** The same columns with the body, for the reader. */
const detailColumns = `${guideColumns}, g.body`;

type GuideRow = {
  id: number;
  title: string;
  slug: string;
  category: string;
  summary: string | null;
  body?: string;
  sourceName: string | null;
  sourceUrl: string | null;
  /** 'YYYY-MM-DD', from the pool's dateStrings setting. */
  publishedOn: string | null;
};

type GuideSummary = {
  id: number;
  title: string;
  slug: string;
  category: GuideCategory;
  summary: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  publishedOn: string | null;
  tags: string[];
};

type Guide = GuideSummary & {
  body: string;
};

/** The editable fields. Tags travel as names; the join table is written for them. */
type GuideInput = {
  title: string;
  category: GuideCategory;
  summary: string | null;
  body: string;
  sourceName: string | null;
  sourceUrl: string | null;
  publishedOn: string | null;
  tags: string[];
};

/** Row to API shape. The category column is constrained by MySQL. */
function toGuideSummary(row: GuideRow, tags: string[]): GuideSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category.toLowerCase() as GuideCategory,
    summary: row.summary,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    publishedOn: row.publishedOn,
    tags,
  };
}

/** URL form of a title: lowercase, dashes where anything else was. */
function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Room for a numeric suffix inside the 220 character column.
    .slice(0, 200);

  return slug === '' ? 'guide' : slug;
}

async function slugTaken(connection: PoolConnection, slug: string, excludeId?: number): Promise<boolean> {
  const sql =
    excludeId === undefined
      ? 'SELECT id FROM Guide WHERE slug = ? LIMIT 1'
      : 'SELECT id FROM Guide WHERE slug = ? AND id <> ? LIMIT 1';
  const parameters: (string | number)[] = excludeId === undefined ? [slug] : [slug, excludeId];
  const rows = await queryRows<{ id: number }[]>(connection, sql, parameters);
  return rows.length > 0;
}

/**
 * The first address for this title that nothing else holds, so two guides
 * never share a slug. The suffix counts up from -2.
 */
async function uniqueSlug(connection: PoolConnection, title: string, excludeId?: number): Promise<string> {
  const base = slugify(title);

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (!(await slugTaken(connection, candidate, excludeId))) return candidate;
  }

  throw new ApiError(409, 'guide_slug_taken', 'Another guide already holds this title so closely. Change the title a little.');
}

/** Reads the editable fields from a request body, failing on the first problem. */
function readInput(body: unknown): GuideInput {
  const fields = readBody(body);
  const sourceUrl = optionalText(fields, 'sourceUrl', { maxLength: 500, label: 'Source link' });

  if (sourceUrl !== null && !/^https?:\/\/\S+$/.test(sourceUrl)) {
    throw invalidField('sourceUrl', 'The source link must start with http:// or https://.');
  }

  return {
    title: requireText(fields, 'title', { maxLength: 200, label: 'Title' }),
    category: requireChoice(fields, 'category', categories, { label: 'Category' }),
    summary: optionalText(fields, 'summary', { maxLength: 1000, label: 'Summary' }),
    body: requireText(fields, 'body', { maxLength: 200000, label: 'Guide text' }),
    sourceName: optionalText(fields, 'sourceName', { maxLength: 160, label: 'Source name' }),
    sourceUrl,
    publishedOn: optionalDate(fields, 'publishedOn', { label: 'Published on' }),
    tags: optionalTextList(fields, 'tags', { maxItems: 10, maxLength: 80, label: 'Tags' }),
  };
}

/** The values the INSERT and UPDATE statements share, in column order. */
function columnValues(input: GuideInput, slug: string): (string | number | null)[] {
  return [
    input.title,
    slug,
    input.category.toUpperCase(),
    input.summary,
    input.body,
    input.sourceName,
    input.sourceUrl,
    input.publishedOn,
  ];
}

const insertSql = `
  INSERT INTO Guide (title, slug, category, summary, body, sourceName, sourceUrl, publishedOn, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))
`;

const updateSql = `
  UPDATE Guide
  SET title = ?, slug = ?, category = ?, summary = ?, body = ?, sourceName = ?, sourceUrl = ?, publishedOn = ?, updatedAt = CURRENT_TIMESTAMP(3)
  WHERE id = ?
`;

const deleteSql = 'DELETE FROM Guide WHERE id = ?';

function guideNotFound(id: number): ApiError {
  return new ApiError(404, 'guide_not_found', `No guide with id ${id}.`);
}

/**
 * Writes the tag names a guide carries: the links are rebuilt from scratch,
 * each name is inserted if it is new, and a tag nothing points at any more is
 * dropped so it never shows up as a dead filter.
 */
async function syncTags(connection: PoolConnection, guideId: number, tags: string[]): Promise<void> {
  await connection.execute('DELETE FROM _GuideToTag WHERE A = ?', [guideId]);

  for (const name of tags) {
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO Tag (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
      [name],
    );
    await connection.execute('INSERT IGNORE INTO _GuideToTag (A, B) VALUES (?, ?)', [guideId, result.insertId]);
  }

  await connection.execute('DELETE FROM Tag WHERE id NOT IN (SELECT B FROM _GuideToTag)');
}

/** Tag names for several guides at once, keyed by guide id, alphabetically. */
async function tagsFor(database: Database, guideIds: number[]): Promise<Map<number, string[]>> {
  const byGuide = new Map<number, string[]>();
  if (guideIds.length === 0) return byGuide;

  const placeholders = guideIds.map(() => '?').join(', ');
  const rows = await database.query<{ guideId: number; tagName: string }[]>(
    `SELECT gt.A AS guideId, t.name AS tagName
     FROM _GuideToTag gt
     JOIN Tag t ON t.id = gt.B
     WHERE gt.A IN (${placeholders})
     ORDER BY t.name ASC`,
    guideIds,
  );

  for (const row of rows) {
    const existing = byGuide.get(row.guideId);
    if (existing === undefined) byGuide.set(row.guideId, [row.tagName]);
    else existing.push(row.tagName);
  }

  return byGuide;
}

/** One guide with its body and tags, or a 404 when the id does not exist. */
async function fetchGuide(database: Database, id: number): Promise<Guide> {
  const rows = await database.query<GuideRow[]>(`SELECT ${detailColumns} FROM Guide g WHERE g.id = ?`, [id]);
  const row = rows[0];
  if (row === undefined) throw guideNotFound(id);

  const tags = await tagsFor(database, [id]);
  return { ...toGuideSummary(row, tags.get(id) ?? []), body: row.body ?? '' };
}

export function createGuidesRouter(database: Database) {
  const router = express.Router();

  /**
   * The list every view reads: a shelf at a time, or one tag. Each filter is
   * read and rejected before it reaches SQL, so a value never becomes part of
   * a statement. Bodies are left out here, since a list never shows them.
   */
  function readFilters(query: Record<string, unknown>): { where: string; parameters: (string | number)[] } {
    const conditions: string[] = [];
    const parameters: (string | number)[] = [];

    const category = query['category'];
    if (typeof category === 'string' && category !== '') {
      const match = categories.find((option) => option === category);
      if (match === undefined) {
        throw invalidField('category', `Category must be one of ${categories.join(', ')}.`);
      }
      conditions.push('g.category = ?');
      parameters.push(match.toUpperCase());
    }

    const tag = query['tag'];
    if (typeof tag === 'string' && tag !== '') {
      conditions.push(
        'EXISTS (SELECT 1 FROM _GuideToTag gt JOIN Tag t ON t.id = gt.B WHERE gt.A = g.id AND t.name = ?)',
      );
      parameters.push(tag);
    }

    return { where: conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`, parameters };
  }

  router.get('/guides', async (request, response) => {
    const { where, parameters } = readFilters(request.query as Record<string, unknown>);
    // Alphabetical, which is how a shelf of reference material is read.
    const rows = await database.query<GuideRow[]>(
      `SELECT ${guideColumns} FROM Guide g ${where} ORDER BY g.title ASC`,
      parameters,
    );

    const tags = await tagsFor(database, rows.map((row) => row.id));
    response.json({ guides: rows.map((row) => toGuideSummary(row, tags.get(row.id) ?? [])) });
  });

  router.get('/guides/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const guide = await fetchGuide(database, id);
    if (guide === null) throw guideNotFound(id);
    response.json({ guide });
  });

  router.post('/guides', async (request, response) => {
    const input = readInput(request.body);

    const id = await database.withTransaction(async (connection) => {
      const slug = await uniqueSlug(connection, input.title);
      const [result] = await connection.execute<ResultSetHeader>(insertSql, columnValues(input, slug));
      await syncTags(connection, result.insertId, input.tags);
      return result.insertId;
    });

    const guide = await fetchGuide(database, id);
    response.status(201).json({ guide });
  });

  router.put('/guides/:id', async (request, response) => {
    const id = requireId(request.params.id);
    const input = readInput(request.body);

    await database.withTransaction(async (connection) => {
      const rows = await queryRows<{ id: number }[]>(connection, 'SELECT id FROM Guide WHERE id = ?', [id]);
      if (rows.length === 0) throw guideNotFound(id);

      const slug = await uniqueSlug(connection, input.title, id);
      await connection.execute(updateSql, [...columnValues(input, slug), id]);
      await syncTags(connection, id, input.tags);
    });

    const guide = await fetchGuide(database, id);
    response.json({ guide });
  });

  router.delete('/guides/:id', async (request, response) => {
    const id = requireId(request.params.id);

    await database.withTransaction(async (connection) => {
      const rows = await queryRows<{ id: number }[]>(connection, 'SELECT id FROM Guide WHERE id = ?', [id]);
      if (rows.length === 0) throw guideNotFound(id);

      // The join table follows the guide; tags it leaves behind are swept by
      // the same orphan check the tag sync uses.
      await connection.execute(deleteSql, [id]);
      await connection.execute('DELETE FROM Tag WHERE id NOT IN (SELECT B FROM _GuideToTag)');
    });

    response.status(204).end();
  });

  return router;
}
