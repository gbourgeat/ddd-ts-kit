import type { CriteriaDefinition, Logger } from '@ddd-ts-kit/kernel';
import {
  OpenSearchReadModelStore,
  type OpenSearchReadModelOptions,
  type OpenSearchTenancy,
  type OpenSearchTransport,
} from '@ddd-ts-kit/opensearch';
import { SearchIndexes, type SearchStoreSettings } from '{{alias.platform}}/search/search-indexes{{alias.ext}}';
import { SearchNameTakenError } from '{{alias.platform}}/search/search-name-taken-error{{alias.ext}}';
import { StoreIndex } from '{{alias.platform}}/search/store-index{{alias.ext}}';

/** The tenants a store is provisioned for, under a tenant strategy. */
interface Tenants {
  /** The tenant of the work a request is sent for; none for work with no tenant or under an elevation. */
  readonly ofWork: () => string | undefined;
  /** The tenants that exist: a tenant it does not list is never provisioned, and its store refuses it. */
  readonly listed: () => Promise<readonly string[]>;
}

/** What every store is built and provisioned with. */
interface IndexSettings {
  readonly transport: OpenSearchTransport;
  readonly tenancy: OpenSearchTenancy;
  readonly logger: Logger;
  /** `false` without a node: the start provisions nothing, and the transport refuses each request. */
  readonly reachable: boolean;
  /** Left out without tenancy: the index of a store is then provisioned once, by `ensureMapping`. */
  readonly tenants?: Tenants;
}

/** A store built under a name: what it was built from, and its index. */
interface Built {
  readonly definition: unknown;
  readonly fields: unknown;
  readonly index: StoreIndex;
}

/**
 * The stores built from the platform, one index each, provisioned before a request: once without
 * tenancy, for each tenant of the work the directory lists otherwise. A tenant whose provisioning
 * failed is tried again at its next request, the others untouched.
 */
export class ProvisionedIndexes extends SearchIndexes {
  private readonly stores = new Map<string, Built>();

  constructor(private readonly settings: IndexSettings) {
    super();
  }

  options<Row extends object>(
    name: string,
    definition: CriteriaDefinition<Row>,
    settings: SearchStoreSettings<Row> = {},
  ): OpenSearchReadModelOptions<Row> {
    const { transport, tenancy } = this.settings;
    const options = { ...settings, transport, name, definition, tenancy };
    const built = { definition, fields: settings.fields };
    const index = this.indexOf(name, built, () => new StoreIndex(new OpenSearchReadModelStore(options)));

    return { ...options, transport: { request: (request) => this.ready(index).then(() => transport.request(request)) } };
  }

  /** At the start, best effort: every tenant the directory lists, for each store built by then; a failure is a warning. */
  async provision(): Promise<void> {
    if (!this.settings.reachable) {
      return;
    }

    await Promise.all([...this.stores].map(([name, { index }]) => this.provisionAtStart(name, index)));
  }

  private indexOf(name: string, built: Omit<Built, 'index'>, created: () => StoreIndex): StoreIndex {
    const known = this.stores.get(name);

    if (known === undefined) {
      const index = created();

      this.stores.set(name, { ...built, index });

      return index;
    }

    if (known.definition !== built.definition || !sameFields(known.fields, built.fields)) {
      throw new SearchNameTakenError(name);
    }

    return known.index;
  }

  private async ready(index: StoreIndex): Promise<void> {
    const { tenants } = this.settings;

    if (tenants === undefined) {
      return index.mapped();
    }

    const tenant = tenants.ofWork();

    if (tenant !== undefined && (index.has(tenant) || (await tenants.listed()).includes(tenant))) {
      await index.provisioned(tenant);
    }
  }

  private async provisionAtStart(name: string, index: StoreIndex): Promise<void> {
    const { tenants } = this.settings;

    if (tenants === undefined) {
      return index.mapped().catch((error: unknown) => this.warn(error, name));
    }

    const listed = await tenants.listed().catch((error: unknown) => {
      this.warn(error, name);

      return [];
    });

    await Promise.all(
      listed.map((tenant) => index.provisioned(tenant).catch((error: unknown) => this.warn(error, name, tenant))),
    );
  }

  private warn(error: unknown, store: string, tenant?: string): void {
    this.settings.logger.warn('search index not provisioned', {
      store,
      ...(tenant === undefined ? {} : { tenant }),
      error: error instanceof Error ? error : String(error),
    });
  }
}

/** The same fields kept with the rows: the same names with the same types. */
function sameFields(known: unknown, asked: unknown): boolean {
  return JSON.stringify(known ?? {}) === JSON.stringify(asked ?? {});
}
