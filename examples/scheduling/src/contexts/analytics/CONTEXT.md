# Analytics

## Purpose

Measures the occupancy, the cancellations and the no-shows of each calendar, per day. It only reads what the other contexts announce.

## Classification

supporting

Needed by practice managers, built entirely from what scheduling announces: read models, no decision.

## Ubiquitous language

| Term | Meaning | Not to be confused with |
|---|---|---|
| Occupancy | The time held by appointments on a calendar over a day, with their count |  |
| Outcome | How an appointment stands for measurement: held, completed, no-show, cancelled by the patient, cancelled by the practice, expired | scheduling: the appointment itself |
| Cancellation | A count of appointments cancelled on a day, by party | scheduling: who and why |
| No show | A count of appointments whose patient did not come |  |
| Calendar | A line whose occupancy is measured, in a practice | scheduling: the agenda |
| Day | A calendar date in the time zone of the practice |  |
| Verify | To recompute the figures of recent days from the outcomes and repair a difference |  |
| List | To read the occupancy of the calendars of a practice, day by day |  |
| Read | To see the occupancy of the calendars one measures |  |
| Measure | To compute the occupancy of a calendar over a day from the outcomes of its appointments |  |

## Aggregates

<!-- ddd-ts-kit:aggregates -->
<!-- /ddd-ts-kit:aggregates -->

## Published events

<!-- ddd-ts-kit:events -->
<!-- /ddd-ts-kit:events -->

## Permissions

<!-- ddd-ts-kit:permissions -->
- `analytics:occupancy.verify`
- `analytics:occupancy.read`
<!-- /ddd-ts-kit:permissions -->

## Scheduled jobs

<!-- ddd-ts-kit:jobs -->
| Job | Schedule | Command |
|---|---|---|
| `analytics.verify-occupancy` | `cron 0 3 * * * (Europe/Paris)` | `VerifyOccupancy` |
<!-- /ddd-ts-kit:jobs -->

## Relationships

<!-- ddd-ts-kit:relationships -->
- Downstream of `scheduling` (conformist).
<!-- /ddd-ts-kit:relationships -->

## Reference

<!-- ddd-ts-kit:reference -->
Generated from the code by `ddd-ts-kit docs`; the same facts as data: `ddd-ts-kit describe analytics --json`. The fields of each schema are in the generated contracts: [OpenAPI](../../../openapi/openapi.json), [event catalog](../../../docs/integration/event-catalog.md).

**Dependencies**: upstreams: `scheduling` (conformist); downstreams: none.

### Use cases

| Use case | Kind | Permission |
|---|---|---|
| `ListOccupancy` | query | `occupancy.read` |
| `VerifyOccupancy` | command | `occupancy.verify` |

### Routes

| Method | Path | Operation | Use case | Permission | Request | Responses | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/practices/:practiceId/occupancy` | `listOccupancy` | `ListOccupancy` | `occupancy.read` | params: `ListOccupancyParams`, query | 200: `page of ListOccupancyLine` | `UNAUTHORIZED`, `FORBIDDEN` |

### Ports

| Port | Kind | Adapters |
|---|---|---|
| `AppointmentExportGateway` | gateway | `InProcessAppointmentExportGateway` |
| `OccupancyRegister` | repository | `KnexOccupancyRegister` |
| `OutcomeRegister` | repository | `KnexOutcomeRegister` |

### Gateways

| Gateway | Upstream | Adapters |
|---|---|---|
| `AppointmentExportGateway` | `scheduling` | `InProcessAppointmentExportGateway` |
<!-- /ddd-ts-kit:reference -->
