import type { TenantDirectory } from '@ddd-ts-kit/kernel';
import type { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
import { organisations } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';

/**
 * The tenants are the organisations of the application, read from the database each time a job
 * declared `per-tenant` has its occurrence: an organisation opened after the boot gets its run
 * at the next one, where a fixed list (`TENANTS`) would miss it.
 */
export class DrizzleOrganisationTenantDirectory implements TenantDirectory {
  constructor(private readonly database: Database) {}

  async tenants(): Promise<readonly string[]> {
    const rows = await executorOf(this.database).select({ id: organisations.id }).from(organisations).orderBy(organisations.id);

    return rows.map((row) => row.id);
  }
}

/** The executor of the unit of work, which every statement of this file goes through. */
function executorOf(database: Database): ReturnType<Database['executor']> {
  return database.executor();
}
