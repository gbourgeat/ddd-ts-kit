**English** · [Français](0008-a-read-model-store-on-opensearch.fr.md)

# ADR-0008: a read model store on OpenSearch

## Decision

`@ddd-ts-kit/opensearch` is a second kind of store for the `ReadModelStore` port of the kernel,
beside the four ORM: `OpenSearchReadModelStore` keeps the read model of a projection in an
OpenSearch index, extends `TableReadModelStore` over a `ReadModelTable` of its own, and passes
`readModelRowsContract` and `criteriaContract` of `@ddd-ts-kit/testing` under each of its three
tenancy strategies, on an OpenSearch in memory and on OpenSearch 3. It is the answer to question 3
of [the proposal on the read side](../proposals/read-side.md): OpenSearch first, through the
subset of the REST API that Elasticsearch shares.

Each choice below was open; the one taken is the one that is easiest to undo, and the last column
says what undoes it.

| Choice | Taken | Why | What reverses it |
| --- | --- | --- | --- |
| The port | `ReadModelStore<Row>` of the kernel, through `TableReadModelStore` | a projector does not know which store it writes to, and the stamp rule and the retries are written once (`writeIfNewer`) | nothing to reverse: another port would be a second way to write a read model |
| A client library | none: an `OpenSearchTransport` of one method, and `fetchTransport` on the `fetch` of Node | no peer to keep at parity with two client families (OpenSearch and Elasticsearch), and a project may wrap its own client in a few lines | a subpath entry over the official client, beside `fetchTransport`, the store unchanged |
| The endpoints | `_doc` (get, conditional index with `require_alias`), `_search`, index creation, `_mapping`, `_aliases` | the subset Elasticsearch shares; nothing of OpenSearch alone | an Elasticsearch run of the same specs proves it, or names what differs |
| Every access through an alias | `<name>`, `<name>-<tenant>` | the same reads under every strategy, and the rebuild kept open | none needed: an alias costs nothing |
| Tenancy `index` | `<name>-<tenant>.v1`, an index per tenant, with the alias of the tenant and `<name>` | a tenant is dropped, sized or moved alone | reindex into the shared index and move the aliases: the documents already hold their tenant |
| Tenancy `attribute` | one `<name>.v1`; per tenant a filtered alias (`term` on the tenant field) routed by the tenant | thousands of tenants on few shards, and the filter enforced by OpenSearch, not only by the query | reindex into an index per tenant and move the aliases |
| The tenant field under `index` too | the store writes it under both tenant strategies | a move from one strategy to the other is a reindex and nothing else, and the check of a get is the same | stop writing it under `index`: nothing reads it there but that check |
| The id of a document under `attribute` | `<tenant>:<key>` | the uniqueness of `_id` holds per shard only once a routing is set; with the tenant in the id two tenants never share a document, whatever the shard count | the key alone, with the refusal the SQL stores give a key held by another tenant |
| A get and the writes under an elevation | the tenant of the work (`tenantScopeOf`); an elevation widens a search only | a key names a row in one tenant; a get across tenants would have to choose among them | a get through `<name>` by an `ids` query, if a use for it comes |
| The names | `<name>.v<generation>` for an index, `-` before the tenant; a read model name of `[a-z0-9_]`, a tenant of `[a-z0-9_-]` | with `<name>-<tenant>-v<generation>` instead, the alias of the tenant `acme-v1` is the index of `acme` and the alias of the tenant `v1` the shared index; a dot, which no tenant id holds, closes that | the names are written in one class (`IndexNames`): another scheme is a reindex |
| A tenant with upper case letters | refused (`InvalidIndexNameError`) | an index name is lower case; folding would make `Acme` and `acme` one tenant | a reversible encoding of upper case letters, if a project needs one |
| Creating indices | never on a write: `require_alias=true`, and `provision(tenant)` or `ensureMapping()` from the platform | a typo in a name would create an index, with a mapping guessed from the document | a provisioning on the first write, behind an option |
| The generation | always `1`, not an option | an option without a rebuild would let two generations hold the alias of one tenant | the rebuild adds it |
| The mapping | from the `CriteriaDefinition`: its types (`string`, `number`, `boolean`, `instant`, `decimal`), indexed; the other fields of the row under `fields`, with the same types, kept and not indexed; `dynamic: 'strict'` | the vocabulary of the criteria, not a second one (`keyword`, `text`) to keep in step with it | `text` and analyzers as an extension of the definition, when full-text search is built |
| A decimal | kept as written, compared through an order key in `_ddd_order.<field>` | no type of OpenSearch compares decimals of any length without a float | `scaled_float` behind an option, for a project that accepts its rounding |
| Concurrency | the `_seq_no` and `_primary_term` of the document read, kept for the stamp `find` answered; a replace given another stamp reads the document again | a write is conditional on what was read, without a second read on the common path | nothing to reverse: it is the contract of `ReadModelRows` |
| After a conflict | `writeIfNewer` of the kernel: five attempts, then `ConcurrencyError` | the same bound and the same error as every store | none needed |
| A cursor page | the keyset filter of the plan (`plan.seek`), not `search_after` | the cursor holds the values of the row, as on the SQL stores; `search_after` holds the engine's (epoch milliseconds, order keys) | `search_after` from the same cursor, once the cursor values are mapped to sort values |
| Refresh | none by default; `refresh: 'wait_for'` on a write when the option asks for it | the read side is eventually consistent, as the proposal says, and a wait on every write is a cost a project chooses; a `get` is real time | change the default: one line, and a sentence in the README |
| The rebuild | not built: `rebuilding()` is false, the steps refuse with `UnsupportedRebuildError` | out of the scope of this change | a later version fills `<name>...v2` and moves the aliases in one `_aliases` call: the generation in each index name and the alias in front of every read are there for it |
| The contract | `readModelRowsContract`, the rows half of `readModelStoreContract`, added to `@ddd-ts-kit/testing` | `readModelStoreContract` holds the rebuild, which this store does not have | the store runs `readModelStoreContract` once its rebuild exists |
| The family | outside the read model family of `pipeline/monorepo/families.mjs` | OpenSearch is not an ORM, and the family compares the options of four ORM packages | a family of read model stores, if a second engine comes |
| npm | `"private": true` | the release publishes by trusted publishing, which the owner configures on npmjs.com per package name: a first publication of a new name would fail the publish job | the owner configures the trusted publisher of `@ddd-ts-kit/opensearch`, then `private` goes |
| The CLI | `init` does not wire it | a generated project installs from npm, and the package is not there yet | `init --read-model opensearch` (or a value of `stack`), once the package is published |

## Consequences

A write to OpenSearch is not in the transaction of the unit of work: the processed-event mark
commits in the database, the document in the index. A failure between the two delivers the event
again, and the stamp makes that second delivery stale, so nothing is applied twice; a document
written in a unit of work that rolls back stays. The README of the package says it.

## When to revisit

When the rebuild is built (the contract becomes `readModelStoreContract`), when the package is
published (the wiring of `init`), when a project runs it on Elasticsearch (the same specs on that
server), and when full-text search is asked for (the mapping of `text` fields).
