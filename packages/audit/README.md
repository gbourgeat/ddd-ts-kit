**English** · [Français](README.fr.md)

# @ddd-ts-kit/audit

A tamper-evident audit trail that the use cases never write to. Who was allowed or refused
what, which command ran and how it ended, which integration event occurred: each fact is an
append-only entry, hash-chained to the one before it, recorded by a bus middleware, the
authorization hook or an event subscription. No handler and no aggregate contains an audit
call.

```
npm i @ddd-ts-kit/audit
npm i knex pg          # only for @ddd-ts-kit/audit/knex
npm i drizzle-orm      # only for @ddd-ts-kit/audit/drizzle
```

| Entry | Holds | Imports |
|---|---|---|
| `@ddd-ts-kit/audit` | `InMemoryAuditTrail`, the three sources, `auditedFields`, the `AuditMasker` port and `hmacMasker`, `verifyChain`; re-exported from the kernel: `AuditEntry`, the `AuditTrail` and `AuditReader` ports and the types they name | the kernel only |
| `@ddd-ts-kit/audit/knex` | `KnexAuditTrail`, `createAuditTables`, `dropAuditTables` | `knex` (optional peer) |
| `@ddd-ts-kit/audit/drizzle` | `DrizzleAuditTrail`, `auditEntriesTable`, `auditChainsTable`, `auditGuardStatements` | `drizzle-orm` (optional peer) |
| `@ddd-ts-kit/audit/testing` | `auditTrailContract` | `@ddd-ts-kit/testing` (optional peer), the runner you pass |

## The idea

An audit trail answers "who did what, when, and was it allowed" to somebody who does not trust
the application: an auditor, a customer, a regulator. Three consequences:

- **It is fed from outside the use cases.** A handler that must remember to call the audit
  will forget, and an aggregate that calls it has stopped being a model. Authorization
  decisions, commands and integration events already pass through three places; the entries are
  written there.
- **It is append-only and each entry seals the previous one.** Changing, removing or
  reordering an entry breaks the chain at a place `verifyChain` names.
- **It holds identifiers and codes, never content.** Same rule as tracing and the aspects
  package: class names, permission ids, error codes; never arguments, results or messages.
  A value only enters when the project declares it, field by field.

It is not a log (logs are sampled, rotated and lost), not event sourcing (it does not rebuild
state) and not the `AuditStamp` of the kernel (`createdBy`, `updatedBy`: the last writer of a
row, not the history).

## The entry

The entry is a standard type of the kernel, and the two ports, `AuditTrail` and `AuditReader`,
are abstract classes of the kernel, so that code which records or lists depends on the kernel
alone. A port class is also what a binding is keyed by: there is no token beside it. This
package re-exports them, and holds everything that makes a trail tamper-evident: the chain, the
sources, redaction, verification and the stores.

```ts
interface AuditEntry {
  id: string;
  chain: string;             // 'tenant:<id>', or 'global' for work that names no tenant
  sequence: number;          // position in the chain: 1, 2, 3, without a gap
  occurredAt: Date;
  category: 'authorization' | 'command' | 'query' | 'integration-event' | 'authentication' | 'data-access' | string;
  action: string;            // a permission id, a command name, an event type
  outcome: 'allowed' | 'denied' | 'succeeded' | 'failed';
  reason?: string;           // a stable code: NO_MATCHING_ROLE, the code of a DomainError
  actor: { id: string; type: ActorType | 'unknown'; tenantId?: string };
  tenantId?: string;         // the tenant of the work in progress
  impersonatedBy?: string;
  sessionId?: string;
  resource?: { type: string; id: string };
  context?: string;          // bounded context
  correlationId: string;
  causationId?: string;
  origin: ExecutionOrigin;   // 'http', 'event', 'schedule', 'cli', ...
  changes?: Record<string, string | number | boolean | null | { masked: string }>;
  extensions: AuditEntryExtensionValues;
  previousHash: string;
  hash: string;
}
```

