# Briefing: notification

You build the bounded context `notification` of the scheduling example. Worker name: `notification`.

Scope
- You may write: `src/contexts/notification/**` and `test/e2e/notification-*.e2e.spec.ts`.
- Generators you may run: value-object, entity, domain-event, error, domain-service,
  command, query, route, port, adapter, event-handler, integration-handler, builder, e2e.

Slices, in this order (rows of `docs/architecture/slices.md`, rules below its table): 31, 32, 33,
34. Aggregates `Notification` and `Reminder` exist with their repositories; `SendDueReminders` and
its job exist, unfilled.

Contracts you consume (read-only): `src/contexts/scheduling/published-language/*` (events of
appointments) and `src/contexts/identity/published-language/person-registered.v1.*`.

Specifics: the contacts are a `@Projection` (no generator: write
`application/projections/<name>.projection.ts` after the README of `@ddd-ts-kit/kernel`,
"Projections", and of `@ddd-ts-kit/knex`, "Read models"; report what the checker says of it). The
`Mailer` port has a development adapter that writes the message to the application log (the
`Logger` port, never the body of a mail: recipient id, kind, appointment id) and carries its
resilience policy on the class with the decorators of `@ddd-ts-kit/aspects/decorators` (`@Retry`,
`@Timeout`: this is the one place of the example where the policy is part of the adapter), and a
fake that fails on demand. One spec shows a mailer failing on every attempt: the consumer is
retried, then the event is dead-lettered and reaches the error reporter (README of
`@ddd-ts-kit/events`, "Consume idempotently", and of `@ddd-ts-kit/testing`). Reminders are due
24 h before the start and sent once per appointment and start: the job passes `scheduledAt`.

Done when: every slice is built and tested, no marker is left in your context, eslint, vitest and
check are clean on your folder. Follow `docs/architecture/briefings/README.md` for the common
rules and the report.
