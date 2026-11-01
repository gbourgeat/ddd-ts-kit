import type { CriteriaDefinition, FieldType } from '@ddd-ts-kit/kernel';
import type { OpenSearchTransport } from '../transport/open-search-transport';
import type { OpenSearchTenancy } from './open-search-tenancy';

export interface OpenSearchReadModelOptions<Row> {
  readonly transport: OpenSearchTransport;
  /** The name the indices and aliases are built from: lower case letters, digits and `_`. */
  readonly name: string;
  /** What a read may filter and sort by; its fields are mapped and indexed. */
  readonly definition: CriteriaDefinition<Row>;
  /** The other fields of the row, kept with their type and not indexed: `{ notes: 'string' }`. */
  readonly fields?: { readonly [Field in keyof Row & string]?: FieldType };
  /** Default: `{ strategy: 'none' }`. */
  readonly tenancy?: OpenSearchTenancy;
  /**
   * `wait_for`: a write answers once a search sees it. Absent, a write answers at once and a
   * search sees it after the next refresh of the index (one second by default).
   */
  readonly refresh?: 'wait_for';
  /** The settings of an index the store creates: `{ number_of_shards: 1, number_of_replicas: 1 }`. */
  readonly settings?: Readonly<Record<string, unknown>>;
}
