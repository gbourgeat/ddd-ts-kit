/**
 * The alias a read or a write goes through does not exist: the tenant was never provisioned
 * (`provision(tenant)`), or the read model never mapped (`ensureMapping()`). The store never
 * creates an index on a write, where a typo would create one.
 */
export class UnprovisionedIndexError extends Error {
  readonly code = 'UNPROVISIONED_INDEX';

  constructor(readonly alias: string) {
    super(`The OpenSearch alias "${alias}" does not exist: provision the tenant, or map the read model, first`);
    this.name = 'UnprovisionedIndexError';
  }
}
