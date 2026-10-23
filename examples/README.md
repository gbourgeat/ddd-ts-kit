**English** · [Français](README.fr.md)

# Examples

[scheduling](scheduling/README.md) is an appointment scheduling platform for practices, built
with the kit from a one-page statement of needs: the strategic steps of the method, one `init`
command, four bounded contexts built slice by slice by parallel workers, relationship-based
authorization combined with roles, one trace per booking across contexts, and a recorded run
against Keycloak, PostgreSQL, Dragonfly, Jaeger and GlitchTip. It comes with an honest
measurement of how the tooling behaved: [scheduling/docs/tooling-report.md](scheduling/docs/tooling-report.md).
From the root of the repository: `npm ci && npm run build && npm run example:verify`.

This page is the way in: what the example is made of, how it was built, one request followed
through its code, and how to run it. The [README of the example](scheduling/README.md) then says,
concept by concept, which file to open.

## What is in it

One deployable application and a worker process, built from the same image. Both compose the
same four bounded contexts; the API process also serves HTTP, relays the outbox and keeps the
projections fed by the event store up to date, the worker runs the scheduled jobs.

![The scheduling example when it runs: the demo script and the specs call the API directly, Varnish is an optional front that caches public reads (one spec reads through it) and that the outbox relay purges by tag; the API process and the worker process hold the same four bounded contexts and use Keycloak, PostgreSQL, Dragonfly, Jaeger, GlitchTip and MinIO](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/examples-scheduling-at-a-glance.svg)

| Context | Kind | What it holds |
|---|---|---|
| `scheduling` | core | calendars and their opening hours across daylight-saving days, appointments from booking to completion with one hold per slot, the waitlist, the attendance record kept as its events |
| `identity` | supporting | people, the practices they work in, their roles there, and what a practitioner delegated to an assistant |
| `notification` | supporting | one notification per event and recipient, one reminder 24 hours before an appointment |
| `analytics` | supporting | the outcome of each appointment; the occupancy of a calendar, measured when it is read |

A context never imports the model of another, only its `published-language/`: the contexts
collaborate by versioned integration events,
written to the outbox in the transaction of the change and published after the commit (the
[context map](scheduling/docs/context-map.md) gives the pattern of each pair, the
[integration notes](scheduling/docs/integration/README.md) the events). The audit trail is a
capability of the platform, not a context.

## How it was built

Every step of the method left a document, so the build can be read, and replayed, in order.

![How the example was built: the statement of needs, the discovery, the bounded contexts, the glossaries and the draft map, then the plan with the init command, the slices, the briefings of five parallel workers, and the demo transcript: a recorded real run after a green gate](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/examples-how-it-was-built.svg)

| Step | Read | What it shows |
|---|---|---|
| 1 | [needs.md](scheduling/docs/architecture/needs.md) | the only input: one page written by the product owner |
| 2 | [discovery.md](scheduling/docs/architecture/discovery.md) | a light event storming in writing: actors, commands, domain events, policies, read models |
| 3 | [contexts.md](scheduling/docs/architecture/contexts.md) | the four contexts, their classification, and the cuts that were rejected |
| 4 | [before-bootstrap/](scheduling/docs/architecture/before-bootstrap/README.md) | the glossary and the draft context map that the bootstrap consumed |
| 5 | [plan.md](scheduling/docs/architecture/plan.md) | the decisions taken with the owner, and the `init` command, verbatim |
| 6 | [slices.md](scheduling/docs/architecture/slices.md) | the backlog: contracts and skeletons first, then one row per use case |
| 7 | [briefings/](scheduling/docs/architecture/briefings/README.md) | what each of the five parallel workers was given |
| 8 | [demo-transcript.md](scheduling/docs/demo-transcript.md) | after a green gate, a real run against the services of the example |

The whole stack is chosen by one command. This is the one recorded in `plan.md`; in this
repository the CLI is `node ../../packages/cli/dist/bin.js`, run from `examples/scheduling`:

```bash
npx ddd-ts-kit init --http express --validation class-validator --di tsyringe --style declared \
  --assembly barrel --orm knex --database postgres --events outbox --broker redis --cache redis \
  --authn keycloak --authz rebac --audit on --errors sentry --logger pino --docs-ui swagger \
  --ci both --json
```

Then one `generate context` per context, with its terms, and every file of a slice from the
generator: the [tooling report](scheduling/docs/tooling-report.md) counts 213 generator runs
that succeeded and 27 that the generator refused.

## Follow one request through the code

The best way into the code is one request. Here a patient, or someone of the practice, cancels
an appointment: `POST /appointments/:id/cancellation`. On its way it meets three questions, each
answered in one place and nowhere else: who is calling (the token, at the edge), may they do
this on this appointment (the application, before anything changes), and is it valid at all
(the domain, whoever is calling).

![The path of a cancellation: the route lets an authenticated caller through, the permission is checked before the handler, the policy in the handler with the loaded appointment, the invariants in the domain, then one unit of work commits; each check answers its own refusal](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/examples-cancel-three-questions.svg)

