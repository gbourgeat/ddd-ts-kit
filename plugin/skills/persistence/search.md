# Search: a read model in OpenSearch

Read under `stack.search: opensearch`, or before a read model moves to a search engine. What fits
and what does not, the tests, the tenants and the rights in production are in
`docs/tools/search-read-models.md` of the kit.

- **A copy for reading.** A search index is a read model: written by its projection only, through
  the port (`upsertIfNewer` with the stamp of the event, `delete` that keeps a tombstone), rebuilt
  from the events, never a source of truth. `domain/` never reads it, and no handler decides an
  invariant (uniqueness, a balance) or a right on it: it lags the write by a refresh.
- **The port** is an abstract class over `ReadModelStore<Row>` of the kernel in
  `application/ports/`; **the adapter** in `infrastructure/persistence/` is written by hand, no
  generator yet:
  `class SearchInvoiceList extends OpenSearchReadModelStore<InvoiceRow> implements InvoiceList`,
  whose constructor takes `SearchIndexes` of `src/platform/search/` and calls
  `super(search.options('billing_invoices', invoiceCriteria))`. The name starts with the context.
- **Only the platform knows OpenSearch.** A context names nothing of `@ddd-ts-kit/opensearch` but
  `OpenSearchReadModelStore` and its refusals: no `fetchTransport`, transport or tenancy of its own
  (`search/store-from-platform`). The platform sets the node, the tenancy (`attribute` under shared
  tables, `index` by one line of `search/open-search.ts`) and provisions each index before its
  first request.
- **Tests.** The specs of the context bind the port to `InMemoryReadModelStore` of the kernel, a
  fake, never a mock. The adapter passes `readModelRowsContract` and `criteriaContract` of
  `@ddd-ts-kit/testing/contracts` in an integration spec that reads `OPENSEARCH_URL` and is skipped
  without it; the job that runs it needs an OpenSearch service.
- **Tenants.** Work with no tenant is refused; a `get` and the writes reach the tenant of the work
  only, an elevation widens a `search` only. A tenant is provisioned at its first request
  once the tenant directory lists it; an unlisted one creates no index. Choose `index` when a tenant must be apart physically (a
  regulated tenant, offboarding by dropping an index, a restore per tenant, a noisy neighbour).
- **A person in a document** is a copy to erase: an opaque key, and the rows of the subject deleted
  through the port on erasure.
