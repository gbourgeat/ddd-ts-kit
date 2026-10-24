import type { Config } from '../config';
import type { RenderContext } from '../templating';

const WITH_AUDIT_STORE = ['knex', 'drizzle', 'prisma', 'typeorm'];

/** Where the audit trail is kept: its SQL store with one of the four ORMs, the memory of the process without one. */
export function auditVars(config: Config): RenderContext {
  const { audit, orm, http, routes } = config.stack;
  const on = audit === 'on';
  const sql = on && WITH_AUDIT_STORE.includes(orm);

  return {
    on,
    off: !on,
    sql,
    memory: on && !sql,
    ...storeOf(on ? orm : 'none'),
    /** The ORMs whose platform declares the schema of the trail in `database/schema.ts`; Prisma declares it in `prisma/schema.prisma`. */
    schemaFile: sql && orm !== 'prisma',
    route: on && http !== 'none',
    functionRoute: on && http !== 'none' && routes === 'functions',
    controller: on && http !== 'none' && routes === 'controllers',
  };
}

/** The store of the trail, by the ORM of the project; none of them with the trail off. */
function storeOf(orm: string): RenderContext {
  return { knex: orm === 'knex', drizzle: orm === 'drizzle', prisma: orm === 'prisma', typeorm: orm === 'typeorm' };
}
