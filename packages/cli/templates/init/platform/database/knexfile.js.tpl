import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';

// The knex CLI reads no .env: `npm run db:migrate` finds DATABASE_URL there, and what the shell sets wins.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Read by the knex CLI (`npm run db:migrate`) and by `npm run db:generate <what-it-does>`, which
// writes `<timestamp>_<what-it-does>.js`, its SQL held in the file: a migration calls nothing of the
// application, so that it builds the same tables whatever the schema becomes. With `--custom`, the
// file is the ES module stub of knex (the project is ESM), to fill by hand.
export default {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: './migrations',
    loadExtensions: ['.js'],
    stub: createRequire(import.meta.url).resolve('knex/lib/migrations/migrate/stub/mjs.stub'),
  },
};
