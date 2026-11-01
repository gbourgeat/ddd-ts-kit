import type { CriteriaDefinition{{#if tenancy.any}}, ExecutionScope{{/if}} } from '@ddd-ts-kit/kernel';
import {
  OpenSearchReadModelStore,
  OpenSearchUnavailableError,
  fetchTransport,
  type FetchTransportOptions,
  type OpenSearchReadModelOptions,
  type OpenSearchTenancy,
  type OpenSearchTransport,
} from '@ddd-ts-kit/opensearch';
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
import { SearchIndexes, type SearchStoreSettings } from '{{alias.platform}}/search/search-indexes{{alias.ext}}';

/** What provisions the index of a store: the store itself, built on the transport of the platform. */
type Provisioned = Pick<OpenSearchReadModelStore<object>, 'ensureMapping' | 'provision'>;
{{#if tenancy.any}}

/** What the read models of OpenSearch are kept apart by: the tenant of the work, and the tenants that exist (`TENANTS`). */
interface Tenants {
  readonly scope: ExecutionScope;
  readonly tenants: readonly string[];
}
{{/if}}

/** No node, for the tools and the tests that give none: a store built then is refused at its first request. */
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
export function openSearch(config: AppConfig['search'] | undefined, { scope, tenants }: Tenants): SearchIndexes {
  const transport = config === undefined ? NO_NODE : fetchTransport({ node: config.node, ...authOf(config) });

  return new ProvisionedIndexes(transport, { strategy: 'attribute', scope }, tenants);
}
{{/if}}
{{#unless tenancy.any}}
export function openSearch(config: AppConfig['search'] | undefined): SearchIndexes {
  const transport = config === undefined ? NO_NODE : fetchTransport({ node: config.node, ...authOf(config) });

  return new ProvisionedIndexes(transport, { strategy: 'none' }, []);
}
{{/unless}}

/** The user of the security plugin, when the configuration names one. */
function authOf({ username, password }: AppConfig['search']): Pick<FetchTransportOptions, 'auth'> {
  return username === undefined || password === undefined ? {} : { auth: { username, password } };
}

/**
 * The stores built from the platform, one index each, provisioned before their first request:
 * `ensureMapping()` without tenancy, `provision(tenant)` for each tenant otherwise.
 */
class ProvisionedIndexes extends SearchIndexes {
  private readonly stores = new Map<string, Provisioning>();

  constructor(
    private readonly transport: OpenSearchTransport,
    private readonly tenancy: OpenSearchTenancy,
    private readonly tenants: readonly string[],
  ) {
    super();
  }

  options<Row extends object>(
    name: string,
    definition: CriteriaDefinition<Row>,
    settings: SearchStoreSettings<Row> = {},
  ): OpenSearchReadModelOptions<Row> {
    const options = { ...settings, transport: this.transport, name, definition, tenancy: this.tenancy };
    const tenants = this.tenancy.strategy === 'none' ? undefined : this.tenants;
    const provisioning = this.stores.get(name) ?? new Provisioning(new OpenSearchReadModelStore(options), tenants);

    this.stores.set(name, provisioning);

    return { ...options, transport: provisioning.before(this.transport) };
  }

  async provision(): Promise<void> {
    await Promise.all([...this.stores.values()].map((store) => store.ready()));
  }
}

/** The index of one store, provisioned once; an attempt that failed is made again at the next request. */
class Provisioning {
  private provisioned: Promise<void> | undefined;

  constructor(
    private readonly store: Provisioned,
    private readonly tenants: readonly string[] | undefined,
  ) {}

  ready(): Promise<void> {
    this.provisioned ??= this.provisionOnce().catch((error: unknown) => {
      this.provisioned = undefined;

      throw error;
    });

    return this.provisioned;
  }

  /** The transport of the store, which waits for its index before the first request. */
  before(transport: OpenSearchTransport): OpenSearchTransport {
    return {
      request: async (request) => {
        await this.ready();

        return transport.request(request);
      },
    };
  }

  private async provisionOnce(): Promise<void> {
    if (this.tenants === undefined) {
      await this.store.ensureMapping();

      return;
    }

    await Promise.all(this.tenants.map((tenant) => this.store.provision(tenant)));
  }
}