A source hands an `AuditRecord` (the entry without `chain`, `sequence`, `previousHash` and
`hash`) to the trail, which seals it. Actor, tenant, session, impersonation, correlation,
causation and origin are read from the kernel `ExecutionScope`, never threaded through a use
case.

A project adds its own fields by declaration merging, as for the kernel `Session`. They live
under `extensions`, are optional when read, and must be JSON (a `Date` or a class reads as
`never`), since they are hashed and stored as they are. The interface is the kernel's: augment
`@ddd-ts-kit/kernel`, next to the other extensions of the project (augmenting
`@ddd-ts-kit/audit` still works):

```ts
declare module '@ddd-ts-kit/kernel' {
  interface AuditEntryExtensions {
    readonly region: 'eu' | 'us';
  }
}
```

### One chain per tenant

Each entry belongs to one chain: `tenant:<id>` when the work in progress names a tenant,
`global` otherwise (`chainOfTenant`). The reasons: a tenant can be verified, exported and
handed over without the entries of the others; appends to a chain are serialized, so one chain
for everything would make every command of the system wait for the same lock; and an
offboarded tenant leaves chains that still verify. The price: the order between entries of two
tenants is given by `occurredAt` only, not proven by a hash. Pass `chainOf` to a trail to
decide otherwise (one chain per bounded context, a single chain for a small system).

### The hash

`hash` is the SHA-256, in lower-case hexadecimal, of the canonical form of the entry without
`hash`, so `previousHash`, `chain` and `sequence` are part of what is sealed. The canonical
form (`canonicalize`) is meant to be computed again by any program, in any language:

- JSON without whitespace, encoded in UTF-8;
- the keys of every object sorted by UTF-16 code unit, at every depth;
- a property whose value is `undefined` left out;
- `occurredAt` written in ISO 8601 UTC with milliseconds (`2026-03-01T10:00:00.000Z`);
- strings and numbers as `JSON.stringify` writes them.

The first entry of a chain has `previousHash` equal to `GENESIS_HASH` (64 zeros).

## Wiring the sources

