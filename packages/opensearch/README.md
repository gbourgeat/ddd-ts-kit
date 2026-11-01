**English** · [Français](README.fr.md)

# @ddd-ts-kit/opensearch

The kernel `ReadModelStore` on OpenSearch: the read model of a projection kept in an index,
searched with the criteria of the kernel translated to the query DSL, its writes ordered by the
stamp of the event that made them, and the documents of tenants kept apart by an index per tenant
or by a tenant field and a filtered alias per tenant. It depends on no client library: it speaks
the REST API through a transport of a few lines. Nothing in `domain/` or `application/` imports
this package: a projector writes to its read model port, and the platform binds this adapter.

```
npm i @ddd-ts-kit/opensearch
```

`init --search opensearch` wires it in the platform of a generated project: `SearchIndexes` sets the
transport and the tenancy and provisions the indices, and an adapter calls
`super(search.options(name, definition))` ([Search read models](../../docs/tools/search-read-models.md),
[ADR-0009](../../docs/adr/0009-init-wires-opensearch.md)). The composition below is the same by hand,
and [the decision record](../../docs/adr/0008-a-read-model-store-on-opensearch.md) states each choice.

## Composition root

<!-- checked sample -->
```ts
import { AsyncLocalStorageExecutionScope, ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';
import { OpenSearchReadModelStore, fetchTransport } from '@ddd-ts-kit/opensearch';

interface AppointmentRow {
  readonly id: string;
  readonly status: 'booked' | 'cancelled';
  readonly startsAt: Date;
  readonly fee: string;
  readonly notes: string | null;
}

// application/ports: the port of the read model, as for any store
export abstract class AppointmentList extends ReadModelStore<AppointmentRow> {}

const appointmentCriteria = defineCriteria<AppointmentRow>({
  fields: {
    id: { type: 'string', filter: ['eq', 'in'] },
    status: { type: 'string', filter: ['eq', 'in'], sortable: true },
    startsAt: { type: 'instant', filter: ['gte', 'lt', 'between'], sortable: true },
    fee: { type: 'decimal', filter: ['gte', 'lte'], sortable: true },
  },
  defaultSort: [{ field: 'startsAt', direction: 'asc' }],
  tieBreaker: 'id',
});

declare const config: { readonly search: { readonly node: string; readonly username: string; readonly password: string } };

export const scope = new AsyncLocalStorageExecutionScope();

// infrastructure: the adapter extends the store and adds nothing
export class SearchAppointmentList extends OpenSearchReadModelStore<AppointmentRow> implements AppointmentList {
  constructor() {
    super({
      transport: fetchTransport({ node: config.search.node, auth: config.search }),
      name: 'scheduling_appointments',
      definition: appointmentCriteria,
      fields: { notes: 'string' }, // kept with the row, neither filtered nor sorted
      tenancy: { strategy: 'attribute', scope }, // or 'index', or { strategy: 'none' }
    });
  }
}

// the platform, once per tenant when it is created (and again at each start: it is idempotent)
export async function provisionTenant(list: SearchAppointmentList, tenantId: string): Promise<void> {
  await list.provision(tenantId);
}
```

A projector writes through the port, as on any store (`@ddd-ts-kit/kernel`, "Projections"):

```ts
@Projection('scheduling.appointment-list')
export class AppointmentListProjection {
  constructor(private readonly appointments: AppointmentList) {}

  @On(AppointmentBooked)
  booked(event: AppointmentBooked) {
    return this.appointments.upsertIfNewer(event.aggregateId, stampOf(event), () => rowOf(event));
  }

  @On(AppointmentCancelled)
  cancelled(event: AppointmentCancelled) {
    return this.appointments.delete(event.aggregateId, stampOf(event));
  }
}
```

The options of `OpenSearchReadModelStore`:

| Option | Default | |
|---|---|---|
| `transport` | required | `fetchTransport(...)`, or the official client of the project wrapped in an `OpenSearchTransport` |
| `name` | required | lower case letters, digits and `_`, at most 100: the indices and aliases are built from it |
| `definition` | required | the `CriteriaDefinition` of the read port; its fields are mapped and indexed |
| `fields` | none | the other fields of the row with their type (`string`, `number`, `boolean`, `instant`, `decimal`), kept and not indexed |
| `tenancy` | `{ strategy: 'none' }` | `none`, `index` or `attribute`, with the `scope` the tenant is read from and the tenant `field` (`tenantId`) |
| `refresh` | none | `'wait_for'`: a write answers once a search sees it |
| `settings` | none | the settings of an index the store creates: shards, replicas, refresh interval |

`fetchTransport` takes `node` (`https://search.internal:9200`), `auth` (`{ username, password }`
for basic authentication, or `{ authorization }` for the whole header, an `ApiKey` or a bearer
token) and `timeoutMs` (10 000 by default). It answers every status; it rejects with
`OpenSearchUnavailableError` only when no answer came. To use the official client:

```ts
const transport: OpenSearchTransport = {
  async request({ method, path, query, body }) {
    const response = await client.transport.request({ method, path, querystring: query, body }, { ignore: [404, 409] });

    return { status: response.statusCode ?? 200, body: response.body };
  },
};
```

## Tenancy

| Strategy | Indices | A tenant is read and written through | An elevation reads through |
|---|---|---|---|
| `none` | `<name>.v1` | the alias `<name>` | |
| `index` | `<name>-<tenant>.v1`, one per tenant | the alias `<name>-<tenant>`, on that tenant's index | the alias `<name>`, on every tenant's index |
| `attribute` | `<name>.v1`, shared | the alias `<name>-<tenant>`, filtered on the tenant field and routed by the tenant | the alias `<name>`, on the shared index |

