import { DataSource } from 'typeorm';
import { entities } from '{{alias.platform}}/database/schema{{alias.ext}}';

// Read by the TypeORM CLI only (`npm run db:generate migrations/<what-it-does>`, `npm run db:migrate`), once compiled.
export default new DataSource({
  type: 'postgres',
  url: process.env['DATABASE_URL'] ?? '',
  // One connection when `npm run db:generate` runs on the in-process database, which is one session.
  poolSize: Number(process.env['DATABASE_POOL_SIZE'] ?? 10),
  entities: [...entities],
  migrations: ['dist/migrations/*.js'],
});
