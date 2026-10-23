**English** · [Français](authentication-and-authorization.fr.md)

# Authentication and authorization

**Summary.** Authentication answers "who is calling", authorization answers "may this actor do
this, on this element". They are two responsibilities with two homes: authentication is a
platform concern at the boundary, authorization is an application concern declared per use
case and decided through one port. The model behind that port is a choice: roles (RBAC),
policies over attributes (ABAC) or relationships in the manner of Google Zanzibar (ReBAC). This
page explains the three, compares them fairly, and shows how the kit keeps the choice
reversible. A third question, "is this a valid thing to do at all", is an invariant and is
covered in [Invariants, permissions and validation](invariants-permissions-validation.md).

## Two questions, two places

| | Authentication | Authorization |
|---|---|---|
| Question | who is calling? | may this actor do this, on this? |
| Input | a credential (a bearer token, a session cookie, an API key) | an actor, a permission, sometimes an element |
| Output | an actor and a session, as plain data | allowed, or denied with a stable reason code |
| Where | the platform, at the boundary | the application layer of each context |
| Changes when | the identity provider changes | the business changes who may do what |

Keeping them apart has a practical effect. The identity provider can be replaced without
touching a use case, and a business rule about rights can change without touching a route. The
credential never travels inward: the boundary turns it into an `Actor` (subject, tenant, roles
or attributes) and a `Session` (how and when the actor authenticated), and from there on only
that data moves. The token itself is kept nowhere.

![The path of a request: the authenticator of the platform turns the bearer token into an Actor and a Session; the route builds the command with that actor; the authorization middleware of the command bus refuses with FORBIDDEN before any transaction, or lets the handler run; the handler loads the appointment and asks Access, which runs the policies then the authorizer; the aggregate holds the invariants](../assets/diagrams/authentication-and-authorization-request-flow.svg)

## Deny by default, declared per use case

Every command, query and route says which permission it requires, or says that it is public.
There is no third state: a use case nobody thought about is not reachable. This is rule
[`authz/declared`](../ARCHITECTURE.md#3-dependency-rules).

A permission is data owned by the context, named in its ubiquitous language:
`appointment.book`, `appointment.cancel`, `calendar.manage`. It is not a role. Roles such as
"receptionist" or "practitioner" belong to the model chosen in the composition root; the code
of a context names permissions only. That separation is what lets the model change later.

In the running domain:

| Use case | Requires | Why not simply a role test |
|---|---|---|
| `BookAppointment` | `appointment.book` | a client, a receptionist and an integration partner may all book; the list will change |
| `CancelAppointment` | `appointment.cancel`, plus a policy | "only the client who booked or the practitioner" depends on the loaded appointment |
| `SetWorkingHours` | `calendar.manage` | on the calendar of that practitioner, not on every calendar |
| `FindOpenSlots` | public | declared public on purpose, not by omission |

In code, the permissions are data of the context, and each message says what it requires or
that it is public. The middleware reads these declarations; the handler does not repeat them.

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, Query, type Actor } from '@ddd-ts-kit/kernel';
import { Public, Requires } from '@ddd-ts-kit/kernel/declarations';

// appointments.permissions.ts: data owned by the context, in its words.
export const appointmentsPermissions = definePermissions('appointments', {
  'appointment.book': { description: 'Book an appointment for a client' },
  'appointment.cancel': { description: 'Cancel a booked appointment' },
});
// appointmentsPermissions['appointment.cancel'].id is 'appointments:appointment.cancel'

// Protected: only an actor holding the permission reaches the handler. The actor comes first.
@Requires(appointmentsPermissions['appointment.cancel'], {
  resource: (command: CancelAppointment) => ({ type: 'appointment', id: command.appointmentId }),
})
export class CancelAppointment extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
    readonly reason: string,
  ) {
    super(actor);
  }
}

