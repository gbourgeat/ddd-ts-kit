# ADR-0004: The attendance records wait for a tenant in the event store

- Status: accepted
- Date: 2026-10-13

## Context

ADR-0003 puts the network of every row in a `tenant_id` column and confines every statement of a
repository to the network of the work. The attendance record of a patient arrived afterwards, as
the first event-sourced aggregate of the application: its events, its snapshots, the checkpoints
of the subscriptions that feed projections and the keys of its personal data live in the tables
of the event store of the kit (`stored_events`, `stored_events_head`, `stream_snapshots`,
`subscription_checkpoints`, `subject_keys`), and its history in the read model
`attendance_history`, written by a projection fed by that store.

The event store of the kit records no tenant: an event appended carries its stream, its version
and its aggregate, not the network of the work, and a subscription replays the events of every
stream in no network. A projection fed by it cannot know which network a row of
`attendance_history` belongs to.

## Decision

Until the event store keeps the tenant of each event, the attendance records stay outside the
networks:

- the five tables of the event store and `attendance_history` have no `tenant_id` column, and
  the migration of ADR-0003 does not add one;
- `KnexAttendanceHistory` reads its table without the tenant option, under a suppression of
  `tenancy/scoped-statement` that names this record.

What still confines them: a record is the one of a practice and a patient
(`AttendanceRecord.idOf(practiceId, patientId)`), a practice belongs to one network, and both use
cases ask the membership of that practice before anything is read or noted (ADR-0001). A caller
of another network is refused by the authorization model, not by the storage.

## Consequences

- A statement written by hand against these tables would reach every network: the review of a
  change to them checks the record id it reads.
- `keep-the-network-of-every-row.spec.ts` names the six tables as the exceptions.

## Condition for removing it

The event store of the kit stamps the tenant of the work on each event (its metadata or a
column), replays a subscription in the tenant of each event, and its tables take
`tenantColumn`: then the six tables get the network, the read model takes `tenant`, and this
record is superseded.
