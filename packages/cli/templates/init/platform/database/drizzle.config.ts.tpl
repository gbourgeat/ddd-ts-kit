import type { Config } from 'drizzle-kit';

export default {
  dialect: 'postgresql',
  schema: './{{config.platformDir}}/database/schema.ts',
  out: './migrations',
  // `<timestamp>_<what-it-does>.sql` (`npm run db:generate add-invoices`): two branches never write the same file.
  migrations: { prefix: 'timestamp' },
  dbCredentials: { url: process.env['DATABASE_URL'] ?? '' },
} satisfies Config;