// Public on purpose: said, never implied.
@Public()
export class FindOpenSlots extends Query<readonly Date[]> {
  constructor(
    readonly practitionerId: string,
    readonly day: string,
  ) {
    super();
  }
}
```

A project generated with the explicit style writes the same requirement next to the
registration of the handler, `.requires(permission)` or `.public()`; see
[`@ddd-ts-kit/auth`](../../packages/auth/README.md) for both styles.

The decision is taken in the application layer, before the handler runs and before a
transaction opens. A route builds the command and nothing else; a repository applies the scope
it is handed and nothing else; the domain knows no actor. This is rule
[`authz/in-application`](../ARCHITECTURE.md#3-dependency-rules).

## Rules that need the loaded element

"A client may cancel only their own appointment" cannot be decided from the command alone: the
appointment must be loaded first. Such a rule is a policy: a named, pure function kept in
`application/authorization/`, with a spec of its own. The handler loads the aggregate and asks
the authorizer with it.

<!-- checked sample -->
```ts
import { Access, definePermissions, definePolicy } from '@ddd-ts-kit/auth';
import {
  AggregateRoot,
  AuthorizedCommand,
  Clock,
  NotFoundError,
  Repository,
  type Actor,
  type CommandHandler,
} from '@ddd-ts-kit/kernel';

// Declared here so that the sample compiles alone; in a project they are files of the context.
declare class Appointment extends AggregateRoot {
  readonly clientId: string;
  readonly practiceId: string;
  cancel(reason: string, at: Date): void;
}
declare abstract class AppointmentRepository extends Repository<Appointment> {}
declare class CancelAppointment extends AuthorizedCommand {
  readonly appointmentId: string;
  readonly reason: string;
}
const appointmentsPermissions = definePermissions('appointments', {
  'appointment.cancel': { description: 'Cancel a booked appointment' },
});

// appointments/application/authorization/only-the-client-or-the-practice-cancels.policy.ts
export const onlyTheClientOrThePracticeCancels = definePolicy<Appointment>({
  name: 'appointment.only-the-client-or-the-practice-cancels',
  permission: appointmentsPermissions['appointment.cancel'],
  appliesTo: (subject): subject is Appointment => subject instanceof Appointment,
  allows: (actor: Actor, appointment) =>
    actor.id === appointment.clientId || actor.attributes['practiceId'] === appointment.practiceId,
});

// appointments/application/commands/cancel-appointment/cancel-appointment.handler.ts
export class CancelAppointmentHandler implements CommandHandler<CancelAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  async execute(command: CancelAppointment): Promise<void> {
    const appointment = await this.appointments.findById(command.appointmentId);

    if (appointment === undefined) {
      throw new NotFoundError('Appointment not found');
    }

    await this.access.authorize(command.actor, appointmentsPermissions['appointment.cancel'], appointment);

    appointment.cancel(command.reason, this.clock.now());
    await this.appointments.save(appointment);
  }
}
```

`Access.authorize` runs every policy of the permission, then the authorizer, and raises
`ForbiddenError` (code `FORBIDDEN`, answered 403) whose reason is the name of the policy that
said no. A policy is a plain object, so its spec needs nothing else:

<!-- checked sample -->
```ts
import type { Policy } from '@ddd-ts-kit/auth';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { expect, it } from 'vitest';

interface Appointment {
  readonly clientId: string;
  readonly practiceId: string;
}
declare const onlyTheClientOrThePracticeCancels: Policy<Appointment>;
declare const appointment: Appointment; // booked by client-1 at practice-7

const now = new Date('2026-03-01T09:00:00.000Z');

it('lets the client who booked cancel, and nobody else outside the practice', () => {
  const client = anActor().named('client-1').build();
  const stranger = anActor().named('client-2').build();

  expect(onlyTheClientOrThePracticeCancels.allows(client, appointment, { now })).toBe(true);
  expect(onlyTheClientOrThePracticeCancels.allows(stranger, appointment, { now })).toBe(false);
});
```

The same rule written by hand in the handler would work once and be found nowhere else:

```ts
// instead of: a rule about rights hidden in a handler, with its own error, invisible to the audit trail
if (appointment.clientId !== command.actor.id) {
  throw new Error('not your appointment');
}

