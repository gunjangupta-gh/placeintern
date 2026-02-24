/// <reference types="node" />
// Load dotenv if available, but don't fail if it's missing in certain CI/build contexts
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv/config');
} catch (e) {
  // ignore - dotenv may not be installed in minimal build environments
}
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
