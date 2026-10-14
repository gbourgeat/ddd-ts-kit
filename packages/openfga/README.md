**English** · [Français](README.fr.md)

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

![The three jobs of the package in an application: the use cases ask the Authorizer port, which OpenFgaAuthorizer implements with Check and ListObjects; a context adapter writes tuples after the commit through the RelationTupleStore port, which OpenFgaRelationTupleStore implements with Write and Read; the relationship schema is the one source of the model, which authorizationModelOf generates and ensureAuthorizationModel or modelDrift write or compare on the server](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/openfga-place-in-an-application.svg)

The package does three jobs, each against one store of an OpenFGA server: it decides
(`OpenFgaAuthorizer`), it holds the tuples (`OpenFgaRelationTupleStore`) and it keeps the model
of the server equal to the schema (`authorizationModelOf`, `ensureAuthorizationModel`,
`modelDrift`). Handlers never import it: they depend on the ports of `@ddd-ts-kit/auth`, and the
platform binds these adapters to them, exactly as it binds `RelationBasedAuthorizer` and a tuple
store in your own database.

## The model, from the schema

The schema is the one `RelationBasedAuthorizer` evaluates in process: types, the relations a
tuple can hold, and the permissions derived from them. `authorizationModelOf` turns it into the
body of `WriteAuthorizationModel` (schema 1.1). Here is a simplified schema, in the spirit of
the one of the example application:

<!-- checked sample -->
```ts
import { defineSchema, from, union } from '@ddd-ts-kit/auth/rebac';
import { authorizationModelOf } from '@ddd-ts-kit/openfga';

// Who is what to which element: a practice has managers, a calendar its holder and assistants.
export const relationshipSchema = defineSchema({
  user: {},
  practice: { relations: { manager: ['user'] }, permissions: { manage: union('manager') } },
  calendar: {
    relations: { holder: ['user'], assistant: ['user'], practice: ['practice'] },
    permissions: { run: union('holder', 'assistant', from('practice', 'manage')) },
  },
  appointment: {
    relations: { patient: ['user'], calendar: ['calendar'] },
    permissions: { change: union('patient', from('calendar', 'run')) },
  },
});

// { schema_version: '1.1', type_definitions: [user, practice, calendar, appointment] }
export const model = authorizationModelOf(relationshipSchema);
```

The generated model decides as this one, written in the modelling language of OpenFGA (for
reading only: the package writes the JSON form, and nobody writes this text by hand):

```text
model
  schema 1.1

type user

type practice
  relations
    define manager: [user]
    define manage: manager

type calendar
  relations
    define holder: [user]
    define assistant: [user]
    define practice: [practice]
    define run: holder or assistant or manage from practice

type appointment
  relations
    define patient: [user]
    define calendar: [calendar]
    define change: patient or run from calendar
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
use the latest unless a client pins one). Run it where the application is deployed or starts:

<!-- checked sample -->
```ts
import type { Schema } from '@ddd-ts-kit/auth/rebac';
import { ensureAuthorizationModel } from '@ddd-ts-kit/openfga';
import { openFgaClient } from '@ddd-ts-kit/openfga/sdk';

declare const relationshipSchema: Schema;
declare const config: { readonly openfga: { readonly url: string; readonly storeId: string } };

const client = openFgaClient({ apiUrl: config.openfga.url, storeId: config.openfga.storeId });

// The first run writes the model; the next ones write nothing until the schema changes.
const { modelId, changes } = await ensureAuthorizationModel(client, relationshipSchema);

console.log(`authorization model ${modelId}`, changes);
```

`modelDrift(authorizationModelOf(schema), served)` only compares: one line per type or
`type#relation` missing, extra or changed, empty when the two decide alike. A pipeline step reads
the latest model of the store and fails on any line, so the model is never edited by hand next to
the schema:

<!-- checked sample -->
```ts
import type { Schema } from '@ddd-ts-kit/auth/rebac';
import { authorizationModelOf, modelDrift, type OpenFgaApi } from '@ddd-ts-kit/openfga';

declare const client: OpenFgaApi;
declare const relationshipSchema: Schema;

const { authorization_model: served } = await client.readLatestAuthorizationModel();
const drift = modelDrift(authorizationModelOf(relationshipSchema), served);

if (drift.length > 0) {
  console.error(drift.join('\n'));
  process.exitCode = 1;
}
```

Run against a store that still holds the model of a schema without assistants, it prints:

```text
calendar#assistant is in the schema, not in the store: this [user]
calendar#run differs: the schema says union(holder, assistant, from(practice, manage)) [], the store union(holder, from(practice, manage)) []
```

## The store and the authorizer

In the composition root, one client bound to one store serves both adapters. The mapping says,
per resource type, which relation of the model each permission of the kit stands for, as for
`RelationBasedAuthorizer`:

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import type { PermissionMapping, Schema } from '@ddd-ts-kit/auth/rebac';
import { OpenFgaAuthorizer, OpenFgaRelationTupleStore } from '@ddd-ts-kit/openfga';
import { openFgaClient } from '@ddd-ts-kit/openfga/sdk';

declare const relationshipSchema: Schema;
declare const config: { readonly openfga: { readonly url: string; readonly storeId: string } };

export const schedulingPermissions = definePermissions('scheduling', {
  'appointment.cancel': { description: 'Cancel an appointment' },
});

// To cancel an appointment is to hold the relation `change` on it.
const mapping: PermissionMapping = {
  appointment: { [schedulingPermissions['appointment.cancel'].id]: 'change' },
};

const client = openFgaClient({ apiUrl: config.openfga.url, storeId: config.openfga.storeId });

// The same two ports as the in-process authorizer and a tuple store in your database.
export const tuples = new OpenFgaRelationTupleStore(client, relationshipSchema);
export const authorizer = new OpenFgaAuthorizer({ client, mapping, listObjectsLimit: 1000 });
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

![Left, check: an anonymous actor is denied ANONYMOUS, a check without a resource RESOURCE_REQUIRED, an unmapped permission UNMAPPED_PERMISSION, all before any call; otherwise Check on the server answers allowed or NO_RELATION. Right, listAccessible: anonymous or unmapped gives the scope none; otherwise ListObjects, refused with ReverseExpansionLimitError when the answer reaches listObjectsLimit, else the scope ids](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/openfga-authorizer-decisions.svg)

What the authorization middleware and a search handler receive, with the tuples of the
example (`ada` assists the calendar of Dr Grace, which holds appointment 42):

<!-- checked sample -->
```ts
import type { Permission } from '@ddd-ts-kit/auth';
import type { Actor } from '@ddd-ts-kit/kernel';
import type { OpenFgaAuthorizer, OpenFgaRelationTupleStore } from '@ddd-ts-kit/openfga';

declare const tuples: OpenFgaRelationTupleStore;
declare const authorizer: OpenFgaAuthorizer;
declare const cancel: Permission;

await tuples.write([
  { object: 'calendar:dr-grace', relation: 'assistant', subject: 'user:ada' },
  { object: 'appointment:42', relation: 'calendar', subject: 'calendar:dr-grace' },
]);

const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };

// Check user:ada change appointment:42: { allowed: true }
export const decision = await authorizer.check({
  actor: ada,
  permission: cancel,
  resource: { type: 'appointment', id: '42' },
});

// ListObjects user:ada change appointment: { kind: 'ids', ids: ['42'] }, the ids the search may read
export const scope = await authorizer.listAccessible({ actor: ada, permission: cancel, resourceType: 'appointment' });
```

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
rolled back. Write tuples after the commit, never from inside the transaction of the command,
and decide what a request sees during the short window when the aggregate exists without its
relationship:

```ts
// Instead of: a handler of the default phase (before-commit) runs inside the transaction,
// so a rollback after it leaves on the server a tuple for an appointment that does not exist.
@DomainEventHandler(AppointmentBooked)
export class RelationshipsOnAppointmentBooked { /* ... */ }
```

