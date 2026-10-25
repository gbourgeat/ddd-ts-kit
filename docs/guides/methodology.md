**English** · [Français](methodology.fr.md)

# Methodology: from a statement of needs to running code

**Summary.** This guide walks the path the plugin drives, step by step: discover the domain in
writing, find and classify the bounded contexts, write the glossaries, draw the context map,
choose the stack by criteria, bootstrap, plan vertical slices, build them (in parallel when
there are several workers), verify, and document. Each step names its input, the file it leaves
in the repository, the tool that produces it and the question that tells you the step is done.
Strategic decisions belong to people; the tools make them explicit and keep them true.

## The path at a glance

![The nine steps in order: from the statement of needs, discover, contexts, glossaries and context map model the domain; stack and bootstrap builds the platform once; then plan slices, build, verify and document run for each slice, the next slice looping back to plan slices, and a wrong boundary sending the work back to contexts](../assets/diagrams/methodology-path.svg)

| Step | Input | Output artefact | Produced by | Done when |
|---|---|---|---|---|
| 1. Discover | statement of needs, domain experts | `docs/architecture/discovery.md` | skill `discover-domain` (a written event storming) | every need appears as a command and a domain event, and every disagreement is a listed hot spot |
| 2. Contexts | the discovery timeline | `docs/architecture/contexts.md` | skill `bounded-contexts` | each context is one language and one owner, the core is named, every boundary is argued |
| 3. Glossaries | the nouns, verbs and facts of each context | `docs/architecture/glossary.md` before the bootstrap, then `## Ubiquitous language` of each `CONTEXT.md` | skill `glossary`; `generate ... --term` | a domain expert would sign each definition |
| 4. Context map | policies and read models that cross a boundary | `docs/architecture/context-map.md` (draft), then `contexts.<name>.upstreams` in the config and `docs/context-map.md` | skill `context-map`; `ddd-ts-kit docs` | every arrow has a pattern, a contract and a reason, and there is no cycle |
| 5. Stack and bootstrap | constraints of the team and of operations; the three drafts | `stack` in `ddd-ts-kit.config.json`, the project skeleton, the pipeline, one ADR per debated choice | skill `bootstrap` (started by a person), `ddd-ts-kit init`, `generate adr` | `npm run verify` is green on the empty project, and it is committed |
| 6. Plan | the commands and queries of step 1 | `docs/architecture/slices.md` | skill `plan-slices` | each slice can be built and merged on its own, in this order |
| 7. Build | one slice | domain, handler, adapter, route, their specs; one commit per slice | skill `use-case` (which uses `scaffold`), or `parallel-work` for several workers | no `TODO(domain)` and no `it.todo` is left in the slice |
| 8. Verify | the change | a green gate | `npm run verify`, skill `quality-gate` | every check passes without a new suppression |
| 9. Document | the diff of the generated documents | context map, the `## Reference` of each `CONTEXT.md`, OpenAPI, AsyncAPI, catalog, ADRs | `ddd-ts-kit docs`, `npm run docs:generate`, skill `document` | `docs --check` reports nothing stale |

**This is the supported path: follow it in order.** The README of the kit and the README that
`init` writes repeat the steps; [Which command, when](commands.md) gives the command or skill of
each moment. A step skipped is paid for later, and the price is known:

| Skipped | What goes wrong |
|---|---|
| 1. Discover | the model copies the screens or the tables; the policies between contexts are found in production |
| 2. Contexts | the boundaries follow the database schema, every rename crosses contexts, and one change needs several teams |
| 3. Glossaries | written after the code, the glossary describes the code instead of the business; the generators refuse the names until it exists |
| 4. Context map | the first integration is a direct import, which the checker refuses (`context/published-language-only`, `context/declared-relationship`), and it is rewritten as an event late |
| 5. Bootstrap by hand | the files the generators register into are missing; the gate is not green before the first line, so nobody knows which change broke it |
| 6. Plan | the work comes as layers (all entities, then all handlers): nothing is demonstrable, and parallel workers collide |
| 7 to 9. Slice by slice, gate, document | a large unverified change, generated documents edited by hand, a red pipeline nobody can bisect |

Skipping is sometimes right (a generic context needs no event storming); then it is a decision
of the project owner, recorded as `skipped` with its reason in `docs/architecture/plan.md`.

Steps 1 to 7 are the ones the `start` skill of the plugin conducts (`/ddd-ts-kit:start`, run
by a person). It keeps the state of the project in `docs/architecture/plan.md` (steps done,
decisions, open questions, and a `Next:` line), so a later session resumes from one file, and
it closes each step on a yes of the project owner, never on its own judgement. Steps 8 and 9
happen inside every slice of step 7; they are listed apart because they are also what CI
replays.

