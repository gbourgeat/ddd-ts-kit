import { DataSource } from 'typeorm';
import { entities } from './schema.js';

// Read by the TypeORM CLI only (`npm run db:generate`, `npm run db:migrate`), once compiled.
export default new DataSource({
  type: 'postgres',
  url: process.env['DATABASE_URL'] ?? '',
  entities: [...entities],
  migrations: ['dist/migrations/*.js'],
});
