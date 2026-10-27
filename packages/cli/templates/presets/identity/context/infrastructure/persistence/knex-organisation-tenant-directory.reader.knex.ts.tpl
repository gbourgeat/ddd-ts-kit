import type { Knex } from 'knex';
import type { TenantDirectory } from '@ddd-ts-kit/kernel';
import type { KnexContext } from '@ddd-ts-kit/knex';
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import type { OrganisationRow } from '{{alias.context}}/infrastructure/persistence/organisation-row.schema{{alias.ext}}';

/**
 * The tenants are the organisations of the application, read from the database each time a job
 * declared `per-tenant` has its occurrence: an organisation opened after the boot gets its run
 * at the next one, where a fixed list (`TENANTS`) would miss it.
 */
export class KnexOrganisationTenantDirectory implements TenantDirectory {
  constructor(private readonly database: KnexContext) {}

  async tenants(): Promise<readonly string[]> {
    const rows = await tableOf(this.database).select('id').orderBy('id');

    return rows.map((row) => row.id);
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<OrganisationRow, OrganisationRow[]> {
  const table = database.executor()<OrganisationRow, OrganisationRow[]>('organisations');

  return table.withSchema({{context.constant}}_SCHEMA);
}
