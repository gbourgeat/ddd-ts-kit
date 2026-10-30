import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// The Prisma CLI reads no .env: `npm run db:migrate` finds DATABASE_URL there, and what the shell sets wins.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  // Every .prisma file of the folder: schema.prisma (the client, the datasource, the platform) and one file per context.
  schema: './prisma/schema',
  migrations: { path: './prisma/migrations' },
  // `generate` and `migrate diff` never connect: they work without a database.
  // SHADOW_DATABASE_URL: `npm run db:generate` replays the migrations there when no DATABASE_URL names a server.
  datasource: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://unused:unused@127.0.0.1:1/unused',
    shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
  },
});
