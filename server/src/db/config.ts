/**
 * Database configuration read from the environment.
 *
 * The variables are kept separate rather than as a single connection string so
 * they are easy to read and edit. Anything that needs a URL, such as Prisma
 * for migrations, builds one with `toConnectionString`.
 */

export type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function readVariable(name: string, allowEmpty = false): string {
  const value = process.env[name];

  if (value === undefined || (!allowEmpty && value.length === 0)) {
    throw new Error(`${name} is not set. Copy server/.env.example to server/.env and fill it in.`);
  }

  return value;
}

export function readDatabaseConfig(): DatabaseConfig {
  const portValue = readVariable('DB_PORT');
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DB_PORT must be a whole number between 1 and 65535, got "${portValue}".`);
  }

  return {
    host: readVariable('DB_HOST'),
    port,
    user: readVariable('DB_USER'),
    password: readVariable('DB_PASSWORD', true),
    database: readVariable('DB_NAME'),
  };
}

/**
 * Builds a MySQL connection string, escaping the credentials so a password
 * containing characters like @ or / still connects.
 */
export function toConnectionString(config: DatabaseConfig): string {
  const user = encodeURIComponent(config.user);
  const password = encodeURIComponent(config.password);
  const database = encodeURIComponent(config.database);

  return `mysql://${user}:${password}@${config.host}:${config.port}/${database}`;
}