Everything happens in the composition root. Assembled by hand first; the same pieces bound in
an application of `@ddd-ts-kit/di` come [after the sources](#in-an-application-of-ddd-ts-kitdi).
The order of the command middlewares matters:

```ts
// src/platform/audit/audit.ts
import { unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
import { authorizationMiddleware } from '@ddd-ts-kit/auth';
import { subscribeAll } from '@ddd-ts-kit/events';
import { auditDecisions, auditIntegrationEvents, auditMiddleware, auditedFields, hmacMasker, masked } from '@ddd-ts-kit/audit';
import { KnexAuditTrail } from '@ddd-ts-kit/audit/knex';

const trail = new KnexAuditTrail(unitOfWork, { schema: 'audit' }); // anything with `executor()`: the unit of work of @ddd-ts-kit/knex, or its context
const source = { scope, clock, ids };

commandBus
  // 1. who may: refused before any transaction opens
  .use(authorizationMiddleware({ authorizer, map, onDecision: auditDecisions(trail, { ...source, sensitivePermissions: ['records:medical-file.read'] }) }))
  // 2. what ran and how it ended: opens the unit of work itself
  .use(auditMiddleware(trail, {
    ...source,
    unitOfWork,
    masker: hmacMasker(config.auditMaskingSecret, { keyId: 'k1' }),
    fields: [auditedFields(RescheduleAppointmentCommand, ['status', 'startsAt', masked('patientEmail')], {
      resource: (command) => ({ type: 'appointment', id: command.appointmentId }),
      context: 'scheduling',
    })],
  }))
  // 3. joins the transaction opened by 2
  .use(unitOfWorkMiddleware(unitOfWork));

// 4. what occurred between contexts
subscribeAll(eventBus, auditIntegrationEvents(trail, { registry, clock, ids, processed, unitOfWork }));
```

### a. Authorization decisions

`auditDecisions(trail, options)` returns the `onDecision` function of the authorization
middleware of `@ddd-ts-kit/auth`. The types match structurally: this package does not depend on
the auth package. Each entry has category `authorization`, the permission id as `action`,
`allowed` or `denied` as outcome, the denial code as `reason`, the resource of the decision.

What is recorded by default:

| Decision | Recorded |
|---|---|
| denied, command or query | always |
| allowed, anything that is not a read | always |
| allowed read of a permission listed in `sensitivePermissions` | always |
| any other allowed read | no |

Recording every list and every page view drowns the trail and makes it expensive to keep, so
the allowed reads are the ones you choose. `allowedReads: 'all'` records them all,
`allowedReads: { sample: 0.01 }` one in a hundred. A read is, by default, a decision whose
`kind` is `query`: the middleware takes it from the bus that carried the message, whatever the
class is named. A decision taken outside a bus names no kind and is recorded. Pass `isRead` to
decide otherwise.

When the decision concerns another actor than the one of the execution context (a consumer
sending a command on behalf of a user), the entry names the actor of the decision with type
`unknown`: its type and tenant are not in what the hook receives.

### a'. Refusals at the edge

A request a guard refuses (`HasRole`, `HasScope`, `TenantMember`, a tenant the caller does not
belong to) never reaches a use case, so the authorization middleware does not see it. The HTTP
pipeline reports it to `onGuardRefusal`, and `auditGuardRefusals(trail, { clock, ids })` records
it: category `authorization`, action `http:<operationId>`, outcome `denied`, the code of the
refusal as `reason` (`FORBIDDEN`, `UNAUTHORIZED`), and the actor, session, tenant and correlation
of the request. A caller without a credential is not recorded: it is no one to hold to account,
the tenant it addressed is its own choice, and recording it would let unauthenticated traffic
write to the trail (and open hash chains) without bound; those refusals belong to the access log
and to rate limiting. A recorded refusal is in the tenant of the caller's credential. A guard
that fails instead of refusing (a lookup that threw, not a `DomainError`) is not reported.

```ts
mountExpress(app, routes, { ...boundary, onGuardRefusal: auditGuardRefusals(trail, { clock, ids }) });
```

### b. Commands, and the unit of work

`auditMiddleware` records each command with outcome `succeeded` or `failed`, and the `code` of
the `DomainError` as reason. A failure that is not a `DomainError` is recorded as
`UNEXPECTED_ERROR`: neither its class nor its message enters the trail, they quote data.
`queries: [ReadMedicalFileQuery]` or `queries: 'all'` records queries too.

Two requirements pull in opposite directions: the entry of a **failed** command must survive
the rollback, and the entry of a **succeeded** command must not exist if its transaction did
not commit. A middleware placed inside the unit of work loses the first, one placed outside
loses the second (a crash between the commit and the record, or an entry written for a commit
that was then refused). Hence the arrangement: the middleware is installed **before**
`unitOfWorkMiddleware` and is given the unit of work.

- It opens the unit of work itself; `unitOfWorkMiddleware`, and any nested `run`, join that
  transaction.
- After the handler returns, it writes the `succeeded` entry in that transaction. The entry
  and the state change commit together, or neither exists. If the entry cannot be written, the
  command fails and rolls back: no state change without its trace.
- When the handler throws, or the commit is refused, the transaction is gone; the middleware
  then writes the `failed` entry outside of it, and rethrows the failure of the use case. If
  that write fails too, the caller still receives the failure of the use case, and
  `onLostRecord` is told.

Without `unitOfWork` (no database, the in-memory trail) the middleware records after the
handler. Recording through the outbox would also be atomic for successes, but an outbox row
shares the fate of the transaction, so it cannot carry the failures: it solves half of the
problem.

Put the authorization middleware before this one. A refused command then leaves one
`authorization denied` entry and opens no transaction; with the opposite order it would also
leave a `command failed` entry with reason `FORBIDDEN`.

### c. Integration events

`auditIntegrationEvents(trail, options)` returns one subscription per event type of the
registry, to hand to `subscribeAll`. It reads the envelope only (type, id, correlation), never
the payload: the entry says that `billing.invoice.issued` occurred, with the event id as
`causationId` and the correlation of the envelope. Delivery is at least once, so it
deduplicates by event id through the `ProcessedEventStore` it is given, under the consumer
name `audit`; with `unitOfWork`, the mark and the entry commit together.

### d. By hand, the exception

`AuditTrail.record` stays available for what none of the three sources can see: a
`data-access` entry written by infrastructure, such as an export. `auditRecordOf` fills
everything the scope knows:

```ts
// infrastructure/external/appointment-export.ts
await trail.record(auditRecordOf({ scope, clock, ids }, {
  category: 'data-access',
  action: 'scheduling.appointments.export',
  outcome: 'succeeded',
  changes: { rows: 2000, format: 'csv' },
}));
```

This is infrastructure code. A call to the trail in `domain/` or `application/` is the defect
this package exists to prevent.

### In an application of `@ddd-ts-kit/di`

The store is bound to both ports, and the masker to its own, each under its class:

```ts
// src/platform/audit/audit.module.ts
import { AuditReader, AuditTrail } from '@ddd-ts-kit/kernel';
import { defineContextModule } from '@ddd-ts-kit/di';
import { AuditMasker, hmacMasker } from '@ddd-ts-kit/audit';
import { KnexAuditTrail } from '@ddd-ts-kit/audit/knex';

export const trail = new KnexAuditTrail(unitOfWork, { schema: 'audit' }); // the unit of work bound to `UnitOfWork` and `KnexContext`

export const auditModule = defineContextModule({
  name: 'audit',
  register(builder) {
    builder.bind(AuditTrail).toValue(trail);
    builder.bind(AuditReader).toValue(trail);
    builder.bind(AuditMasker).toValue(hmacMasker(config.auditMaskingSecret, { keyId: 'k1' }));
  },
});
```

`builder.bind(AuditTrail).toClass(KnexAuditTrail, [KnexContext])` binds a store with its default
options instead, `KnexContext` being the port of `@ddd-ts-kit/knex`.

The sources are installed where the buses are built. The command bus of `kernelModule()` runs
the use case guard, then the unit of work; the audit middleware has to sit between the two, so
the bus is given through the options:

```ts
// src/main.ts
import { AuditTrail, InMemoryCommandBus, unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
import { UseCaseGuard, createApplication, kernelModule } from '@ddd-ts-kit/di';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { AuditMasker, auditDecisions, auditMiddleware } from '@ddd-ts-kit/audit';

const source = { scope, clock, ids };

const app = createApplication({
  modules: [
    kernelModule({
      executionScope: scope,
      clock,
      ids,
      unitOfWork,
      commandBus: (resolve) =>
        new InMemoryCommandBus()
          .use((message, next, info) => resolve(UseCaseGuard).check(message, next, info))
          .use(auditMiddleware(resolve(AuditTrail), { ...source, unitOfWork, masker: resolve(AuditMasker), fields }))
          .use(unitOfWorkMiddleware(unitOfWork)),
    }),
    auditModule,
    schedulingModule,
    authorizationModule({ authorizer, onDecision: auditDecisions(trail, { ...source, sensitivePermissions: ['records:medical-file.read'] }) }),
  ],
  authorization: 'required',
});
```

A project generated by the CLI with `--audit on` (the default) has this wiring under
`src/platform/audit/`: `create-audit.ts` builds the trail and its three sources,
`audit.module.ts` binds the two ports, subscribes the integration events under the consumer
name `audit` and registers the protected `SearchAuditEntriesQuery`, and
`src/platform/buses/create-command-bus.ts` places the audit middleware between the use case
guard and the unit of work.

A handler or an adapter that needs the trail names the port in its dependencies and receives
the store: `[AuditReader]` for the query that lists entries (see [Querying](#querying)),
`[AuditTrail]` for the infrastructure adapter that records by hand.

## Redaction

**By default an entry carries no payload.** `changes` exists only for what was declared:

```ts
auditedFields(RescheduleAppointmentCommand, ['status', 'startsAt', masked('patientEmail')]);
auditedProjection(ExportAppointmentsCommand, (command) => ({ plain: { format: command.options.format } }));
```

- A field that is not listed is never read. The compiler refuses a name the message does not
  have.
- A value is kept only if it is a string, a number, a boolean, `null`, a bigint (as text) or
  a `Date` (as an ISO instant). An object is never stored whole: pick its scalars with
  `auditedProjection`.
- `masked('patientEmail')` stores `{ masked: '<keyId>:<hex>' }`: the HMAC-SHA-256 of the value
  under a secret (`hmacMasker`). Two entries about the same email carry the same mask, so
  "every entry about this person" can be answered by masking the email again; the email itself
  is not there, and without the secret a guess cannot be checked. A plain hash would not do: an
  email or a phone number is guessed in seconds.
- A field declared `masked` without a masker is refused when the middleware is built; a
  projection that asks for a mask without one fails the command at its first use.

**What must never go in**, declared or not:

- free text (a comment, a reason typed by a user, a message body): it contains anything;
- credentials and tokens, session cookies, API keys, one-time codes, even hashed;
- whole payloads, request bodies, aggregates, results of queries;
- error messages and stack traces: record the `code`;
- special categories of personal data (health, opinions, biometrics), even masked, unless a
  decision record says why.

### The right to erasure and an append-only chain

An entry cannot be deleted without breaking its chain, and a regulation may require that
personal data be erased. The two coexist as long as the chain never holds the data:

1. **Keep personal data out.** An actor id, a resource id, a permission id are identifiers. If
   your identifiers are themselves personal data (an email as user id), fix that first, or
   mask them at the boundary.
2. **Mask what you must correlate.** A masked value is not readable; it is still linked to a
   person for whoever holds the secret.
3. **Crypto-shredding for erasure.** Write a masker that derives one key per data subject (or
   per tenant) from a key store, using the `MaskingSubject` it receives (`actorId`, `tenantId`,
   `resource`). `AuditMasker` is a port, an abstract class with the one method `mask`: the
   adapter `implements` it and is bound under it:

   ```ts
   // infrastructure/external/per-subject-masker.ts
   export class PerSubjectMasker implements AuditMasker {
     constructor(private readonly keys: SubjectKeys) {}

     async mask(value: AuditScalar, subject: MaskingSubject): Promise<string> {
       const key = await this.keys.keyOf(subject.resource?.id ?? subject.actorId); // created on first use

       return hmacMasker(key.secret, { keyId: key.id }).mask(value, subject);
     }
   }

   builder.bind(AuditMasker).toClass(PerSubjectMasker, [SubjectKeys]);
   ```

   Erasing a person is deleting their key: every mask made with it becomes a random-looking
   token nobody can recompute, the entries stay, the hashes stay valid. The key store is then
   the system to protect and to back up with care; this package does not provide one.

What stays after erasure is "an actor with this opaque id did this at that time". Whether that
is acceptable is a legal question for the project, to answer before the first entry is written.

## Verification and anchoring

```ts
const outcome = await verifyChain(reader, { chain: 'tenant:acme' });
// { valid: true, checked: 1842 }
// { valid: false, checked: 311, break: { kind: 'altered-content', chain: 'tenant:acme', position: 311, sequence: 312, entryId: '...' } }
```

`verifyChain(entries | reader, { chain?, from?, to?, checkpoints? })` walks a chain in the
order given and reports the **first** place where it stops holding:

| Kind | Meaning |
|---|---|
| `altered-content` | the entry does not hash to its `hash`, does not link to the entry before it, or disagrees with a checkpoint |
| `missing-entry` | the expected sequence is nowhere in what was examined (a hole, a missing head, a chain shorter than `to`) |
| `reordered` | the expected sequence exists elsewhere, or a position appears twice |

`position` is the index among the examined entries of the chain, `sequence` the sequence that
was expected there. Given entries (an export), every chain found is verified, and the entries
are never sorted first: a shuffled file is reported as such. Given a reader, `chain` is
required and the range is read page by page, then held in memory: verify long chains by ranges
(`from`, `to`). A range starting above 1 trusts the entry before it.

**Why anchoring.** The chain protects against whoever can change some rows. Whoever can
rewrite the whole table (a database administrator, an attacker with the owner's role) can
recompute every hash from the altered entry onwards: the result is a perfectly valid chain. The
only defence is a copy of some hashes where that person cannot write. `sealing` hands a
checkpoint over every N entries of a chain:

```ts
new KnexAuditTrail(unitOfWork, {
  schema: 'audit',
  sealing: { every: 1000, onSeal: (checkpoint) => outbox.append([auditChainSealed.create(checkpoint, meta)]) },
});
// later, against the checkpoints kept elsewhere:
await verifyChain(reader, { chain, checkpoints });
```

The hook runs when the entry is written, inside the unit of work when there is one. Appending
the checkpoint to the outbox there makes it leave only if the entry commits; a hook that calls
a remote service directly may anchor an entry whose transaction rolls back afterwards. Where
the checkpoints go is the project's choice: another database under another role, an object
store with retention lock, a transparency log, a signed timestamp. A truncated tail (the last
entries removed) is only seen by comparing with a later checkpoint or by asking for `to`.

## Stores

`InMemoryAuditTrail` implements both ports: the fake for tests (`entries` is the store, to
assert and to tamper with) and enough for an application without a database.

The SQL stores are for **PostgreSQL**. They write on the executor of the unit of work
(`KnexContext.executor()`, `DrizzleContext.executor()`): inside a transaction the entry shares
its fate, outside it is written at once in a transaction of its own.

```ts
// knex: a migration of the project
import { createAuditTables, dropAuditTables } from '@ddd-ts-kit/audit/knex';
export const up = (knex) => createAuditTables(knex, { schema: 'audit' });
export const down = (knex) => dropAuditTables(knex, { schema: 'audit' });

// drizzle: in the schema files drizzle-kit reads
import { auditChainsTable, auditEntriesTable, auditGuardStatements } from '@ddd-ts-kit/audit/drizzle';
export const auditEntries = auditEntriesTable('audit');
export const auditChains = auditChainsTable('audit');
// and in a custom migration (drizzle-kit generate --custom), since drizzle-kit writes no trigger:
for (const statement of auditGuardStatements('audit')) {
  await db.execute(sql.raw(statement));
}

new DrizzleAuditTrail(unitOfWork, { schema: 'audit' });
```

Two tables: `audit_entries` (primary key `(chain, sequence)`, unique `id`, indexes for the
reader) and `audit_chains`, one row per chain holding its last sequence and hash.

**Concurrency.** An append inserts the head row of its chain if it is missing, then takes it
with `SELECT ... FOR UPDATE`, computes the entry from it, inserts the entry and moves the head.
The row lock lasts until the transaction ends, so two appends to one chain never read the same
head and the chain cannot fork; appends to other chains do not wait. The primary key refuses a
duplicate position should the lock ever be bypassed. Under `REPEATABLE READ` or `SERIALIZABLE`
the second append fails with a serialization error instead of waiting, and the unit of work is
retried like any other.

**Append-only in the database too.** The migration helper creates the function
`audit_entries_append_only` and two triggers: `UPDATE`, `DELETE` and `TRUNCATE` on
`audit_entries` raise SQLSTATE `23001`, whoever asks. Triggers stop mistakes and application
bugs; a role that owns the table can drop them. So the application should not own the table.
Run the migrations with an owner role and give the application role only what it needs:

```sql
revoke all on all tables in schema "audit" from public;
grant usage on schema "audit" to app;
grant select, insert on "audit"."audit_entries" to app;
grant select, insert, update on "audit"."audit_chains" to app;
```

The application can then neither rewrite an entry, nor disable or drop the guard. What remains
is the owner role and the superuser, which is what anchoring is for.

A new store passes the same suite as these:

```ts
import { auditTrailContract } from '@ddd-ts-kit/audit/testing';
auditTrailContract({ describe, it, expect, beforeEach }, { name: 'MyAuditTrail', createTrail: () => freshTrail(), tamper });
```

## Querying

```ts
const page = await reader.search(
  { tenantId: 'acme', actorId: 'ada', category: 'authorization', outcome: 'denied', from, to },
  cursorPage({ limit: 50, sort: [{ field: 'occurredAt', direction: 'desc' }] }),
);
```

Filters: `actorId`, `resource` (`{ type, id? }`), `action`, `category`, `outcome`, period
(`from` included, `to` excluded), `correlationId`, `tenantId`, `chain`, `fromSequence`,
`toSequence`. Pagination uses the kernel types: an offset page answers `total`, a cursor page
`nextCursor`. Sort by `occurredAt` (then chain and sequence, the order a person reads in) or by
`sequence` (chain by chain, the order of verification).

`AuditReader` is a port of its own because reading the trail is itself a sensitive act. Expose
it as a use case like any other, which makes it protected and audited by the mechanisms above:

```ts
// application/queries/search-audit-entries/search-audit-entries.query.ts
import { AuthorizedQuery, type AuditEntry, type Page } from '@ddd-ts-kit/kernel';

export class SearchAuditEntriesQuery extends AuthorizedQuery<Page<AuditEntry>> { /* actor, tenantId, filter, page */ }

// authorization: deny by default, one permission, flagged sensitive
requires(SearchAuditEntriesQuery, auditPermissions['trail.read']);
auditDecisions(trail, { ...source, sensitivePermissions: ['audit:trail.read'] });
auditMiddleware(trail, { ...source, queries: [SearchAuditEntriesQuery] });
```

```ts
// application/queries/search-audit-entries/search-audit-entries.handler.ts
import { AuditReader, type AuditEntry, type Page } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';

@QueryHandler(SearchAuditEntriesQuery)
export class SearchAuditEntriesHandler {
  constructor(private readonly reader: AuditReader) {}

  execute(query: SearchAuditEntriesQuery): Promise<Page<AuditEntry>> {
    return this.reader.search({ ...query.filter, tenantId: query.tenantId }, query.page);
  }
}
```

Whoever reads the trail leaves an entry in it. The handler depends on `AuditReader` of the
kernel, which `application/` may import, and receives the store bound to it. It scopes the
filter to the tenant of the actor (an access scope computed by the authorizer), so one tenant
never lists another's entries.

In a multi-tenant project, bind `new TenantAuditReader(store, executionScope)` to
`AuditReader` instead of the store itself: every search is then confined to the tenant of the
work whatever its filter says (a filter naming another tenant or another chain finds nothing),
platform staff read across tenants only under an elevation (`acrossTenants` of the kernel, itself
recorded), and work that names neither is refused (`NoCurrentTenantError`).

## Limits

- **PostgreSQL only** for the SQL stores: row locks, row comparison for cursors, `jsonb`,
  triggers. Another database is another adapter of the two ports, held to the contract suite.
- **Appends to one chain are serialized**, and inside a unit of work the head stays locked
  until the commit. `auditMiddleware` writes last, so the window is short; a handler that
  records by hand early and then works for long makes the other writers of its tenant wait.
- **A rolled back unit of work frees its positions**: the next entry reuses the sequence.
  There is never a gap, and never an entry for work that did not commit.
- **A command sent from inside another unit of work** (a consumer whose `consume` opened one)
  shares its fate: if that outer transaction rolls back, the `failed` entry goes with it.
- **The chain proves integrity, not completeness of capture**: a fact that never reached a
  source (a script writing to the database, a route bypassing the bus) is not there. Keeping
  every route on the bus is what `authz/declared` and the dependency rules are for.
- **`occurredAt` is the clock of the instance that recorded**; inside a chain, the order is
  the sequence.
- **Verification reads the range into memory**, and trusts the entry before `from`.
- **No retention or archiving policy** is provided: how long entries are kept, and where old
  chains go, is a decision of the project. Deleting old entries means dropping the guard on
  purpose, by the owner role, after anchoring the entry that becomes the new start.
- drizzle wraps driver errors and prints the parameters of the failed statement in the
  message of its error. The entry of an audit insert holds identifiers and codes only; still,
  log the `code` of such an error, not its message.
