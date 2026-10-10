# Briefing: analytics

> Kept as it was given. After delivery (2026-10-10) the owner replaced part of what it asks for:
> the occupancy read model and `VerifyOccupancy` are gone, the occupancy is measured from the
> outcomes when it is read. See `../slices.md`, notes of 35 and 37.

You build the bounded context `analytics` of the scheduling example. Worker name: `analytics`.

Scope
- You may write: `src/contexts/analytics/**` and `test/e2e/analytics-*.e2e.spec.ts`.
- Generators you may run: value-object, entity, domain-event, domain-error, domain-service,
  command, query, route, port, adapter, event-handler, integration-handler, builder, e2e.

Slices, in this order (rows of `docs/architecture/slices.md`, rules below its table): 35, 36, 37.
`VerifyOccupancy` and its job exist, unfilled; the gateway `AppointmentExportGateway` exists,
unfilled, over the read contract `src/contexts/scheduling/published-language/appointment-export.contract.ts`.

Contracts you consume (read-only): `src/contexts/scheduling/published-language/*`.

Specifics: this context is a read side, with no aggregate. Two read models, both
`ReadModelStore`s written by `@Projection` classes (no generator: write
`application/projections/<name>.projection.ts` after the README of `@ddd-ts-kit/kernel`,
"Projections", "Criteria", and of `@ddd-ts-kit/knex`, "Read models", "Criteria"; report what the
checker says of it): the outcome of each appointment (one row per appointment, each event sets the
state: held, completed, no-show, cancelled by the patient, cancelled by the practice, expired), and
the occupancy of a calendar on a day (held minutes, appointments held, completed, no-shows,
cancellations by party), recomputed from the outcomes each time one changes. `ListOccupancy` is a
list with the kit's criteria (`filter[calendarId]`, `filter[day]` with a range, `sort`), paginated
and narrowed by the access scope (`generate query --list` writes a simpler shape: adapt it and
report what you had to change). `VerifyOccupancy` recomputes the days of the last week from the
outcomes and repairs differences, idempotently, from the job's `scheduledAt`. One integration spec
runs `ProjectionRebuild` on the outcomes read model from a fake of the export gateway holding rows
the projection got wrong, and sees them repaired.

Done when: every slice is built and tested, no marker is left in your context, eslint, vitest and
check are clean on your folder. Follow `docs/architecture/briefings/README.md` for the common
rules and the report.
