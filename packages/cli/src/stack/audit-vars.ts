import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';

const WITH_AUDIT_STORE = ['knex', 'drizzle'];

/** Where the audit trail is kept: its SQL store with knex and drizzle, the memory of the process with anything else. */
export function auditVars(config: Config): RenderContext {
  const { audit, orm, http, routes } = config.stack;
  const on = audit === 'on';
  const sql = on && WITH_AUDIT_STORE.includes(orm);

  return {
    on,
    off: !on,
    sql,
    memory: on && !sql,
    knex: on && orm === 'knex',
    drizzle: on && orm === 'drizzle',
    route: on && http !== 'none',
    functionRoute: on && http !== 'none' && routes === 'functions',
    controller: on && http !== 'none' && routes === 'controllers',
  };
}
