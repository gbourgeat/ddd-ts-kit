**English** · [Français](search-read-models.fr.md)

# Search read models on OpenSearch

**Summary.** A read model that serves lists with filters, sorts and pages may live in OpenSearch
instead of a table: `@ddd-ts-kit/opensearch` implements the `ReadModelStore` port of the kernel,
so a projector does not know which store it writes to. `init --search opensearch` wires it in the
platform: `src/platform/search/` hands every context `SearchIndexes`, which builds the options of
a store with the node and the tenancy of the project already set, and provisions the index of
each store built from it. A search index is a copy for reading, rebuilt from the events, never a
source of truth. Each choice is recorded in [ADR-0008](../adr/0008-a-read-model-store-on-opensearch.md)
(the store) and [ADR-0009](../adr/0009-init-wires-opensearch.md) (the wiring).

## What fits, and what does not

| Use | Fits | Why |
|---|---|---|
| A list with filters, sorts and pages over a projection | yes | the criteria of the read port become the query DSL, a cursor page is a keyset filter |
| A denormalized view joining several aggregates or contexts | yes | the projection writes one document from the events of each, through the published language |
| A read model eventually consistent with the write | yes | a search sees a write after the next refresh, one second by default |
| A high volume of reads kept apart from the write database | yes | the cluster takes the reads; the database keeps the writes |
| Reading your own write right after a command | no, unless `refresh: 'wait_for'` | each write then waits for the refresh: a cost on every write, chosen per store |
| Consistency with the write in one transaction | no | the document is written outside the unit of work; a redelivery is stale, a rolled-back write stays |
| A source of truth | no | the index is rebuilt from the events; what decides lives in the aggregate and its repository |
| An invariant (uniqueness, a balance) or an authorization decision | no | a read model lags the write: a decision taken on it can be wrong by one refresh |
| Full-text relevance, facets, aggregations | not built | a string is a `keyword`, `contains` a case-sensitive wildcard |
| Elasticsearch | not run | the store calls the endpoints both share; no spec runs on Elasticsearch |
| A rebuild without downtime | not built | each index carries a generation and every read goes through an alias, so that a rebuild can switch |

## What `init --search opensearch` writes

- `@ddd-ts-kit/opensearch` in the dependencies, at the range of the kit;
- `config.search` in `loadConfig`: `OPENSEARCH_URL` (required), `OPENSEARCH_USERNAME` with
  `OPENSEARCH_PASSWORD` (both or neither);
- `src/platform/search/search-indexes.ts`, the abstract class every context receives, and
  `search/open-search.ts`, which builds it on `fetchTransport` with the tenancy of the project:
  `{ strategy: 'attribute', scope }` under `--tenancy shared-table`, `{ strategy: 'none' }`
  otherwise;
- on tsyringe, InversifyJS and Awilix `search/search.module.ts`, which binds `SearchIndexes`;
  wired by hand and under Nest, `platform.search`;
- an `opensearch` service in `docker-compose.yml` (one node, security plugin off, half a gibibyte
  of heap, port 9200), `OPENSEARCH_URL` in `.env.example` and the variables in the README.

The index of every store built from `SearchIndexes` is provisioned before a request:
`ensureMapping()` once without tenancy; under shared tables, `provision(tenant)` for the tenant of
the work, once per store and tenant, when the tenant directory of the platform lists it (the
`TENANTS` of the configuration, or the organisations of the identity preset). At the start the
composition provisions, best effort, every listed tenant of the stores built by then: a failure is
a warning in the log and the start goes on, the next request provisions again. A project with no
store calls nothing: `npm run dev`, the tests and the pipeline need no node. The tools and the
tests are given no node: the start provisions nothing and a store is refused at its first request.
The privacy scripts are given the node of the configuration, so an erasure reaches a copy of a
person kept in OpenSearch.

## Writing a store

No generator writes it yet. The port is an abstract class over `ReadModelStore<Row>` in
`application/ports/`; the adapter in `infrastructure/persistence/` extends
`OpenSearchReadModelStore` and takes `SearchIndexes`:

```ts
import { OpenSearchReadModelStore } from '@ddd-ts-kit/opensearch';
import { SearchIndexes } from '@/platform/search/search-indexes';
import { InvoiceList, type InvoiceRow } from '@/contexts/billing/application/ports/invoice-list.port';
import { invoiceCriteria } from '@/contexts/billing/application/queries/search-invoices/invoice-criteria';

export class SearchInvoiceList extends OpenSearchReadModelStore<InvoiceRow> implements InvoiceList {
  constructor(search: SearchIndexes) {
    super(search.options('billing_invoices', invoiceCriteria, { fields: { notes: 'string' } }));
  }
}
```

