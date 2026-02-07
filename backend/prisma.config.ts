/// <reference types="node" />
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Use process.env directly with fallback for CI/build environments
// where DATABASE_URL might not be set
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/cms_db?schema=public';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'npx ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
