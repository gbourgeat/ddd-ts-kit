import process from 'node:process';

// Read by the knex CLI (`npm run db:migrate`, `npm run db:generate <name>`). The migrations
// call the compiled schema of the application: run `npm run build` first.
export default {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: { directory: './migrations', loadExtensions: ['.js'] },
};
