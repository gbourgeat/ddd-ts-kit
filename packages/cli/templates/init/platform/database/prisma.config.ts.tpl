import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: { path: './prisma/migrations' },
  // `generate` and `migrate diff` never connect: they work without a database.
  datasource: { url: process.env['DATABASE_URL'] ?? 'postgresql://unused:unused@127.0.0.1:1/unused' },
});