<!-- checked sample -->
```ts
import type { DomainEvent } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

export class AppointmentBooked implements DomainEvent {
  static readonly eventName = 'scheduling.appointment.booked';

  readonly name = AppointmentBooked.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly booking: { readonly calendarId: string; readonly patientId: string },
  ) {}
}

// The port of the context, in its own words; its adapter writes the tuples to OpenFgaRelationTupleStore.
export abstract class SchedulingRelationships {
  abstract recordAppointment(appointment: { appointmentId: string; calendarId: string; patientId: string }): Promise<void>;
}

// Write: after the commit, never when the transaction rolled back.
@DomainEventHandler(AppointmentBooked, { phase: 'after-commit' })
export class RelationshipsOnAppointmentBooked implements DomainEventHandler<AppointmentBooked> {
  constructor(private readonly relationships: SchedulingRelationships) {}

  async handle(event: AppointmentBooked): Promise<void> {
    await this.relationships.recordAppointment({ appointmentId: event.aggregateId, ...event.booking });
  }
}
```

A handler of phase `after-commit` runs **at most once**: a crash between the commit and its run,
or a server that does not answer, loses the tuple, and its failure is only reported. A tuple
that must not be lost goes through the outbox: publish an integration event with the change, and
write the tuple from its consumer, which is delivered at least once and retried until it
succeeds. The store is idempotent, so a repeated delivery changes nothing.

## Testing

The specs of this package run the two contract suites against an in-memory double of the tuple
endpoints, and against a real server when `DDD_TS_KIT_OPENFGA_URL` is set: the integration job
of the repository starts `openfga/openfga` v1.22.0, pinned by digest. A project holds its own
adapters to the same suites, each test on a store of its own (`createStore`, then
`ensureAuthorizationModel`). The tuples the store contract writes are about documents and groups
(`document:1#editor@group:eng#member`, `document:1#parent@group:eng`): the store it runs on holds
a model that describes them.

<!-- checked sample -->
```ts
import { OpenFgaClient } from '@openfga/sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineSchema } from '@ddd-ts-kit/auth/rebac';
import { relationTupleStoreContract } from '@ddd-ts-kit/auth/testing';
import { ensureAuthorizationModel, OpenFgaRelationTupleStore, type OpenFgaApi } from '@ddd-ts-kit/openfga';
import { openFgaClient } from '@ddd-ts-kit/openfga/sdk';

const OPENFGA_URL = process.env['OPENFGA_TEST_URL'] ?? '';

// The types and relations of the tuples the contract writes.
const contractSchema = defineSchema({
  user: {},
  group: { relations: { member: ['user', 'group#member'] } },
  document: {
    relations: { editor: ['user', 'group#member'], viewer: ['user', 'group#member'], parent: ['group'] },
  },
});

let stores = 0;

// A store of its own per test, holding the model of the schema: no test sees the tuples of another.
async function freshStore(): Promise<OpenFgaApi> {
  const admin = new OpenFgaClient({ apiUrl: OPENFGA_URL });
  const { id: storeId } = await admin.createStore({ name: `contract-${process.pid}-${(stores += 1)}` });
  const client = openFgaClient({ apiUrl: OPENFGA_URL, storeId });

  await ensureAuthorizationModel(client, contractSchema);

  return client;
}

// Skipped without a server, as the specs of the package are.
relationTupleStoreContract(
  { describe: describe.runIf(OPENFGA_URL !== ''), it, expect, beforeEach, afterEach },
  {
    name: 'OpenFgaRelationTupleStore on an OpenFGA server',
    create: async () => new OpenFgaRelationTupleStore(await freshStore(), contractSchema),
  },
);
```

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
- [Domain and integration events](../../docs/concepts/domain-and-integration-events.md): the
  phases of a domain event handler, and what reaches another process at least once
