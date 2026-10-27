import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Every .prisma file of the folder: schema.prisma (the client, the datasource, the platform) and one file per context.
  schema: './prisma/schema',
  migrations: { path: './prisma/migrations' },
  // `generate` and `migrate diff` never connect: they work without a database.
  datasource: { url: process.env['DATABASE_URL'] ?? 'postgresql://unused:unused@127.0.0.1:1/unused' },
});
