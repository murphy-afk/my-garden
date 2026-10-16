import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { readDatabaseConfig, toConnectionString } from './src/db/config.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: toConnectionString(readDatabaseConfig()),
  },
});
