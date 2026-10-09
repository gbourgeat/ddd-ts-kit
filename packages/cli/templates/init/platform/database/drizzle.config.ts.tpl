import type { Config } from 'drizzle-kit';

export default {
  dialect: 'postgresql',
  schema: './{{config.platformDir}}/database/schema.ts',
  out: './migrations',
  dbCredentials: { url: process.env['DATABASE_URL'] ?? '' },
} satisfies Config;
