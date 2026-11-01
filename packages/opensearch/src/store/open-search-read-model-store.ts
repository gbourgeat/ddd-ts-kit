import { TableReadModelStore } from '@ddd-ts-kit/kernel';
import type { OpenSearchReadModelOptions } from './open-search-read-model-options';
import { OpenSearchReadModelTable } from './open-search-read-model-table';

/**
 * The read model of a projection in OpenSearch. The adapter of a read model port extends it and
 * adds nothing: `class SearchAppointmentList extends OpenSearchReadModelStore<AppointmentRow>
 * implements AppointmentList`. Reads and writes go through aliases that the platform creates once,
 * with `ensureMapping()` or `provision(tenant)`: the store never creates an index on a write.
 */
export class OpenSearchReadModelStore<Row extends object> extends TableReadModelStore<Row> {
  private readonly indices: OpenSearchReadModelTable<Row>;

  constructor(options: OpenSearchReadModelOptions<Row>) {
    const table = new OpenSearchReadModelTable<Row>(options);

    super(table, options.definition);
    this.indices = table;
  }

  /** Without tenancy: creates the index and its alias, or adds the fields its mapping lacks. Idempotent. */
  ensureMapping(): Promise<void> {
    return this.indices.ensureMapping();
  }

  /** Under a tenant strategy: creates the index of the tenant, or its filtered alias on the shared index. Idempotent. */
  provision(tenant: string): Promise<void> {
    return this.indices.provision(tenant);
  }
}