**The application decides who may.** The permission is data of the context; the command says
which permission it requires and on which element; the rule that needs the loaded appointment
is a named policy. This is the code of the example, shortened (the declarations of the context
use the legacy decorators, as the example does):

<!-- checked sample: legacy-decorators -->
```ts
import { definePermissions, type PolicyContext } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
import { Policy, Requires } from '@ddd-ts-kit/kernel/declarations';

// Declared here so that the sample compiles alone: in the example, it is the aggregate.
declare class Appointment {
  readonly patientId: string;
  readonly slot: { readonly startsAt: Date };
}

// scheduling.permissions.ts
export const schedulingPermissions = definePermissions('scheduling', {
  'appointment.cancel': { description: 'Patient cancels until notice' },
});

// application/commands/cancel-appointment/cancel-appointment.command.ts
@Requires(schedulingPermissions['appointment.cancel'], {
  resource: (command: CancelAppointmentCommand) => ({ type: 'appointment', id: command.appointmentId }),
})
export class CancelAppointmentCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
    readonly reason?: string,
  ) {
    super(actor);
  }
}

// application/authorization/patient-cancels-until-notice.policy.ts
const NOTICE_IN_HOURS = 24;
const HOUR = 60 * 60_000;

@Policy(schedulingPermissions['appointment.cancel'], { name: 'scheduling.patient-cancels-until-notice' })
export class PatientCancelsUntilNoticePolicy {
  appliesTo(subject: unknown): subject is Appointment {
    return subject instanceof Appointment;
  }

  allows(actor: Actor, appointment: Appointment, { now }: PolicyContext): boolean {
    if (!isAuthenticated(actor)) {
      return false;
    }

    // Anybody else who holds the permission acts for the practice, at any time.
    return actor.id !== appointment.patientId || appointment.slot.startsAt.getTime() - now.getTime() >= NOTICE_IN_HOURS * HOUR;
  }
}
```

Nothing here names a role or a relationship. Who holds `scheduling:appointment.cancel` on
`appointment:<id>` is the business of the authorizer of the platform: the `patient` relationship
written at booking, or a relationship to the desk of the calendar (its practitioner, an
assistant it was delegated to, a manager of the practice)
([ADR 0001](scheduling/docs/adr/0001-combine-token-roles-with-relationships-in-one-authorizer.md)
explains how roles and relationships are combined).

**The handler asks, the domain refuses.** The handler loads the appointment, asks the policies
with it, and leaves the rest to the domain: a value object that refuses a cancellation by the
practice without a reason, and an aggregate whose state machine refuses to change an
appointment that has ended.

<!-- checked sample: legacy-decorators -->
```ts
import { Access, definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, DomainRefusal, ValueObject, type Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';

// Declared here so that the sample compiles alone: they are files of the context in the example.
declare class Appointment {
  readonly id: string;
  readonly patientId: string;
  cancel(cancellation: Cancellation, now: Date): void;
}
declare abstract class AppointmentRepository {
  findById(id: string): Promise<Appointment | undefined>;
  save(appointment: Appointment): Promise<void>;
}
declare class CancelAppointmentCommand extends AuthorizedCommand<string> {
  readonly appointmentId: string;
  readonly reason?: string;
}
const schedulingPermissions = definePermissions('scheduling', {
  'appointment.cancel': { description: 'Patient cancels until notice' },
});

// scheduling.codes.ts: the codes of the context, the contract a client reads; the platform maps each to a status.
const SchedulingCodes = {
  UnknownAppointment: 'APPOINTMENT_NOT_FOUND',
  ReasonRequired: 'REASON_REQUIRED',
} as const;

// domain/errors/unknown-appointment.error.ts: one class per refusal, named after what is refused.
export class UnknownAppointment extends DomainRefusal {
  readonly code = SchedulingCodes.UnknownAppointment;

  static forAppointment(appointmentId: string) {
    return UnknownAppointment.refusal(`Appointment ${appointmentId} does not exist.`, { appointmentId });
  }
}

// domain/errors/reason-required.error.ts
export class ReasonRequired extends DomainRefusal {
  readonly code = SchedulingCodes.ReasonRequired;

  static onCancellation() {
    return ReasonRequired.refusal('The practice gives a reason when it cancels an appointment.');
  }
}

// domain/value-objects/cancellation.vo.ts: the invariant holds whoever is calling.
type CancellationProps = {
  readonly by: 'patient' | 'practice';
  readonly reason: string | undefined;
};

export class Cancellation extends ValueObject<CancellationProps> {
  private constructor(props: CancellationProps) {
    super(props);
  }

  /** A patient may cancel without a word; the practice says why. */
  static create(by: 'patient' | 'practice', reason?: string): Cancellation {
    const given = reason?.trim() ?? '';

    if (by === 'practice' && given.length === 0) {
      throw ReasonRequired.onCancellation();
    }

    return new Cancellation({ by, reason: given.length === 0 ? undefined : given });
  }
}

// application/commands/cancel-appointment/cancel-appointment.handler.ts
@CommandHandler(CancelAppointmentCommand)
export class CancelAppointmentHandler implements CommandHandler<CancelAppointmentCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  async execute({ actor, appointmentId, reason }: CancelAppointmentCommand): Promise<string> {
    const target = await this.appointmentRepository.findById(appointmentId);

    if (target === undefined) {
      throw UnknownAppointment.forAppointment(appointmentId);
    }

    // The policies of the permission, with the loaded appointment: 403 when one says no.
    await this.access.authorize(actor, schedulingPermissions['appointment.cancel'], target);

    const cancellation = Cancellation.create(actor.id === target.patientId ? 'patient' : 'practice', reason);

    target.cancel(cancellation, this.clock.now());

    await this.appointmentRepository.save(target);

    return target.id;
  }
}
```

