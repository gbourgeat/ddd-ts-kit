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
| When an index is provisioned | before the first request of each store, and at the start for the stores built by then; `ensureMapping()` without tenancy, `provision(tenant)` for each tenant of `TENANTS` | the containers build an adapter when a handler first needs it, so a provisioning at the start alone would find no store; provisioning is idempotent | provisioning at the start only, once the containers build the adapters at the start |
| A project with no store | calls nothing: no request at the start | `npm run dev`, the tests of the project and the end-to-end runs of the kit need no node | none needed |
| Readiness | no readiness check on OpenSearch | a read model that lags is not an application that cannot answer; the first request of a store says when the node is away (`OpenSearchUnavailableError`) | a check in `ready()` of the application, beside the one of Redis |
| The tools and the tests | given no node: a store built there is refused at its first request; the configuration of the end-to-end tests names `http://localhost:9200` so that it loads | a test of a context binds the port to `InMemoryReadModelStore`, and a test that reaches a node by accident fails rather than passing on another node | `search: config.search` in `test/e2e/support/start-application.ts` |
| A generator | none: a context writes its adapter by hand, as the guidance of the project shows | the port of a read model is not generated yet either (`generate projection` writes the projector alone) | `generate read-model --search`, with the port, once the projection generator writes the port |
| The pipeline of a generated project | unchanged: no OpenSearch service, nothing calls it in its tests | a project with no store would pay a node for nothing | an OpenSearch service in the integration job, once a project holds an adapter to its contracts there |
| A context that sets its own transport or tenancy | refused by `search/store-from-platform` on the imports: a context names `OpenSearchReadModelStore` and its refusals, nothing else of the package | an import is cheap to read and catches the transport and the tenancy written by hand | a rule that reads the argument of `super(...)`, the next step below |
| The node in the compose stack | `opensearchproject/opensearch:3`, pinned by the digest the kit runs its specs on, one node, security plugin off, half a gibibyte of heap, port 9200, a volume | the server the package is proven on, for one machine | another tag in `docker-compose.yml` |
| The variables | `OPENSEARCH_URL` required; `OPENSEARCH_USERNAME` and `OPENSEARCH_PASSWORD` both or neither | the user of the security plugin is what a deployment sets; one of the two alone is a mistake | an `authorization` header (`ApiKey`, `Bearer`) in `readSearch`, which `fetchTransport` takes already |

## Consequences

A project that adds a store gets its index created before the first request, under the tenancy of
the project, without a line of wiring. The end-to-end tests of a project give no node: a spec that
goes through a store reaches it only once `start-application.ts` passes the node. The
`infra:up` script starts the node with the rest of the compose stack, about a gibibyte of memory.

## Next steps

- `search/store-from-platform` reads the imports only: an adapter that spreads the answer of
  `search.options` and overrides `tenancy` or `transport` is not seen. The next step reads the
  argument of `super(...)` in a class that extends `OpenSearchReadModelStore`: it must be the call
  of `options` on a parameter typed `SearchIndexes`.
- A tenant created after the start is provisioned by the platform only at the next start; a port
  of the platform that the use case creating a tenant calls is the next step, with the identity
  preset.

## When to revisit

When the projection generator writes the port of a read model (a generator of the OpenSearch
adapter), when the rebuild of the store exists (a job of the platform), and when a second search
engine comes (a second value of `stack.search`).
