import { createRequire } from 'node:module';
import process from 'node:process';

// Read by the knex CLI (`npm run db:migrate`, `npm run db:generate <what-it-does>`). The migrations
// call the compiled schema of the application: run `npm run build` first. A new migration is
// `<timestamp>_<what-it-does>.js`, written from the ES module stub of knex: the project is ESM.
export default {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: './migrations',
    loadExtensions: ['.js'],
    stub: createRequire(import.meta.url).resolve('knex/lib/migrations/migrate/stub/mjs.stub'),
  },
};
