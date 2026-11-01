import type { ExecutionScope } from '@ddd-ts-kit/kernel';

/**
 * How the documents of tenants are kept apart. `none`: one index, no tenant. `index`: an index per
 * tenant. `attribute`: one index for every tenant, each document holding its tenant in `field`
 * (`tenantId` by default) and each tenant read through a filtered alias. Under both tenant
 * strategies the tenant is read from `scope` at each call, and written in `field` of each document.
 */
export type OpenSearchTenancy =
  | { readonly strategy: 'none' }
  | { readonly strategy: 'index' | 'attribute'; readonly scope: ExecutionScope; readonly field?: string };