## 1. Discover the domain: a light event storming in writing

Event storming (Brandolini) is usually done on a wall with sticky notes. The same questions
work in a text file, which is what a small team or a coding agent can actually keep. The skill
`discover-domain` drafts it from the needs, asks only what the needs do not say, and writes
`docs/architecture/discovery.md` as a timeline. Its elements, in this order:

1. **Events**: facts in the past tense. "An appointment was booked", "working hours were
   changed", "a reminder was sent".
2. **Commands**: what somebody asked for that caused each event. "Book an appointment".
3. **Actors**: who gives each command. A client, a practitioner, a scheduled job.
4. **Policies**: "whenever X happened, then Y". "Whenever an appointment is booked, a
   confirmation is sent." A policy is the seed of an integration event handler.
5. **Read models**: what somebody needs to see in order to decide. "The open slots of a
   practitioner for a week."

For the scheduling application, a fragment:

| Actor | Command | Event | Policy that follows | Read model needed |
|---|---|---|---|---|
| client | book an appointment | appointment booked | send a confirmation; schedule a reminder | open slots of a practitioner |
| client or practitioner | cancel an appointment | appointment cancelled | free the slot; tell the other party | my appointments |
| practitioner | set working hours | working hours changed | recompute open slots | my calendar |
| time (every morning) | send reminders | reminder sent | none | appointments of tomorrow |

Laid out as an event storming reads it, from left to right, each line is one story: what the
actor sees, what they ask, what happened, and what follows from it.

![Three lines of the scheduling discovery read from left to right, read model, actor, command, domain event, policy: a client books an appointment from the open slots and a confirmation and a reminder follow; a client or a practitioner cancels and the slot is freed; every morning time sends the reminders of tomorrow. Below, a hot spot on cancelling for free and the list of external systems](../assets/diagrams/methodology-event-storming.svg)

Each kind of note becomes a kind of code later, which is why the discovery is worth writing
down: a command becomes a command and its handler (step 7), a domain event an event the
aggregate records, a policy that crosses a boundary an integration event and its handler
downstream (step 4), a read model a query or a projection, an actor a permission.

