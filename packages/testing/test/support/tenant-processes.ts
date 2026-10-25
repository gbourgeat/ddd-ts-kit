import { ConcurrencyError, tenantScopeOf, type ExecutionScope, type StoredProcess } from '@ddd-ts-kit/kernel';
import type { ProcessStoreUnderContract } from '../../src/contracts';

/**
 * A process store in memory that keys each instance by its tenant, the empty text outside any:
 * `inTenant(scope)` is a view of the same instances in the tenant of the work.
 */
export class TenantProcesses implements ProcessStoreUnderContract {
  constructor(
    private readonly instances = new Map<string, StoredProcess>(),
    private readonly tenant?: ExecutionScope,
  ) {}

  inTenant(scope: ExecutionScope): TenantProcesses {
    return new TenantProcesses(this.instances, scope);
  }

  async load(name: string, id: string): Promise<StoredProcess | undefined> {
    const stored = this.instances.get(this.keyOf(name, id));

    return stored === undefined ? undefined : structuredClone(stored);
  }

  async save(process: StoredProcess): Promise<void> {
    const key = this.keyOf(process.name, process.id);
    const current = this.instances.get(key)?.version ?? 0;

    if (process.version !== current + 1) {
      throw new ConcurrencyError(key);
    }

    this.instances.set(key, structuredClone(process));
  }

  private keyOf(name: string, id: string): string {
    const tenant = this.tenant === undefined ? '' : tenantScopeOf(this.tenant).tenantId;

    return `${tenant}:${name}:${id}`;
  }
}
