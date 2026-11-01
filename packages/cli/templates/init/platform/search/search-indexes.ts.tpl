import type { CriteriaDefinition } from '@ddd-ts-kit/kernel';
import type { OpenSearchReadModelOptions } from '@ddd-ts-kit/opensearch';

/** What a store may add to its name and its definition: the other fields of its rows, a write seen by the next search, the settings of its index. */
export type SearchStoreSettings<Row> = Pick<OpenSearchReadModelOptions<Row>, 'fields' | 'refresh' | 'settings'>;

/**
 * The read models kept in OpenSearch, as a capability of the platform. The adapter of a read
 * model port extends `OpenSearchReadModelStore` and passes to it what `options` answers: the
 * transport and the tenancy of the project are set here, never in a context. The platform
 * provisions the index of every store built so, before its first request.
 */
export abstract class SearchIndexes {
  /** The options of the store `name`: lower case letters, digits and `_`, prefixed by its context (`billing_invoices`). */
  abstract options<Row extends object>(
    name: string,
    definition: CriteriaDefinition<Row>,
    settings?: SearchStoreSettings<Row>,
  ): OpenSearchReadModelOptions<Row>;

  /** Provisions the index of every store built so far: at the start of the application, and again at will, since it is idempotent. */
  abstract provision(): Promise<void>;
}
