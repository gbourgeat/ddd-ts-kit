import type { OpenSearchReadModelStore } from '@ddd-ts-kit/opensearch';

/** What provisions the index of a store: the store itself, built on the transport of the platform. */
type Provisioned = Pick<OpenSearchReadModelStore<object>, 'ensureMapping' | 'provision'>;

/** The index of one store, provisioned once, or once per tenant: an attempt that failed is made again at the next request. */
export class StoreIndex {
  private mapping: Promise<void> | undefined;
  private readonly tenants = new Map<string, Promise<void>>();

  constructor(private readonly store: Provisioned) {}

  /** Whether the tenant was provisioned, or is being. */
  has(tenant: string): boolean {
    return this.tenants.has(tenant);
  }

  /** Without tenancy: the index and its alias. */
  mapped(): Promise<void> {
    this.mapping ??= this.store.ensureMapping().catch((error: unknown) => {
      this.mapping = undefined;

      throw error;
    });

    return this.mapping;
  }

  /** Under a tenant strategy: the index or the filtered alias of one tenant; its failure is its own. */
  provisioned(tenant: string): Promise<void> {
    const known = this.tenants.get(tenant);

    if (known !== undefined) {
      return known;
    }

    const provisioning = Promise.resolve()
      .then(() => this.store.provision(tenant))
      .catch((error: unknown) => {
        this.tenants.delete(tenant);

        throw error;
      });

    this.tenants.set(tenant, provisioning);

    return provisioning;
  }
}
