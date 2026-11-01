import { tenantReachOf, tenantScopeOf } from '@ddd-ts-kit/kernel';
import type { IndexNames } from '../naming/index-names';
import type { AliasOfIndex } from './index-provisioning';
import type { OpenSearchTenancy } from './open-search-tenancy';

type Query = Readonly<Record<string, unknown>>;

/** Where a get or a write of the work in progress goes, and the tenant its document holds. */
export interface WriteTarget {
  readonly alias: string;
  readonly tenant: string | undefined;
}

/** Where a search goes, the conditions that keep it to its tenants, and whether a missing alias holds nothing. */
export interface SearchTarget {
  readonly alias: string;
  readonly confined: readonly Query[];
  readonly lenient: boolean;
}

/** One index to provide, with its aliases. */
export interface ProvidedIndex {
  readonly index: string;
  readonly aliases: readonly AliasOfIndex[];
}

/**
 * The aliases and conditions of a tenancy strategy. A get and a write reach the tenant of the work
 * (`tenantScopeOf`) and nothing else, whatever an elevation says; a search reaches what
 * `tenantReachOf` allows, its tenant or the tenants of an elevation. Under `attribute` a document
 * of a tenant is `<tenant>:<key>`, so that two tenants never share one document.
 */
export class TenantTargets {
  readonly field: string | undefined;

  constructor(
    private readonly names: IndexNames,
    private readonly tenancy: OpenSearchTenancy,
  ) {
    this.field = tenancy.strategy === 'none' ? undefined : (tenancy.field ?? 'tenantId');
  }

  write(): WriteTarget {
    if (this.tenancy.strategy === 'none') {
      return { alias: this.names.all, tenant: undefined };
    }

    const { tenantId } = tenantScopeOf(this.tenancy.scope);

    return { alias: this.names.aliasOf(tenantId), tenant: tenantId };
  }

  documentId(key: string, tenant: string | undefined): string {
    return this.tenancy.strategy === 'attribute' ? `${String(tenant)}:${key}` : key;
  }

  search(): SearchTarget {
    const { field, tenancy } = this;

    if (tenancy.strategy === 'none' || field === undefined) {
      return { alias: this.names.all, confined: [], lenient: false };
    }

    const reach = tenantReachOf(tenancy.scope);

    if (reach.kind === 'tenant') {
      return {
        alias: this.names.aliasOf(reach.tenantId),
        confined: [{ term: { [field]: reach.tenantId } }],
        lenient: false,
      };
    }

    if (reach.tenants === 'all') {
      return { alias: this.names.all, confined: [], lenient: true };
    }

    for (const tenant of reach.tenants) {
      this.names.aliasOf(tenant);
    }

    return { alias: this.names.all, confined: [{ terms: { [field]: [...reach.tenants] } }], lenient: true };
  }

  /** The index of the read model without tenancy, or the shared one of `attribute`. */
  shared(): ProvidedIndex {
    return { index: this.names.sharedIndex, aliases: [{ alias: this.names.all }] };
  }

  /** What provisioning a tenant puts in place. */
  ofTenant(tenant: string): ProvidedIndex {
    const alias = this.names.aliasOf(tenant);

    if (this.tenancy.strategy === 'index') {
      return { index: this.names.indexOf(tenant), aliases: [{ alias }, { alias: this.names.all }] };
    }

    return {
      index: this.names.sharedIndex,
      aliases: [
        { alias: this.names.all },
        { alias, filter: { term: { [String(this.field)]: tenant } }, routing: tenant },
      ],
    };
  }
}
