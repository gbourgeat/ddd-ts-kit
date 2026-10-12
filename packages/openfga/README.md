# @ddd-ts-kit/openfga

The relationships of [`@ddd-ts-kit/auth`](../auth/README.md) on [OpenFGA](https://openfga.dev),
the CNCF implementation of Zanzibar: the `RelationTupleStore` and the `Authorizer` ports answered
by an OpenFGA server, and its authorization model generated from the relationship schema the
project already declares with `defineSchema`. One source of truth: the schema; the model is
derived from it and checked against what the server holds.

```bash
npm install @ddd-ts-kit/openfga @openfga/sdk
```

`@openfga/sdk` (0.9.7, the official client) is an optional peer, imported by the `/sdk` entry
only. The main entry takes any client that fits `OpenFgaApi`, the subset of the official
client the adapters call.

## The model, from the schema

```ts
import { authorizationModelOf, ensureAuthorizationModel, modelDrift } from '@ddd-ts-kit/openfga';
import { relationshipSchema } from '@/platform/auth/relationship-schema';

authorizationModelOf(relationshipSchema); // the body of WriteAuthorizationModel, schema 1.1

const { modelId, changes } = await ensureAuthorizationModel(client, relationshipSchema);
```

| Schema of `@ddd-ts-kit/auth/rebac` | OpenFGA |
|---|---|
| a relation and the subjects it lists: `editor: ['user', 'group#member']` | a directly assignable relation (`this`) with `directly_related_user_types` |
| a name in a rewrite: `union('owner', 'editor')` | a computed userset |
| `union(...)`, `intersection(...)` | `union`, `intersection` |
| `exclusion(base, subtract)` | `difference` |
| `from('parent', 'edit')` | a tuple to userset |

`ensureAuthorizationModel(client, schema)` writes the generated model when the latest one of the
store differs, and answers the id in force and the differences (OpenFGA keeps every model; checks
use the latest unless a client pins one). Run it where the application is deployed or starts.
`modelDrift(authorizationModelOf(schema), served)` only compares: one line per type or
`type#relation` missing, extra or changed, empty when the two decide alike. A pipeline step reads
the latest model of the store and fails on any line, so the model is never edited by hand next to
the schema.

## The store and the authorizer

```ts
import { OpenFgaAuthorizer, OpenFgaRelationTupleStore } from '@ddd-ts-kit/openfga';
import { openFgaClient } from '@ddd-ts-kit/openfga/sdk';

const client = openFgaClient({ apiUrl: config.openfga.url, storeId: config.openfga.storeId });

const tuples = new OpenFgaRelationTupleStore(client, relationshipSchema);
const authorizer = new OpenFgaAuthorizer({ client, mapping: permissionMapping() });
```

- `OpenFgaRelationTupleStore` passes `relationTupleStoreContract`, as the PostgreSQL store does:
  writing a tuple twice and deleting one that is not there change nothing (the conflict options
  of OpenFGA 1.10 and later), writes and deletes go by 100, reads follow every page. A read by
  subject is one read per relation of the schema that accepts the kind of the subject, since
  OpenFGA reads by user within one object type.
- `OpenFgaAuthorizer` passes `authorizerContract`, with the mapping and the denial codes of
  `RelationBasedAuthorizer` (`ANONYMOUS`, `RESOURCE_REQUIRED`, `UNMAPPED_PERMISSION`,
  `NO_RELATION`): `Check` decides, `ListObjects` gives the scope of a search (`{ kind: 'ids' }`).
  A project moves between the two by binding, nothing else changes.

**The limits of `ListObjects`.** The server answers at most `OPENFGA_LIST_OBJECTS_MAX_RESULTS`
objects (1000 by default) and stops at `OPENFGA_LIST_OBJECTS_DEADLINE` (3 seconds by default),
and in both cases returns the objects found so far **without an error**. A search narrowed by a
cut list would lose elements in silence, so `OpenFgaAuthorizer` refuses an answer as long as
`listObjectsLimit` (default 1000: set it to the server's value) with
`ReverseExpansionLimitError`, as the in-process authorizer does beyond its own limit. A list cut
by the deadline cannot be told from a complete one by its answer: give the server a deadline
above the slowest listing you expect, and watch its latency. When the lists are that long,
narrow them first (a projection of the accessible ids, a coarser parent such as the clinic)
rather than raising the limits.

**A write is a call to a service.** It does not join the transaction of the unit of work: an
aggregate can commit without its tuple, or a tuple be written for an aggregate whose transaction
rolled back. Write tuples after the commit, from a domain event handler of phase `after-commit`
or from the consumer of an integration event (both retried, and the store is idempotent), never
from inside the transaction of the command; and decide what a request sees during the short
window when the aggregate exists without its relationship.

## Testing

The specs of this package run the two contract suites against an in-memory double of the tuple
endpoints, and against a real server when `DDD_TS_KIT_OPENFGA_URL` is set: the integration job
of the repository starts `openfga/openfga` v1.22.0, pinned by digest. A project holds its own
adapters to the same suites, each test on a store of its own (`createStore`, then
`ensureAuthorizationModel`).

## Limits

- No consistency token is carried: a check uses the default preference of the server
  (`MINIMIZE_LATENCY`), so a tuple just written may not be seen at once by every replica.
- No conditional tuples (OpenFGA conditions): the schema of the kit has no caveats either.
- The subject of an actor is `<type>:<id>`; an id holding a character OpenFGA refuses in an
  object id needs `subjectOf`.
- `expand` of `RelationBasedAuthorizer` has no equivalent here: use the `Expand` API of OpenFGA
  for debugging.

## See also

- [Authorization engines](../../docs/tools/authorization-engines.md): the PostgreSQL tuple store
  or OpenFGA, and when to choose which
- [Choosing access control](../../docs/guides/choosing-access-control.md)
