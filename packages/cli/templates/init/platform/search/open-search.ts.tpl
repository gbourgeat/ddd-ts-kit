{{#if tenancy.any}}
import type { ExecutionScope, Logger, TenantDirectory } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenancy.any}}
import type { Logger } from '@ddd-ts-kit/kernel';
{{/unless}}
import {
  OpenSearchUnavailableError,
  fetchTransport,
  type FetchTransportOptions,
  type OpenSearchTransport,
} from '@ddd-ts-kit/opensearch';
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
import { ProvisionedIndexes } from '{{alias.platform}}/search/provisioned-indexes{{alias.ext}}';
import type { SearchIndexes } from '{{alias.platform}}/search/search-indexes{{alias.ext}}';

/** What the read models of OpenSearch are built on: the logger of the platform{{#if tenancy.any}}, the tenant of the work and the tenants that exist{{/if}}. */
interface Grounds {
  /** Where a provisioning of the start that failed is told, as a warning: the start goes on. */
  readonly logger: Logger;
{{#if tenancy.any}}
  readonly scope: ExecutionScope;
  /** The tenants that exist, the same directory the jobs read: only a tenant it lists is ever provisioned. */
  readonly directory: TenantDirectory;
{{/if}}
}

/** No node, for the tools and the tests that give none: the start provisions nothing, and a store is refused at its first request. */
const NO_NODE: OpenSearchTransport = {
  request: ({ method, path }) =>
    Promise.reject(
      new OpenSearchUnavailableError(method, path, { cause: new Error('no OpenSearch node: pass `search` to the application') }),
    ),
};

/**
 * The read models of OpenSearch on the node of `config.search` (`OPENSEARCH_URL`); left out,
 * none.
{{#if tenancy.any}}
 * Shared tables keep the tenants of a store in one index, each document holding its
 * tenant and each tenant read through a filtered alias: `{ strategy: 'attribute', scope }`. For
 * an index per tenant (a tenant whose data must stay apart, dropped with its index when it leaves),
 * write `{ strategy: 'index', scope }` instead.
{{/if}}
{{#unless tenancy.any}}
 * Without tenancy a store is one index: `{ strategy: 'none' }`. Once the project has tenants
 * (`init --force --tenancy shared-table`), this file keeps them apart.
{{/unless}}
 */
{{#if tenancy.any}}
export function openSearch(config: AppConfig['search'] | undefined, { logger, scope, directory }: Grounds): SearchIndexes {
  return new ProvisionedIndexes({
    transport: transportOf(config),
    tenancy: { strategy: 'attribute', scope },
    logger,
    reachable: config !== undefined,
    tenants: { ofWork: () => tenantOfWork(scope), listed: () => directory.tenants() },
  });
}
{{/if}}
{{#unless tenancy.any}}
export function openSearch(config: AppConfig['search'] | undefined, { logger }: Grounds): SearchIndexes {
  return new ProvisionedIndexes({
    transport: transportOf(config),
    tenancy: { strategy: 'none' },
    logger,
    reachable: config !== undefined,
  });
}
{{/unless}}

function transportOf(config: AppConfig['search'] | undefined): OpenSearchTransport {
  return config === undefined ? NO_NODE : fetchTransport({ node: config.node, ...authOf(config) });
}

/** The user of the security plugin, when the configuration names one. */
function authOf({ username, password }: AppConfig['search']): Pick<FetchTransportOptions, 'auth'> {
  return username === undefined || password === undefined ? {} : { auth: { username, password } };
}
{{#if tenancy.any}}

/** The tenant a request is provisioned for: none for work with no tenant, nor under an elevation, which reads across tenants. */
function tenantOfWork(scope: ExecutionScope): string | undefined {
  const work = scope.current();

  return work?.elevation === undefined ? work?.tenantId : undefined;
}
{{/if}}
