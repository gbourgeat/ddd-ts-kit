**English** · [Français](0009-init-wires-opensearch.fr.md)

# ADR-0009: init wires OpenSearch

## Decision

`init --search opensearch` wires `@ddd-ts-kit/opensearch` ([ADR-0008](0008-a-read-model-store-on-opensearch.md))
in the platform of a generated project: `src/platform/search/` hands every context
`SearchIndexes`, which builds the options of an `OpenSearchReadModelStore` for a name and a
definition with the transport and the tenancy of the project set, and provisions the index of each
store built from it. The checker holds a context to it (`search/store-from-platform`). How a store
is written, tested and kept apart per tenant is in [Search read models](../tools/search-read-models.md).

Each choice below was open; the one taken is the one that is easiest to undo, and the last column
says what undoes it.

| Choice | Taken | Why | What reverses it |
| --- | --- | --- | --- |
| The flag | `--search opensearch\|none`, recorded as `stack.search`, `none` by default and for a config that does not say | a key for what the search engine is, beside `storage` and `cache`; a second engine is a second value, not a second flag | rename the key, with a `To move:` line: one read in `parse-stack.ts` |
| What a context receives | `SearchIndexes`, an abstract class of the platform: `options(name, definition, settings?)` and `provision()` | the adapter keeps the shape the README of the package shows (`extends OpenSearchReadModelStore`), and only the platform knows the node and the tenancy; an abstract class is what a declared constructor may name | a factory of stores in its place: the adapters change one line each |
| The tenancy | `{ strategy: 'attribute', scope }` under `--tenancy shared-table`, with the execution scope of the platform; `{ strategy: 'none' }` without tenancy | shared tables are one table for every tenant: one index for every tenant is the same choice, and many small tenants cost few shards | `{ strategy: 'index', scope }` in `search/open-search.ts`, then a reindex: the documents hold their tenant under both |
| When an index is provisioned | before a request: without tenancy `ensureMapping()` once per store; under shared tables `provision(tenant)` for the tenant of the work, once per store and tenant, when the `TenantDirectory` of the platform lists it (the one the jobs read, which the identity preset reads from its organisations); a tenant it does not list, work with no tenant and an elevation provision nothing, and the store refuses an alias that does not exist | the containers build an adapter when a handler first needs it, so a provisioning at the start alone would find no store; a tenant created after the start is provisioned at its first request, and an unknown or forged tenant never creates an index | provisioning at the start only, once the containers build the adapters at the start |
| The start | provisions, best effort, every tenant the directory lists for each store built by then: without a node it does nothing, and a failure is a warning of the platform logger; the start goes on | a read model that is not provisioned yet is not an application that cannot start; the request path provisions again before sending and fails closed | a start that fails on search, by rethrowing in `provision()` |
| A failure of one tenant | its own: a tenant that OpenSearch cannot name (`InvalidIndexNameError`) or whose provisioning failed is tried again at its next request, the other tenants untouched; `loadConfig` refuses a `TENANTS` entry that is not lower case | one tenant must not take down a store for the others | none needed |
| A name built twice | the same definition and fields reuse the store, as a container that resolves an adapter twice does; another definition or other fields throw `SearchNameTakenError` | two read models would share the indices of one name; a name starts with its context by convention, which nothing enforces beyond the rights of the service account | a registry of names per context, checked at the start |
| A project with no store | calls nothing: no request at the start | `npm run dev`, the tests of the project and the end-to-end runs of the kit need no node | none needed |
| Readiness | no readiness check on OpenSearch | a read model that lags is not an application that cannot answer; the first request of a store says when the node is away (`OpenSearchUnavailableError`) | a check in `ready()` of the application, beside the one of Redis |
| The tools and the tests | given no node: the start provisions nothing and a store is refused at its first request; the configuration of the end-to-end tests names `http://localhost:9200` so that it loads; the privacy scripts are given the node, so an erasure through a copy listed in `data-subject-copies.ts` reaches OpenSearch | the specs of a context bind the port to `InMemoryReadModelStore`; an end-to-end test that goes through a store rebinds its port to the in-memory store in the end-to-end composition (the `ddd-ts-kit:e2e-fakes` region), which is what the kit recommends, or is given a node | `search: config.search` in `test/e2e/support/start-application.ts`, with a node in the pipeline |
| A generator | none: a context writes its adapter by hand, as the guidance of the project shows | the port of a read model is not generated yet either (`generate projection` writes the projector alone) | `generate read-model --search`, with the port, once the projection generator writes the port |
| The pipeline of a generated project | unchanged: no OpenSearch service, nothing calls it in its tests | a project with no store would pay a node for nothing | an OpenSearch service in the integration job, once a project holds an adapter to its contracts there |
| A context that sets its own transport or tenancy | refused by `search/store-from-platform` on the text of every production file of a context: an import names `OpenSearchReadModelStore` and its refusals only; the store is named in its import and in `extends OpenSearchReadModelStore<` only; a class that extends it has a constructor that calls `super(<parameter>.options(..))`; no file of a context spreads `...<x>.options(` | structural checks of the text are cheap and do not misfire on a field of a row named `transport` | a rule on the syntax tree, if a bypass the text does not show comes up |
| The node in the compose stack | `opensearchproject/opensearch:3`, pinned by the digest the kit runs its specs on, one node, security plugin off, half a gibibyte of heap, port 9200, a volume | the server the package is proven on, for one machine | another tag in `docker-compose.yml` |
| The variables | `OPENSEARCH_URL` required; `OPENSEARCH_USERNAME` and `OPENSEARCH_PASSWORD` both or neither | the user of the security plugin is what a deployment sets; one of the two alone is a mistake | an `authorization` header (`ApiKey`, `Bearer`) in `readSearch`, which `fetchTransport` takes already |

## Consequences

A project that adds a store gets its index created before the first request, under the tenancy of
the project, without a line of wiring; a tenant created later, an organisation of the identity
preset included, gets its alias at its first request, with no restart. The end-to-end tests of a
project give no node: a spec that goes through a store binds its port to the in-memory store in
the end-to-end composition, or is given a node. The `infra:up` script starts the node with the rest
of the compose stack, about a gibibyte of memory.

## Next steps

- `search/store-from-platform` reads the text, not the syntax tree: an option set after the
  constructor, or a store reached through a variable of another type, is not seen.

## When to revisit

When the projection generator writes the port of a read model (a generator of the OpenSearch
adapter), when the rebuild of the store exists (a job of the platform), and when a second search
engine comes (a second value of `stack.search`).
