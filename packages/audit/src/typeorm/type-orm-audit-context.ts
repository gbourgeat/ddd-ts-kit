import type { EntityManager } from 'typeorm';

/** The `TypeOrmContext` of `@ddd-ts-kit/typeorm`, restated structurally: any unit of work of that package fits. */
export interface TypeOrmAuditContext {
  manager(): EntityManager;
}