- Its name starts with its context (`billing_invoices`): the indices and the aliases are built from
  it, and the rights of the deployment are given by that prefix. Nothing else enforces the prefix,
  beyond the rights of the service account; a second store built under a name already taken, with
  another definition or other fields, throws `SearchNameTakenError`.
- It is written by its projection only, through the port: `upsertIfNewer` with the stamp of the
  event, `delete`, which keeps a tombstone so that an older event does not bring the row back.
- `domain/` never reads it, and no handler decides an invariant or a right on it.
- Only the platform knows OpenSearch: a context names nothing of the package but
  `OpenSearchReadModelStore` and its refusals, names the store only in `extends`, calls
  `super(search.options(..))` and never spreads that answer to change its transport or tenancy
  (`search/store-from-platform`, an error).

## Testing

- The specs of a context bind the port to `InMemoryReadModelStore` of the kernel, built with the
  same criteria: a fake, never a mock.
- The adapter is held to `readModelRowsContract` and `criteriaContract` of
  `@ddd-ts-kit/testing/contracts`, the suites the package passes under each strategy. They need a
  node: run them in an integration spec that reads the node from `OPENSEARCH_URL` and is skipped
  without it, and give the job of the pipeline that runs it an OpenSearch service. The pipeline
  `init` writes starts none.
- An end-to-end test that goes through a store needs no node either: the kit recommends binding the
  port to the in-memory store in the composition of the end-to-end tests, in the
  `ddd-ts-kit:e2e-fakes` region of `test/e2e/support/start-application.ts`, as for any outside
  system. On a container of the kit:

  ```ts
  builder.rebind(InvoiceList).toValue(new InMemoryReadModelStore(invoiceCriteria));
  ```

  To run it against a node instead, pass `search: config.search` to the application there, and
  give the pipeline a node.

## Tenants

Under shared tables a store keeps the tenants apart whatever a context writes, and none of it is
for a context to set:

- work that names no tenant is refused (`NoCurrentTenantError`);
- each tenant reads and writes through an alias that OpenSearch filters on the tenant field and
  routes by the tenant, so another program reading through it sees that tenant only; the store adds
  the same condition to each search;
- a `get` and every write reach the tenant of the work: a document of another tenant is answered as
  absent, even under an elevation; an elevation (`acrossTenants`) widens a `search` only;
- a tenant becomes part of a name, and one that is not lower case letters, digits, `_` and `-` is
  refused (`InvalidIndexNameError`);
- a tenant is provisioned at its first request, once the tenant directory of the platform lists it:
  a tenant created after the start (an organisation of the identity preset) needs no restart and no
  call; a tenant the directory does not list, forged or unknown, creates no index, and its request
  is refused (`UnprovisionedIndexError`); work with no tenant and an elevation provision nothing;
- the failure of one tenant stays its own: it is tried again at its next request, and the other
  tenants are not provisioned again; `loadConfig` refuses a `TENANTS` entry that is not lower case.

### Choosing the strategy

| Strategy | For | Its cost |
|---|---|---|
| `attribute`, what `init` writes: one index, a filtered alias per tenant | many small tenants | the tenants share shards; one tenant cannot be snapshotted, restored or given a mapping of its own |
| `index`: an index per tenant | isolation that must be physical: a regulated tenant, erasure or offboarding by dropping an index, snapshot and restore per tenant, a noisy neighbour, a mapping or a retention per tenant | the shard count grows with the tenants |

The switch is one line of `src/platform/search/open-search.ts` (`{ strategy: 'index', scope }`),
then a reindex: the documents already hold their tenant under both strategies.

## Personal data

The kit declares nothing for a read model yet ([Personal data](../concepts/personal-data.md)): a
document that holds a person is a copy to erase like any other. Keep its key an opaque id. An
erasure reaches it by deleting the rows of the subject through the port, from the projection of the
erasure event or from a copy listed in `data-subject-copies.ts` under `--privacy on`; once the
rebuild exists, by rebuilding the read model. Under `index`, a tenant that leaves is dropped with
its indices.

## In production

The node of the compose stack runs with its security plugin off, for one machine. A deployment
keeps the plugin on, with TLS (`OPENSEARCH_URL` in `https://`), and gives the application a
service account (`OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`) whose role covers the indices and
aliases of the names of the project only (`billing_*`, `shipping_*`), never a wildcard: the account
creates indices and aliases at provisioning, then reads and writes documents.

## See also

- [`@ddd-ts-kit/opensearch`](../../packages/opensearch/README.md): the options, the tenancy, the
  provisioning, the official client behind a transport
- [Persistence](persistence.md): the tables of the four ORM, and when a search engine fits better
- [Multitenancy](../concepts/multitenancy.md): the strategies of the write side
- [ADR-0009](../adr/0009-init-wires-opensearch.md): what `init` wires, and what reverses each choice