Every read and write goes through an alias, never an index, so the store reads the same way under
both tenant strategies, and the filter of a tenant's alias is applied by OpenSearch itself: a
query sent through that alias by another program sees that tenant's documents only. The store
adds the same condition to each of its searches. Under both tenant strategies:

- each document holds the tenant of the work in the tenant field (`tenantId` by default), which
  the store writes itself, since a write through a filtered alias does not; when the row has a
  field of that name, it holds the tenant of the work, whatever the row said;
- a `get` and every write reach the tenant of the work (`tenantScopeOf`): a document of another
  tenant is answered as absent, even under an elevation;
- a `search` reaches what `tenantReachOf` allows: the tenant of the work, or, under
  `acrossTenants`, every tenant or the tenants it names;
- work that names no tenant is refused with `NoCurrentTenantError`;
- under `attribute` a document's id is `<tenant>:<key>`, so two tenants may hold the same key.

A tenant becomes part of a name: it is refused with `InvalidIndexNameError` unless it is made of
lower case letters, digits, `_` and `-` (a tenant id of the kernel may hold upper case letters:
`Acme` is refused rather than read as `acme`). A read model name holds no `-` and a tenant no `.`,
so no alias of a tenant is ever the name of an index or the alias of another read model.

**Provisioning.** The store never creates an index on a write, where a typo in a name would
create one: a write and a read through an alias that does not exist are refused with
`UnprovisionedIndexError`. The platform calls `ensureMapping()` for a read model without tenancy
and `provision(tenant)` for each tenant; both are idempotent, and add to an existing index the
fields its mapping lacks (a field mapped with another type is refused by OpenSearch).

## What it does

| Port method | On OpenSearch |
|---|---|
| `get(key)` | `GET /<alias>/_doc/<id>`; the tenant of the document is checked, since a filtered alias does not filter a get |
| `upsertIfNewer`, `delete` | the get above, then `PUT /<alias>/_doc/<id>?require_alias=true` with `op_type=create` for a new key, or `if_seq_no` and `if_primary_term` of the document read; on a conflict it reads again, five attempts, then `ConcurrencyError` |
| `search(scopedCriteria)` | `POST /<alias>/_search`: every operator, group, sort and page of the criteria as filters of the query DSL; the deleted rows left out; an offset page counted exactly (`track_total_hits`) |
| `ensureMapping()`, `provision(tenant)` | `PUT /<index>`, `PUT /<index>/_mapping`, `POST /_aliases` |

The endpoints are the ones Elasticsearch shares, but the store was run on OpenSearch only.

**Mapping.** It is `dynamic: 'strict'`: a field of a row that the read model does not declare is
refused at the write (`OpenSearchRequestError`, `strict_dynamic_mapping_exception`). The fields of
the definition are indexed: `string` as `keyword` (compared by code point, as the criteria do),
`number` as `double`, `boolean`, `instant` as `date` to the millisecond. A `decimal` is kept as it
was written and compared through an order key (`_ddd_order.<field>`), a keyword whose byte order is
the order of the numbers: no float, no rounding. The stamp and the deletion live in
`_ddd_stamp` and `_ddd_deleted`; `get` and `search` give back the declared fields only.

**Order.** A replace is conditional on the sequence number of the document read: two events of
one key never overwrite each other blindly, and the stamp rule is the one of the kernel
(`isNewer`). A deleted row stays as a trace with its stamp: an older event delivered late does not
bring it back.

**Cursor pages** are keyset pages, as on the SQL stores: the position the cursor holds becomes a
filter (`plan.seek`), not `search_after`, whose values are the engine's (epoch milliseconds,
order keys) rather than the row's. **Offset pages** use `from` and `size`, bounded by
`index.max_result_window` (10 000 by default).

**Refresh.** A write answers at once, and a search sees it after the next refresh of the index
(one second by default): the read side is eventually consistent, and `get` reads the document at
once. `refresh: 'wait_for'` makes each write wait until a search sees it, at the cost of that
wait on every write; it is what the specs use.

## Limits

- **No transaction with the database.** A write to OpenSearch does not commit with the
  processed-event mark of the unit of work, as a write of an SQL store does. A failure between
  the two delivers the event again, and the stamp makes that delivery `stale`: nothing is applied
  twice. A write that succeeded in a unit of work that rolls back is not undone.
- **No rebuild yet.** `ProjectionRebuild` refuses this store with `UnsupportedRebuildError`. The
  names keep it open: every index carries its generation (`v1`), every read and write goes through
  an alias, so a rebuild fills `v2` and moves the alias in one `_aliases` call.
- **No full-text search.** A `string` is a `keyword`: `contains` is a wildcard query, case
  sensitive, and slow on a large index. Text analysis, relevance and facets are not built.
- **A string up to 32 766 bytes** in a filtered field: Lucene refuses a longer term.
- Offset pages stop at `index.max_result_window`; page by cursor beyond.

## Tests

`readModelRowsContract` and `criteriaContract` of `@ddd-ts-kit/testing/contracts` (re-exported by
`@ddd-ts-kit/opensearch/testing`) under each strategy, and the specs of the tenancy: two tenants,
each sees and changes only its own documents, a search never returns another tenant's, an
elevation reads across, work with no tenant and an unprovisioned tenant are refused, and no index
is created by a write. They run on an OpenSearch in memory, in the process, which serves the
subset of the REST API the store calls over HTTP, and on the server that
`DDD_TS_KIT_TEST_OPENSEARCH_URL` names: OpenSearch 3 in the pipeline, with the security plugin
disabled. `readModelStoreContract`, which adds the rebuild, does not run: there is no rebuild.
