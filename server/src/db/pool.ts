import { createPool, type Pool, type PoolConnection, type QueryValues } from 'mysql2/promise';
import { describeError, logger } from '../logger.js';
import type { DatabaseConfig } from './config.js';

/**
 * Bound values for a statement, taken from the driver so this signature can
 * never drift from what mysql2 accepts: an array for `?` placeholders, or an
 * object for `:name` placeholders.
 */
export type QueryParameters = QueryValues;

export type Database = {
  /** Reads a single result set. Writes go through `withTransaction`. */
  query: <T>(sql: string, parameters?: QueryParameters) => Promise<T>;
  /** Runs work on one connection inside BEGIN, COMMIT and ROLLBACK. */
  withTransaction: <T>(work: (connection: PoolConnection) => Promise<T>) => Promise<T>;
  /** Round trip against the database, returning the latency in milliseconds. */
  ping: () => Promise<number>;
  close: () => Promise<void>;
};

const connectionLimit = 10;

/**
 * The pool every query in the API shares. Connections are checked out and
 * returned per statement, so a slow query never blocks a different route for
 * longer than it takes.
 */
export function createDatabase(config: DatabaseConfig): Database {
  const pool: Pool = createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit,
  });

  async function query<T>(sql: string, parameters: QueryParameters = []): Promise<T> {
    const [rows] = await pool.query(sql, parameters);
    // mysql2 types the rows from the text of the statement, which it cannot
    // know at compile time. The caller names the row shape, and this is where
    // that contract is asserted rather than spread across the call sites.
    return rows as unknown as T;
  }

  async function withTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await pool.getConnection();
    let inTransaction = false;

    try {
      await connection.beginTransaction();
      inTransaction = true;
      const result = await work(connection);
      await connection.commit();
      inTransaction = false;
      return result;
    } catch (error) {
      if (inTransaction) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          // The failure that caused the rollback is the one worth reporting,
          // so it is rethrown below and this is only recorded.
          logger.error('transaction rollback failed', describeError(rollbackError));
        }
      }

      throw error;
    } finally {
      connection.release();
    }
  }

  async function ping(): Promise<number> {
    const startedAt = performance.now();
    await pool.query('SELECT 1');
    return Math.round(performance.now() - startedAt);
  }

  async function close(): Promise<void> {
    await pool.end();
  }

  return { query, withTransaction, ping, close };
}
