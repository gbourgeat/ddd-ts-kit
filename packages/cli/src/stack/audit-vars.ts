import type { Config } from '../config';
import type { RenderContext } from '../templating';

const WITH_AUDIT_STORE = ['knex', 'drizzle', 'prisma', 'typeorm'];

/** Where the audit trail is kept: its SQL store with one of the four ORMs, the memory of the process without one. */
export function auditVars(config: Config): RenderContext {
  const { audit, orm, http, routes, storage } = config.stack;
  const on = audit === 'on';
  const sql = on && WITH_AUDIT_STORE.includes(orm);

  return {
    on,
    off: !on,
    sql,
    memory: on && !sql,
    ...archiveOf(sql, storage),
    ...storeOf(on ? orm : 'none'),
    /** The ORMs whose platform declares the schema of the trail in `database/schema.ts`; Prisma declares it in `prisma/schema/schema.prisma`. */
    schemaFile: sql && orm !== 'prisma',
    ...readSideOf(on && http !== 'none', routes),
  };
}

/**
 * The monthly archive of the oldest entries: a trail in a database, and a storage for the files.
 * On by default in an object store only: the files of a local storage are on the disk of the
 * server, which a redeployment may wipe and a backup may not reach, and an archive removes the
 * entries from the database.
 */
function archiveOf(sql: boolean, storage: string): RenderContext {
  const archive = sql && storage !== 'none';

  return { archive, archiveByDefault: archive && storage === 's3', archiveOnRequest: archive && storage !== 's3' };
}

/** The route that searches the trail, written as a function or a controller; none without HTTP. */
function readSideOf(route: boolean, routes: string): RenderContext {
  return { route, functionRoute: route && routes === 'functions', controller: route && routes !== 'functions' };
}

/** The store of the trail, by the ORM of the project; none of them with the trail off. */
function storeOf(orm: string): RenderContext {
  return { knex: orm === 'knex', drizzle: orm === 'drizzle', prisma: orm === 'prisma', typeorm: orm === 'typeorm' };
}