// write: one call; the rule is a named policy with its spec, its refusal reason and its audit record
await this.access.authorize(command.actor, appointmentsPermissions['appointment.cancel'], appointment);
```

The test that separates a policy from an invariant: would the rule hold whoever asks? "Not
after the cancellation window has passed" holds for everybody, so it is an invariant of the
aggregate (`AppointmentError.cancellationWindowPassed`, code `CANCELLATION_WINDOW_PASSED`).
"Only the client who booked" depends on who asks, so it is a policy.

## Searches are filtered by the query

Loading every appointment and filtering in memory leaks counts, breaks paging and is slow. The
handler asks the authorizer for the access scope of the actor (everything, nothing, a set of
ids or a filter) and hands it to the read port; the adapter turns it into the condition of the
statement. `SearchAppointments` for a client therefore reads only that client's rows, and page 2
is still page 2.

<!-- checked sample -->
```ts
import { Access, definePermissions, type AccessScope } from '@ddd-ts-kit/auth';
import { AuthorizedQuery, type Actor, type QueryHandler } from '@ddd-ts-kit/kernel';

const appointmentsPermissions = definePermissions('appointments', {
  'appointment.read': { description: 'Read appointments' },
});

export interface AppointmentRow {
  readonly id: string;
  readonly clientId: string;
  readonly startsAt: string;
}

// application/ports/appointment-search.port.ts: the read port receives a scope, never an actor.
export abstract class AppointmentSearch {
  abstract search(scope: AccessScope, limit: number): Promise<readonly AppointmentRow[]>;
}

export class SearchAppointments extends AuthorizedQuery<readonly AppointmentRow[]> {
  constructor(
    actor: Actor,
    readonly limit: number,
  ) {
    super(actor);
  }
}

export class SearchAppointmentsHandler implements QueryHandler<SearchAppointments> {
  constructor(
    private readonly access: Access,
    private readonly appointments: AppointmentSearch,
  ) {}

  async execute(query: SearchAppointments): Promise<readonly AppointmentRow[]> {
    // { kind: 'all' }, { kind: 'none' }, { kind: 'ids', ids } or { kind: 'filter', filter }
    const scope = await this.access.scope(query.actor, appointmentsPermissions['appointment.read'], 'appointment');

    return this.appointments.search(scope, query.limit);
  }
}
```

The adapter of the port turns the scope into a condition of its statement (here with Knex):

```ts
function visibleTo(appointments: Knex.QueryBuilder, scope: AccessScope): Knex.QueryBuilder {
  if (scope.kind === 'none') {
    return appointments.whereRaw('false');
  }

  if (scope.kind === 'ids') {
    return appointments.whereIn('id', [...scope.ids]);
  }

  return scope.kind === 'filter' ? appointments.where({ tenant_id: scope.filter['tenantId'] }) : appointments;
}
```

## Three models

### Roles (RBAC)

The actor has roles; a role grants permissions. The question is "does one of the actor's roles
grant this action". It fits when rights follow job functions and are the same for every
element: a receptionist may book for anyone, an administrator may manage every calendar. It is
cheap (no I/O per check) and easy to explain to an auditor.

Its limit is the element. As soon as "may edit" depends on which calendar, RBAC answers with
more roles (`practitioner-of-calendar-42`), which is the role explosion the literature warns
about.

![Three models side by side. Roles: the actor has roles, a role grants permissions, the same answer for every element. Attribute policies: the attributes of the actor, of the resource and of the moment feed permit and forbid rules, and a matching forbid wins. Relationships: stored tuples link calendar 42 to its owner Ada and to its parent clinic 7, of which Bob is a member, so a path of tuples grants Bob the calendar](../assets/diagrams/authentication-and-authorization-three-models.svg)

### Attribute policies (ABAC)

A rule reads attributes of the actor, of the resource and of the moment: "a receptionist may
book for practitioners of their own clinic, during opening hours, and never for a suspended
client". It fits when rights depend on properties rather than on identity, and when explicit
refusals are needed (a matching forbid wins over every permit).

Its costs: the attributes of the resource must be available at decision time (a projection or
a cache to maintain), rules spread out and need tests and discipline, and a predicate is not a
query, so listing "everything this actor may see" is not something a pure ABAC engine answers.

### Relationships (ReBAC, after Zanzibar)

Rights follow stored relationships between subjects and objects, written as tuples
`object#relation@subject`: `calendar:42#owner@user:ada`, `clinic:7#member@user:bob`,
`calendar:42#parent@clinic:7`. Permissions are relations derived from them: "may manage a calendar:
its owner, or a member of its parent clinic". The two core operations are check (is there a
path from this object to this actor) and list (which objects can this actor reach).

