**English** · [Français](scheduling-calendar.fr.md)

# Briefing: scheduling, calendars and waitlist

You build half of the bounded context `scheduling` (the core). Worker name: `scheduling-calendar`.
Another worker, `scheduling-appointment`, builds the other half in the same folder at the same time.

Scope
- You own: the aggregates `Calendar` and `Waitlist` with their value objects, repositories,
  builders and tables; the projection of practitioners; the commands, queries and routes of rows
  18, 19, 20, 28, 29; the port `SchedulingRelationships` and its adapter (row 21: you create them
  with the method for calendars; the other worker adds the method for appointments).
- You do not touch: `Appointment`, the `Scheduler`, the appointment commands, the agenda
  projection, the policies. Shared files of the context (`scheduling.permissions.ts`,
  `create-scheduling-tables.schema.ts`, `scheduling.schema.ts`, `scheduling.routes.ts`,
  `CONTEXT.md`): generators write them; when you edit one by hand, read it again just before and
  change only your lines.
- Generators you may run: value-object, entity, domain-event, error, domain-service,
  command, query, route, port, adapter, event-handler, builder, e2e.

The seam with `scheduling-appointment`, fixed: they generate the value object `Slot` first
(`Slot.between(startsAt, endsAt, heldUntil)`: start, end of the appointment, end of what it holds
with the buffer; `overlaps(other)`). You provide on `Calendar`, as early as you can, even before
the rules behind it are complete: `slotFor(appointmentTypeId: string, startsAt: Date, now: Date): Slot`
(throws the availability errors of rule 22: `OUTSIDE_AVAILABILITY`, `OFF_GRID`,
`BOOKING_TOO_LATE`, `BOOKING_TOO_FAR`, `UNKNOWN_APPOINTMENT_TYPE`), `confirmationDeadlineFor(appointmentTypeId, now): Date | undefined`
(defined when the type needs a confirmation), and the getters `practiceId`, `practitionerId`,
`limit` (future appointments a patient may hold), `timeZone` (a value object with
`dayOf(instant): string`, `YYYY-MM-DD` on the practice's wall clock, written without any library:
`Intl.DateTimeFormat` is enough). Tell nothing else to them: they read your aggregate.
For row 29 you need their `Appointment.request(...)` factory: do that row last.

Slices, in this order: 18, 19, 21 (calendar part), 20, 28, 29. Projections have no generator:
write `application/projections/<name>.projection.ts` after the README of `@ddd-ts-kit/kernel`
("Projections") and `@ddd-ts-kit/knex` ("Read models"), and report what the checker says of it.
Row 28 reads the agenda read model that `scheduling-appointment` builds in row 26: agree on
nothing, read their port when it exists; if it does not exist yet when you get there, do 29 first.

Done when: your rows are built and tested (daylight-saving days of Europe/Paris included for
availability), no marker is left in your files, eslint, vitest and check are clean on your files.
Follow `docs/architecture/briefings/README.md` for the common rules and the report.
