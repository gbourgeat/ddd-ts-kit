import type { SqlRun } from '@ddd-ts-kit/kernel';
import { recordsOf } from '../read-model/records-of';
import type { KnexContext } from '../unit-of-work/knex-context';

/** Runs the statements of the shared PostgreSQL stores on the executor of the context: knex binds `?`, each `$n` is one. */
export function knexSqlRun(context: KnexContext): SqlRun {
  return async (statement, parameters) => {
    const result: unknown = await context.executor().raw(statement.replace(/\$\d+/g, '?'), [...parameters]);

    return recordsOf(typeof result === 'object' && result !== null && 'rows' in result ? result.rows : []);
  };
}