It fits when rights are per element and shared: ownership, teams, delegation ("my assistant
manages my calendar"), hierarchies. It answers lists by construction. Its costs: tuples must be
written whenever an aggregate is created or shared and kept in sync, a check costs several
reads bounded by a depth limit, listing grows with what the actor can reach, and at scale the
evaluation moves to a dedicated service with its own consistency model.

## A fair comparison

| | RBAC | ABAC | ReBAC |
|---|---|---|---|
| Granularity | action (plus a tenant check) | element, through attributes you supply | element, by construction |
| Data to maintain | a role table, roles in the token | attributes of resources | relation tuples |
| Cost of a check | constant, no I/O | one attribute read | several tuple reads |
| Listing accessible elements | all, none or a tenant filter | not available | ids, by reverse expansion |
| Explaining a decision | which role | which rule matched | which path of tuples |
| Typical failure | role explosion | scattered, untested rules | tuples out of sync |

These figures are those of the kit's three in-process authorizers, as stated in
[`@ddd-ts-kit/auth`](../../packages/auth/README.md); a dedicated service changes the costs, not
the shape. See [Authorization engines](../tools/authorization-engines.md). The last row is what
`explain` answers on each of them: the same decision as a check, with one line per question
asked, for debugging.

## Decision table

| Situation | Start with | Reason |
|---|---|---|
| Rights follow job functions, few exceptions per element | RBAC | simplest model that works |
| A handful of per-element rules ("only the one who booked") on top of roles | RBAC plus policies | no tuple store needed |
| Rights depend on properties: clinic, amount, status, time of day, explicit refusals | ABAC | rules read attributes |
| Users share elements with each other, delegation, nested groups or folders | ReBAC | the relationship is the data |
| Multi-tenant product where a tenant is the only boundary | RBAC with the tenant check | a relationship per row would be waste |
| Lists must be narrowed per actor over many elements | ReBAC, or RBAC with a tenant filter | ABAC cannot answer a list |
| Regulated context needing explicit deny rules | ABAC layered over roles | a forbid that wins |

The models combine. Roles for coarse rights and instance policies for the few per-element rules
is the place to start in most projects, and it is what the running domain uses: roles grant
`appointment.book` and `calendar.manage`, one policy guards cancellation. If clients later
delegate their bookings to relatives, or practitioners share calendars with assistants, the
calendars context moves to relationships.

Assembled by hand, that combination is two objects; `authorizationModule` of
`@ddd-ts-kit/auth/di` binds the same `PolicyAccess` in a project:

<!-- checked sample -->
```ts
import { definePermissions, definePolicy, PolicyAccess, RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { FixedClock } from '@ddd-ts-kit/kernel';

const appointmentsPermissions = definePermissions('appointments', {
  'appointment.book': { description: 'Book an appointment for a client' },
  'appointment.cancel': { description: 'Cancel a booked appointment' },
});
const calendarsPermissions = definePermissions('calendars', {
  'calendar.manage': { description: 'Set the working hours of a calendar' },
});

interface BookedAppointment {
  readonly clientId: string;
  readonly practiceId: string;
}

const onlyTheClientOrThePracticeCancels = definePolicy<BookedAppointment>({
  name: 'appointment.only-the-client-or-the-practice-cancels',
  permission: appointmentsPermissions['appointment.cancel'],
  allows: (actor, appointment) =>
    actor.id === appointment.clientId || actor.attributes['practiceId'] === appointment.practiceId,
});

// Roles for the coarse rights: the same answer for every element.
const authorizer = new RoleBasedAuthorizer({
  roles: {
    client: [appointmentsPermissions['appointment.book'], appointmentsPermissions['appointment.cancel']],
    receptionist: ['appointments:*'],
    practitioner: [calendarsPermissions['calendar.manage']],
  },
  inherits: { practitioner: ['receptionist'] },
});

// Access asks the policies of the permission first, then the authorizer.
const access = new PolicyAccess({
  authorizer,
  policies: [onlyTheClientOrThePracticeCancels],
  clock: new FixedClock(new Date('2026-03-01T09:00:00.000Z')),
});

const ada = anActor().named('client-ada').withRole('client').build();
const appointmentOfBob: BookedAppointment = { clientId: 'client-bob', practiceId: 'practice-7' };

// { allowed: false, reason: 'appointment.only-the-client-or-the-practice-cancels' }
export const decision = await access.decide(ada, appointmentsPermissions['appointment.cancel'], appointmentOfBob);
```

The questions to ask, in order, and a worked preset for each model (typed permissions and roles,
a policy on one element, a scoped search) are in the guide
[Choosing access control](../guides/choosing-access-control.md).

## What changes when the model changes

The adapter given to the authorization module, and the data that adapter needs. From roles to
relationships: each requirement names the element it bears on (a relationship is always to
something), each permission is mapped to a schema permission, and the application starts
writing tuples. Permissions, commands, queries, handlers, policies, routes and handler tests do
not change. That is the practical meaning of "behind one port".

Tuples are written through a port named in the words of the application (a `CalendarGrants`
with `ownerAssigned`), never by the domain. Written in the handler, the tuple and the aggregate
commit together when the tuple store is SQL-backed. A handler of a domain event of the
aggregate can call the same port with the same guarantee: domain events are dispatched at the
end of the unit of work of the command, before its commit. Written by a reaction to an integration event, the
write is a second step that must be idempotent and retried, and the aggregate exists for a
short while without its relationship.

## Limits and when not to use it

- **Declaring a permission does not make the model right.** The rules check that every use case
  declares something and that decisions sit in the application layer. They cannot tell whether
  `appointment.book` is granted to the right roles.
- **Text-level checks miss shapes.** An ownership test written by hand
  (`appointment.clientId === actor.id`) in a handler or a route is not detected, as the CLI
  README states. Review still matters.
- **A revoked session lives until its token expires.** The JWT and Keycloak authenticators
  verify signatures against a key set and never call the provider per request. Keep access
  token lifespans short, or add a revocation check behind the `Authenticator` port.
- **In-process ReBAC does not scale forever.** Listing costs one store read per reached
  subject. Past a certain size the check belongs to a dedicated service; the port stays.
- **ABAC offers no listing** in the kit: a predicate is not a query.
- **Tenant filtering in a repository is defence in depth, not authorization.** It stops a bug
  from leaking rows; the permission is still decided in the application layer.
- **Not every project needs this.** A single-user internal tool with no element-level rights
  can declare its use cases with one permission each and one role, and stop there.

## Sources

- Ruoming Pang et al., "Zanzibar: Google's Consistent, Global Authorization System", USENIX
  Annual Technical Conference, 2019.
- David F. Ferraiolo and D. Richard Kuhn, "Role-Based Access Controls", 15th National Computer
  Security Conference, 1992; ANSI INCITS 359-2004 (RBAC standard).
- Vincent C. Hu et al., "Guide to Attribute Based Access Control (ABAC) Definition and
  Considerations", NIST Special Publication 800-162, 2014.
- RFC 7519 (JSON Web Token), RFC 8176 (Authentication Method Reference Values), RFC 8693 (OAuth
  2.0 Token Exchange), OpenID Connect Core 1.0.
- OWASP Top 10 (2021), A01 Broken Access Control: deny by default and enforcing access control
  in trusted server-side code.
- [`@ddd-ts-kit/auth`](../../packages/auth/README.md), the reference for the API and for the
  figures of the comparison table.

## See also

- [Authorization in practice](authorization-in-practice.md): one command followed through the machinery
- [Invariants, permissions and validation](invariants-permissions-validation.md)
- [The actor and the execution scope](actor-and-execution-scope.md)
- [Audit trail](audit-trail.md)
- [Choosing access control](../guides/choosing-access-control.md): the decision guide and the worked presets
- [Multitenancy](multitenancy.md)
- [Identity providers](../tools/identity.md)
- [Authorization engines](../tools/authorization-engines.md)
- [Architecture reference](../ARCHITECTURE.md): rules `authz/declared`, `authz/in-application`,
  `authz/actor-explicit`
