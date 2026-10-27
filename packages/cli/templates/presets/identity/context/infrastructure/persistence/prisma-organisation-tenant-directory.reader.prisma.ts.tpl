import type { TenantDirectory } from '@ddd-ts-kit/kernel';
import type { Database } from '{{alias.platform}}/database/database{{alias.ext}}';

/**
 * The tenants are the organisations of the application, read from the database each time a job
 * declared `per-tenant` has its occurrence: an organisation opened after the boot gets its run
 * at the next one, where a fixed list (`TENANTS`) would miss it.
 */
export class PrismaOrganisationTenantDirectory implements TenantDirectory {
  constructor(private readonly database: Database) {}

  async tenants(): Promise<readonly string[]> {
    const rows = await organisationsOf(this.database).findMany({ select: { id: true }, orderBy: { id: 'asc' } });

    return rows.map((row) => row.id);
  }
}

/** The organisations on the client of the unit of work, which every statement of this file goes through. */
function organisationsOf(database: Database): ReturnType<Database['client']>['{{context.camel}}Organisation'] {
  return database.client().{{context.camel}}Organisation;
}
