import type { TenantDirectory } from '../../application/ports/tenant-directory';
import { assertTenantId } from '../../application/tenancy/assert-tenant-id';

/** The tenants it was given, for tests and for a project whose tenants are configuration; an id outside the grammar is refused. */
export class InMemoryTenantDirectory implements TenantDirectory {
  private readonly ids: readonly string[];

  constructor(ids: readonly string[]) {
    this.ids = ids.map(assertTenantId);
  }

  tenants(): Promise<readonly string[]> {
    return Promise.resolve([...this.ids]);
  }
}