The skill also lists the external systems (here: the identity provider, the email and SMS
providers) with what happens when each is down, and the rules heard on the way ("a
practitioner is never booked twice").

Then mark the hot spots: every place where two people use one word differently, or where
nobody knows the rule ("until when may a client cancel for free?"). A hot spot is a question
for a domain expert, never a guess.

**Done when** every event has a command and an actor, every cross-cutting consequence is a
policy, and the open questions are listed.

## 2. Find and classify the contexts

Group events and commands that speak one language and change together. The skill
`bounded-contexts` proposes candidates and tests each one with you: language (does a word
change meaning?), autonomy (who decides the rules?), consistency (what must be true in the
same transaction?), size, and whether one person or one agent can hold it in mind. It writes
`docs/architecture/contexts.md` with the reason for every boundary and the cuts that were
rejected. See [Bounded context](../concepts/bounded-context.md) and the
[worked example](../concepts/context-map-worked-example.md).

Classify each one (`core`, `supporting`, `generic`): the classification decides where the
design effort goes, see [Domain and subdomains](../concepts/domain-and-subdomains.md).

**Done when** no use case of step 1 needs to write in two contexts in one transaction. If one
does, either the two are one context, or the requirement becomes a process: one decides, the
other reacts.

## 3. Write the glossaries

Before the bootstrap the glossary is a draft, `docs/architecture/glossary.md`, one section per
context; after it, the only copy is the `## Ubiquitous language` table of each `CONTEXT.md`.
The glossary comes before the code, and the tools hold that order: the scaffolder refuses a
name whose words are not terms of the context, and `language/glossary-term` reports it
afterwards ([rule table](../ARCHITECTURE.md#3-dependency-rules)).

```bash
npx ddd-ts-kit generate context appointments --classification core \
  --purpose "Clients book, reschedule and cancel appointments with practitioners. It guards that a practitioner is never booked twice for the same time." \
  --term "Appointment=A client's reserved time with a practitioner" \
  --term "Book=To reserve a slot for a client" \
  --term "Slot=A start and an end instant at which a practitioner can receive"
```

From then on, a name made of words the glossary lacks is refused before any file is written.
In a context whose glossary holds `Order` and `Place`:

```text
$ npx ddd-ts-kit generate command ordering CancelOrder --permission order.cancel --aggregate Order
error: "CancelOrder" uses "cancel", which the glossary of src/contexts/ordering/CONTEXT.md does not define.
  fix: Either use an existing term (Order, Place), or add the term in the same command: --term "Cancel=<what it means for the business>". The glossary is written before the code (rule language/glossary-term).
```

The answer is a definition, not a workaround: add
`--term "Cancel=To withdraw an order before it is shipped"` to the same command, and the term
lands in `CONTEXT.md` with the files.

Then fill `CONTEXT.md` by hand: for each term, its meaning here and what it must not be
confused with in a neighbouring context. See
[Ubiquitous language](../concepts/ubiquitous-language.md).

**Done when** the first aggregate and the first use case can be named without `--allow-name`.

## 4. Draw the context map and choose relationship patterns

A relationship is declared, never implied by an import. The downstream names its upstream and
the pattern; `published-language` is the default. Before the bootstrap the skill `context-map`
writes a draft table (downstream, upstream, pattern, what crosses, why); afterwards the
relationships live in the config.

```bash
npx ddd-ts-kit generate context notifications --classification supporting \
  --upstream appointments:published-language
npx ddd-ts-kit docs
```

`docs/context-map.md` then holds a generated diagram and table between markers, and four
written sections outside them (reading guide, why these boundaries, relationship notes, known
tensions). Write those: the diagram shows what, only people can say why. The patterns and
their costs are in [Context map](../concepts/context-map.md).

Declared this way, the downstream depends on the contract of its upstream, never on its model.
In the [example application](../../examples/scheduling/README.md), `notification` reacts to a
booking of `scheduling`:

```ts
// Instead of: notification reaches into the model of scheduling (refused: context/published-language-only)
import { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';

// Write: notification imports what scheduling publishes, and reacts to it
import { appointmentBookedV1, type AppointmentBookedV1 } from '@/contexts/scheduling/published-language';

@IntegrationEventHandler(appointmentBookedV1, { consumer: 'notification.scheduling-appointment-booked' })
export class SchedulingAppointmentBookedIntegrationHandler {
  async handle(event: AppointmentBookedV1): Promise<void> {
    const { patientId, appointmentId, startsAt, status } = event.payload;
    // ... send a confirmation (or a request, for a requested booking) through the command bus of notification
  }
}
```

The handler is an excerpt of
`examples/scheduling/src/contexts/notification/application/integration/handlers/scheduling-appointment-booked.integration-handler.ts`.
The event is versioned (`V1`): scheduling can change its aggregate freely, as long as it keeps
publishing that payload.

**Done when** `npx ddd-ts-kit check --rule context/no-cycle --rule context/declared-relationship`
is clean and every pattern other than the default has a sentence of justification.

## 5. Choose the stack by criteria, then bootstrap

Choosing among supported options is the project owner's call, and it is not a deviation. Decide
each line with a criterion you can state, and write an ADR for a choice that was debated:

| Decision | Page |
|---|---|
| HTTP framework | [HTTP frameworks](../tools/http-frameworks.md) |
| Validation library | [Validation](../tools/validation.md) |
| Dependency injection | [Dependency injection](../tools/dependency-injection.md) |
| ORM and database | [Persistence](../tools/persistence.md) |
| Broker, or none | [Message brokers](../tools/message-brokers.md) |
| Cache and locks | [Cache and coordination](../tools/cache-and-coordination.md) |
| Identity provider | [Identity](../tools/identity.md) |
| Authorization model | [Authorization engines](../tools/authorization-engines.md) |
| Tracing, logs, errors | [Observability](../tools/observability.md) |
| CI platform | [Static analysis and pipeline](../tools/static-analysis-and-pipeline.md) |
| Test runner | [Test runners](../tools/test-runners.md) |

Start with the least that works: no broker (the in-memory bus behind the outbox), roles for
authorization, one deployable. Each of these can be changed later by replacing an adapter;
that is what the ports are for.

Each value of `stack` in the config should be defensible in one sentence.

`/ddd-ts-kit:bootstrap` is run by a person, not started by the agent on its own. It previews
with `--dry-run`, runs `ddd-ts-kit init` with the chosen flags, installs, and proves the
result with `npm run verify` (`pnpm install` and `pnpm run verify` on pnpm, the default: `init`
prints the two commands in the words of the package manager chosen, and the bare project passes
the whole gate before its first context). An existing project is adopted: existing files are skipped
unless `--force` is given, and the notes of its first `init --dry-run` name each dependency of
its `package.json` the chosen flags contradict, with the flag that keeps it.

A `generic` context the kit has a preset for is written whole at this step rather than built
slice by slice: `--preset identity` writes accounts from the identity provider, organisations,
members, invitations and delegations, green as written
([Bootstrap with well-designed contexts](bootstrap-with-well-designed-contexts.md)).

This step is the one that must be finished, merged and shared before any parallel work
starts, because it creates the files everybody else's work is registered in
([Parallel work](parallel-work.md)).

**Done when** `npm run verify` passes on the default branch and the pipeline's final gate is a
required check.

## 6. Plan vertical slices per context

A slice is one command or one query, end to end, inside one context: domain behaviour,
handler, adapter if a new port is needed, route, tests. Order them per context so that each
one is demonstrable:

1. the slice that creates the main aggregate (`BookAppointment`);
2. the slices that change it (`RescheduleAppointment`, `CancelAppointment`);
3. the reads (`GetAppointment`, `SearchAppointments`);
4. what crosses a boundary: the integration event, then its handler in the downstream.

`npx ddd-ts-kit list` shows what exists per context (`describe <context>` gives one context
in full: use cases, routes, events, ports, policies), so the plan is a difference between that
output and the lists of step 1. The skill `plan-slices` writes it to
`docs/architecture/slices.md`, and `npx ddd-ts-kit status` reads it back: the next step of
`docs/architecture/plan.md`, the slices by status and by owner, and what is left to write in
each context.

![Above, the work planned by layers, every aggregate, then every handler, then every adapter, then every route, nothing running before the last one; below, the same work as vertical slices of the appointments context, each crossing the layers and merged on its own, then a published event in appointments and its handler in notifications as two slices](../assets/diagrams/methodology-vertical-slices.svg)

**Done when** no slice touches two contexts, and every cross-context need is two slices: a
published event upstream, a handler downstream.

## 7. Build, test first, inside out

The skill `use-case` drives one slice: restate it in the domain's words, name the permission
(a use case is protected or explicitly public, never undecided), scaffold each file with
`generate ... --json`, open only the `TODO(domain)` places the output lists, write the
aggregate spec, then the handler spec with fakes, then the adapter and the route.

"Inside out" starts with the rule itself. For `CancelAppointment`, the spec of the aggregate
is written first, in the words of the glossary, with `given` of `@ddd-ts-kit/testing`; the
intention method of the aggregate is then written to make it pass. Both are shown in one
module here; in a project they are `domain/aggregates/appointment.aggregate.ts` and
`test/unit/appointment.aggregate.spec.ts`, generated with their `TODO(domain)` places:

<!-- checked sample -->
```ts
import { AggregateRoot, DomainRefusal, NamedDomainEvent } from '@ddd-ts-kit/kernel';
import { given } from '@ddd-ts-kit/testing';
import { describe, expect, it } from 'vitest';

// The refusal, named in the words of the business.
export const AppointmentsCodes = {
  AppointmentAlreadyCancelled: 'APPOINTMENT_ALREADY_CANCELLED',
} as const;

export class AppointmentAlreadyCancelled extends DomainRefusal {
  readonly code = AppointmentsCodes.AppointmentAlreadyCancelled;

  static forAppointment(appointmentId: string) {
    return AppointmentAlreadyCancelled.refusal(`Appointment ${appointmentId} is already cancelled.`, { appointmentId });
  }
}

// The fact, in the past tense.
export class AppointmentCancelled extends NamedDomainEvent('appointments.appointment.cancelled') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

type AppointmentStatus = 'booked' | 'cancelled';

export class Appointment extends AggregateRoot {
  private constructor(
    id: string,
    private status: AppointmentStatus,
  ) {
    super(id);
  }

  static book(id: string): Appointment {
    return new Appointment(id, 'booked');
  }

  get isCancelled(): boolean {
    return this.status === 'cancelled';
  }

  // One intention: it guards its rule, changes the state and records what happened.
  cancel(now: Date): void {
    if (this.status === 'cancelled') {
      throw AppointmentAlreadyCancelled.forAppointment(this.id);
    }

    this.status = 'cancelled';
    this.record(new AppointmentCancelled(this.id, now));
  }
}

// The spec, written first: one business rule per test.
const now = new Date('2026-03-01T08:00:00.000Z');

describe('Appointment', () => {
  it('is cancelled, and records the fact', () => {
    given(Appointment.book('appointment-1'))
      .when((appointment) => appointment.cancel(now))
      .thenEvents([{ name: 'appointments.appointment.cancelled', aggregateId: 'appointment-1', occurredAt: now }])
      .thenState((appointment) => expect(appointment.isCancelled).toBe(true));
  });

  it('refuses to be cancelled twice', () => {
    const cancelled = Appointment.book('appointment-1');
    cancelled.cancel(now);

    given(cancelled)
      .when((appointment) => appointment.cancel(now))
      .thenError('APPOINTMENT_ALREADY_CANCELLED', { appointmentId: 'appointment-1' });
  });
});
```

`given` discards the events recorded while arranging, so `thenEvents` sees only what the
intention under test recorded. The handler spec comes next, through the test application with
the fakes the generator wrote, then the adapter and the route: see
[Testing strategy](../concepts/testing-strategy.md).

With several workers, one context per worker: see [Parallel work](parallel-work.md).

A story enters the build from where its idea was written. Plain words, a file or a ticket are
enough for `/ddd-ts-kit:story`; an idea that is not a story yet, held by someone who will never
open a terminal, is written first as an intent, `docs/architecture/intents/<slug>.md`, in the
words of its author (`/ddd-ts-kit:intent`, or the template by hand): the problem, the outcome,
who and what it touches, the constraints, the open questions, the acceptance as the author
would observe it. The product owner accepts it by setting `Status: accepted` in a pull request,
and the story is opened from it (`npx ddd-ts-kit story-scope <code> --from <intent>`): its
statement, its pre-answered questions and the first draft of its criteria come from the intent,
and `## Origin` of the story keeps the link. See [Story workflow](story-workflow.md).

**Done when** the slice has no `TODO(domain)` and no `it.todo` left
(`npx ddd-ts-kit todo <context>` lists them as `file:line`); a marker that cannot be resolved
is a question for the owner, listed as such.

## 8. Verify

`npm run verify` chains the checks; `npx ddd-ts-kit check --changed-since origin/main` is the
fast loop while working. A violation carries a rule id and a fix sentence, and
`npx ddd-ts-kit explain <rule-id>` gives the reason. Fix the cause. A suppression, a lowered
severity or a skipped test is a deviation: it needs the owner's agreement and a decision
record (`governance/recorded-deviation`).

**Done when** the gate is green with no new suppression.

## 9. Document

Generated documents are regenerated, never edited: `npx ddd-ts-kit docs` for the context map,
the `## Reference` of each `CONTEXT.md` and the barrels; `npm run docs:generate` for the OpenAPI document, the
AsyncAPI document and the event catalog. Read their diff: it is the summary of what the change
did to the architecture. Then update the written parts the diff makes stale, and commit
documentation with the code that changed it ([Commit discipline](commit-discipline.md)).

**Done when** `npx ddd-ts-kit docs --check` and `npm run docs:check` report nothing.

## Limits and when not to use it

- **The method front-loads thinking.** For a throwaway prototype or a three-table CRUD tool,
  steps 1 to 4 cost more than they return. A `generic` or simple `supporting` context deserves
  a thin model; do not run a full discovery for it.
- **A written event storming is a substitute, not an equivalent.** The workshop format exists
  to put experts and developers in one room. Use the text form to prepare or record a
  conversation, not to avoid it.
- **The first boundaries are hypotheses.** Expect to move one within the first weeks; the
  "known tensions" section of the context map is where the suspicion is written before the
  move. Moving a boundary late is expensive: data moves with it.
- **The tools check form, not truth.** The checker verifies that a term exists in the glossary,
  not that its meaning is right; that a relationship is declared, not that the pattern fits.
- **The glossary check matches words crudely** (see the limits in the
  [CLI README](../../packages/cli/README.md)): it knows no synonyms.

## Sources

- Alberto Brandolini, *Introducing EventStorming*, Leanpub (events, commands, actors, policies,
  read models, hot spots).
- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, parts I and IV (ubiquitous language,
  strategic design).
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapters 1 to 4 and 12
  (subdomains, bounded contexts, event storming).
- Michael Nygard, "Documenting Architecture Decisions", 2011.
- This repository: [`plugin/skills`](../../plugin/skills), the
  [CLI README](../../packages/cli/README.md).

## See also

- [Story workflow](story-workflow.md): step 7 one user story at a time, one session per story
- [Context map: a worked example](../concepts/context-map-worked-example.md)
- [Which command, when](commands.md)
- [Team workflow](team-workflow.md)
- [Parallel work](parallel-work.md)
- [Commit discipline](commit-discipline.md)
- [Architecture reference](../ARCHITECTURE.md) and [configuration](../CONFIG.md)