The handler opens no transaction and publishes nothing: the command bus runs it in a unit of
work. The handlers of the domain event `AppointmentCancelled` run in the same transaction (the
freed slot is offered to the waitlist, and a publisher writes the integration event
`scheduling.appointment.cancelled` to the outbox), and all of it commits together, or nothing
does. After the commit, the relay publishes the event: `notification` tells the patient and
`analytics` records the outcome, outside this request.

**A practice it shows: a rule about rights is a policy, not an `if` in the handler.** Instead of
testing the actor in the handler:

```ts
// Found by nobody who reads the permissions, tested only through the handler, and the context now names a role.
if (actor.roles.includes('patient') && appointment.slot.startsAt.getTime() - now.getTime() < 24 * HOUR) {
  throw new ForbiddenError('Too late to cancel');
}
```

write the rule as a policy of the permission, as above: `Access.authorize` runs it, its name is
the reason of the refusal, it has a spec of its own (listed below), and the contexts keep
naming permissions only. The rule
[`authz/in-application`](../docs/ARCHITECTURE.md#3-dependency-rules) says where a right is
decided; [Authentication and authorization](../docs/concepts/authentication-and-authorization.md)
explains why.

The files, under `examples/scheduling/` (`<s>` stands for `src/contexts/scheduling`):

| Part | File |
|---|---|
| route | `<s>/presentation/http/appointments/cancel-appointment/cancel-appointment.controller.ts` |
| command and its permission | `<s>/application/commands/cancel-appointment/cancel-appointment.command.ts` |
| handler | `<s>/application/commands/cancel-appointment/cancel-appointment.handler.ts` |
| policy and its spec | `<s>/application/authorization/patient-cancels-until-notice.policy.ts`, `<s>/test/unit/patient-cancels-until-notice.policy.spec.ts` |
| value object | `<s>/domain/value-objects/cancellation.vo.ts` |
| aggregate and its state machine | `<s>/domain/aggregates/appointment.aggregate.ts`, `<s>/domain/state-machines/appointment.state-machine.ts` |
| reactions in the same transaction | `<s>/application/event-handlers/appointment-cancelled.event-handler.ts`, `<s>/application/integration/publishers/appointment-cancelled.publisher.ts` |
| the status of each refusal | `src/platform/http/error-statuses.ts` |
| the whole path, end to end | `test/e2e/journey-authorization.e2e.spec.ts` |

## Run it

**The gate, without any container.** From the root of the repository:

```bash
npm ci && npm run build && npm run example:verify
```

`example:verify` runs two things:

| Part | What it proves |
|---|---|
| `npm run verify` of the example | types, lint with the kit's preset, format, unit and adapter tests with coverage, end-to-end specs, the architecture rules (`ddd-ts-kit check`), the import graph, dead code, and the drift of the generated documents |
| `npm run example:conformance` | every rule of the catalogue is broken once in a copy of the example and must be reported, on the file that breaks it, by every analyzer that holds it; the untouched copy reports nothing |

**The real run.** With Docker, the example starts its own PostgreSQL, Dragonfly, Varnish,
Keycloak, Jaeger and GlitchTip, then a script plays the scenario of the
[demo transcript](scheduling/docs/demo-transcript.md) with real tokens: the three commands are
in [Run it in three commands](scheduling/README.md#run-it-in-three-commands), and the users
of the demo in [Demo users](scheduling/README.md#demo-users).

## Where to read next

- [The README of the example](scheduling/README.md): what the example shows and where to look,
  the business rules by context, the authorization model with two worked cases, the trace of a
  booking.
- [Context map](scheduling/docs/context-map.md) and [Integration](scheduling/docs/integration/README.md):
  how the four contexts collaborate.
- The decisions: [ADR 0001](scheduling/docs/adr/0001-combine-token-roles-with-relationships-in-one-authorizer.md)
  (roles and relationships in one authorizer),
  [ADR 0002](scheduling/docs/adr/0002-keep-read-models-with-projections-in-application-projections.md)
  (superseded), [ADR 0003](scheduling/docs/adr/0003-one-network-is-one-tenant.md) (one network
  of practices is one tenant),
  [ADR 0004](scheduling/docs/adr/0004-attendance-records-wait-for-a-tenant-in-the-event-store.md)
  (the attendance records wait for a tenant in the event store).
- [Tooling report](scheduling/docs/tooling-report.md): how long each step took, what the
  generator refused, the defects found in the kit and what is not built.
