# Briefing: scheduling, appointments

You build half of the bounded context `scheduling` (the core). Worker name:
`scheduling-appointment`. Another worker, `scheduling-calendar`, builds the other half in the same
folder at the same time.

Scope
- You own: the aggregate `Appointment` with its value objects, repository, builder and table; the
  domain service `Scheduler`; the two policies of the patient's notice; the commands, queries and
  routes of rows 22 to 27 and 30; the agenda projection; the gateway to the person directory; the
  implementation of `AppointmentExportContract`; the appointment method of the port
  `SchedulingRelationships` (row 21: `scheduling-calendar` creates the port and its adapter, you
  add yours; if it does not exist yet when you need it, create it with the generator and tell them
  nothing: they will read it).
- You do not touch: `Calendar`, `Waitlist`, their value objects, the practitioners projection.
  Shared files of the context (`scheduling.permissions.ts`, `create-scheduling-tables.schema.ts`,
  `scheduling.schema.ts`, `scheduling.routes.ts`, `CONTEXT.md`): generators write them; when you
  edit one by hand, read it again just before and change only your lines.
- Generators you may run: value-object, entity, domain-event, error, domain-service,
  command, query, route, port, adapter, event-handler, builder, e2e.

The seam with `scheduling-calendar`, fixed: generate the value object `Slot` FIRST
(`Slot.between(startsAt, endsAt, heldUntil)`: start, end of the appointment, end of what it holds
with the buffer; `overlaps(other)` compares what is held). They provide on `Calendar`:
`slotFor(appointmentTypeId, startsAt, now): Slot` (throws the availability errors of rule 22),
`confirmationDeadlineFor(appointmentTypeId, now): Date | undefined`, and the getters `practiceId`,
`practitionerId`, `limit`, `timeZone.dayOf(instant)`. Build the life of an appointment first
(it needs only `Slot`), then booking and rescheduling once `Calendar.slotFor` exists. They need
from you, for the waitlist: a factory that gives a requested appointment with a deadline.

Slices, in this order: the aggregate with its whole life (rows 22, 24, 25 at domain level), 22,
23, 21 (appointment part), 24, 25, 26, 27, 30. Row 23 is the point of the example: an exclusion
constraint of PostgreSQL over the calendar and the held range of active appointments (the
`btree_gist` extension; the platform worker loads it into the in-process PostgreSQL of the tests),
the adapter translating that violation into the domain error `SLOT_TAKEN`, the route answering 409,
and an integration spec that sends two bookings of one slot at once and sees exactly one win. With
`DATABASE_URL` set the specs run on a real server, where the two transactions are truly concurrent;
in process they are serialised by the single session: write the spec so that it is true in both.
Read `/home/gbourgeat/ddd-ts-kit/packages/redis/README.md` on why the lock is not the guard, and
say it in one comment where the constraint is declared. Projections have no generator: write
`application/projections/<name>.projection.ts` after the README of `@ddd-ts-kit/kernel`
("Projections", "Criteria", "Hydration") and `@ddd-ts-kit/knex` ("Read models", "Criteria"), and
report what the checker says of it. The lists take the kit's criteria (`filter[...]`, `sort`) and
the access scope, as those READMEs show; `generate query --search` writes a simpler shape: adapt it
and report what you had to change.

Done when: your rows are built and tested, no marker is left in your files, eslint, vitest and
check are clean on your files. Follow `docs/architecture/briefings/README.md` for the common
rules and the report.
