# Analytics

## Purpose

Measures the occupancy, the cancellations and the no-shows of each calendar, per day. It only reads what the other contexts announce.

## Classification

supporting

Needed by practice managers, built entirely from what scheduling announces: one read model, no decision.

## Ubiquitous language

| Term | Meaning | Not to be confused with |
|---|---|---|
| Occupancy | The time held by appointments on a calendar over a day, with their count; measured from the outcomes when it is read, never stored |  |
| Outcome | How an appointment stands for measurement: held, completed, no-show, cancelled by the patient, cancelled by the practice, expired | scheduling: the appointment itself |
| Cancellation | A count of appointments cancelled on a day, by party | scheduling: who and why |
| No show | A count of appointments whose patient did not come |  |
| Calendar | A line whose occupancy is measured, in a practice | scheduling: the agenda |
| Day | A calendar date in the time zone of the practice |  |
| Search | To read the occupancy of the calendars of a practice, day by day |  |
| Read | To see the occupancy of the calendars one measures |  |
| Measure | To compute the occupancy of a calendar over a day from the outcomes of its appointments |  |
| Figures | The minutes held and the counts of one line of occupancy, as a measure gives them | Occupancy: the line itself, with its calendar and its day |
| Period | The time an outcome covers, from the start to the end of its appointment: the minutes a measure adds up | Day, which a period falls on |
| Inverted | Said of a period whose end comes before its start: the time it covers would be negative, so no outcome has one |  |
| Inconsistent | Said of figures that cannot be true together: a count below zero, or fewer appointments held than completed and missed | A low occupancy, which is true |

## How occupancy is measured

One row per fact, computed at read time. The context stores one thing: the **outcome** of each
appointment (`analytics.outcomes`, one row per appointment, set whole by every event of
`scheduling`, so a replay or a late delivery ends on the same row). Nothing is counted when an
event arrives and no figure is stored: there is no counter to drift, so nothing to verify or
repair at night.

A line of occupancy is the outcomes of one calendar on one day, measured:

| Figure | Counts |
|---|---|
| `heldMinutes` | the minutes of the appointments that hold their time (held, completed, no-show), each to the nearest minute |
| `appointmentsHeld` | the appointments that hold their time |
| `completed`, `noShows` | the appointments in that state |
| `cancelledByPatient`, `cancelledByPractice` | the cancellations, by party |

A cancelled or an expired appointment frees its time. A rescheduled appointment has one outcome,
on its new day: the day it left loses it at once. A calendar and day without any appointment has
no line; a day whose appointments were all cancelled has one, with nothing held.

**Where it is defined.** `domain/services/occupancy-measure.service.ts` is the definition: which
outcomes hold their time, and the figures of a set of outcomes. It reads each outcome as a
`MeasuredOutcome` (`domain/value-objects/measured-outcome.vo.ts`: its state and the minutes it
covers, to the nearest minute) and answers `OccupancyFigures`
(`domain/value-objects/occupancy-figures.vo.ts`), two value objects compared by value; the read
model line `Occupancy` carries the same figures as plain data. Each checks its rules once, in its
factory: an outcome never ends before it starts (`OutcomePeriodInverted.forPeriod`), and
figures are whole numbers, none below zero, with at least as many appointments held as completed
and missed ones (`FiguresInconsistent.forRule`). Scheduling never announces such an
outcome, so neither refusal reaches a client: they say what a measure is.

**Where it is computed.** In the database, when `SearchOccupancy` is read:
`infrastructure/persistence/knex-occupancy-reader.repository.ts`, the adapter of the port
`OccupancyReader`, runs one statement that keeps the outcomes the filters and the scope of the
actor allow (the practice, the calendars, the days), groups them by calendar and day, measures
each group, then orders and pages the lines. The states that hold their time are bound from the
domain service. The fake of the port measures the same outcomes with the domain service, and
`test/integration/occupancy-reader.contract.spec.ts` holds the statement and the service to the
same figures on the same outcomes.

**What a read costs.** The outcomes of the practice over the days asked for, through the index
`(practice_id, day, calendar_id)`; a read without a range of days goes through every outcome of
the practice. If that stops being acceptable, the answer is a bound on the range or a stored
summary of closed days, decided then, not a counter kept by events.

## Aggregates

<!-- ddd-ts-kit:aggregates -->
<!-- /ddd-ts-kit:aggregates -->

## Published events

<!-- ddd-ts-kit:events -->
<!-- /ddd-ts-kit:events -->

## Permissions

<!-- ddd-ts-kit:permissions -->
- `analytics:occupancy.read`
<!-- /ddd-ts-kit:permissions -->

## Scheduled jobs

<!-- ddd-ts-kit:jobs -->
No scheduled job.
<!-- /ddd-ts-kit:jobs -->

## Relationships

<!-- ddd-ts-kit:relationships -->
- Downstream of `scheduling` (conformist).
<!-- /ddd-ts-kit:relationships -->

## Reference

<!-- ddd-ts-kit:reference -->
Generated from the code by `ddd-ts-kit docs`; the same facts as data: `ddd-ts-kit describe analytics --json`. The fields of each schema are in the generated contracts: [OpenAPI](../../../openapi/openapi.yaml), [event catalog](../../../docs/integration/event-catalog.md).

**Dependencies**: upstreams: `scheduling` (conformist); downstreams: none.

### Use cases

| Use case | Kind | Permission |
|---|---|---|
| `SearchOccupancy` | query | `occupancy.read` |

### Routes

| Method | Path | Operation | Group | Guards | Use case | Permission | Request | Responses | Errors |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/practices/:practiceId/occupancy` | `searchOccupancy` | `PracticesRoutes` | `Authenticated` | `SearchOccupancy` | `occupancy.read` | params: `SearchOccupancyParams`, query | 200: `page of SearchOccupancyLine` | `UNAUTHORIZED`, `FORBIDDEN` |

### Projections

| Projection | Class | Applies |
|---|---|---|
| `analytics.outcomes` | `OutcomesProjection` | `appointmentBookedV1`, `appointmentConfirmedV1`, `appointmentRescheduledV1`, `appointmentCancelledV1`, `appointmentExpiredV1`, `appointmentCompletedV1`, `appointmentMarkedNoShowV1` |

### Ports

| Port | Kind | Adapters |
|---|---|---|
| `AppointmentExportGateway` | gateway | `InProcessAppointmentExportGateway` |
| `OccupancyReader` | repository | `KnexOccupancyReader` |
| `OutcomeRegister` | repository | `KnexOutcomeRegister` |

### Errors

| Refusal | Factory | Code | Exposed facts |
|---|---|---|---|
| `FiguresInconsistent` | `forRule` | `FIGURES_INCONSISTENT` | none |
| `OutcomePeriodInverted` | `forPeriod` | `OUTCOME_ENDS_BEFORE_START` | none |

### Gateways

| Gateway | Upstream | Adapters |
|---|---|---|
| `AppointmentExportGateway` | `scheduling` | `InProcessAppointmentExportGateway` |
<!-- /ddd-ts-kit:reference -->
