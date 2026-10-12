# Scheduling

## Purpose

Publishes the availability of calendars and takes appointments on them, from booking to completion. It guarantees that a time on a calendar is held once.

## Classification

core

This is why practices come: a time on a calendar is held once, under rules of availability no off-the-shelf tool gives them. It gets the richest model and the most tests.

## Ubiquitous language

| Term | Meaning | Not to be confused with |
|---|---|---|
| Calendar | The agenda a practitioner opens to booking in a practice, with its availability and its booking rules | analytics: a line that is measured |
| Create | To open a new calendar for a practitioner |  |
| Practitioner | The owner of calendars, known from identity | identity: a member with a role |
| Patient | The person an appointment is for | identity: Person |
| Availability | When a calendar can be booked: opening hours, exceptions and time off together |  |
| Opening hours | The weekly ranges, in the wall-clock time of the practice, during which a calendar takes appointments |  |
| Range | A span of one day between two wall-clock times | Slot, which is a span between two instants |
| Exception | A day whose hours replace the weekly ones: closed, or opened on other ranges | Time off |
| Time off | A period during which nothing can be booked, whatever the hours | Exception |
| Appointment type | A kind of appointment a calendar offers, with its duration, its grid, its buffer and whether it needs a confirmation |  |
| Duration | How long an appointment of a type lasts |  |
| Grid | The step, in minutes from midnight, on which appointments of a type start |  |
| Buffer | The time kept free after an appointment, part of what it holds |  |
| Booking window | The earliest and the latest a slot can be booked: a minimum notice and a maximum horizon |  |
| Notice | The minimum time between booking and start | notification: a message |
| Horizon | The maximum time between booking and start |  |
| Limit | The number of future appointments a patient may hold with one practitioner |  |
| Slot | A span of time on a calendar that an appointment holds or could hold | Range |
| Scheduler | The rule keeper that says whether a slot can be taken on a calendar, given what the calendar already holds |  |
| Appointment | The hold of a slot on a calendar for a patient, from booking to its end |  |
| Book | To take a free slot for a patient | Request |
| Request | To take a slot that the patient must still confirm |  |
| Confirm | To say that a requested appointment will be honoured |  |
| Reschedule | To move an appointment to another slot of the same calendar, in one step |  |
| Cancel | To end an appointment before it takes place, saying who and why | Expire |
| Cancellation | Who cancelled (the patient or the practice) and the reason given | analytics: a count |
| Reason | The words given for a cancellation |  |
| Expire | To end a requested appointment that was not confirmed in time | Cancel |
| Complete | To say that an appointment took place |  |
| No show | The patient did not come |  |
| Mark | To record a no-show after the start |  |
| Waitlist | The people waiting for a freed slot on one calendar and one day, in arrival order |  |
| Waiter | A patient on a waitlist, for an appointment type |  |
| Join | To enter a waitlist |  |
| Leave | To quit a waitlist |  |
| Offer | A freed slot held for one waiter until a deadline |  |
| Hold | The time during which an offer waits for its waiter |  |
| Agenda | The appointments of a calendar or of a practice over a day, as the people who run it see them |  |
| Day | A calendar date in the time zone of the practice |  |
| Time zone | The zone whose wall clock the practice lives by |  |
| Free | Not held by any appointment, time off or closed hour |  |
| Busy | Held, without saying by whom |  |
| Unconfirmed | Requested and not confirmed yet |  |
| Booking | What an appointment holds: a slot and its day on a calendar of a practice, for a patient and an appointment type |  |
| Set | To give a calendar its weekly opening hours, replacing the previous ones |  |
| Add | To put an exception or a time off on a calendar |  |
| Define | To describe an appointment type a calendar offers |  |
| Freed | Free again after an appointment ended or moved |  |
| Search | To read the appointments one may see, narrowed, sorted and page by page |  |
| Practice | The place practitioners receive patients in, known from identity by its identifier; it lives in one time zone |  |
| Read | To see an appointment, or the agenda of a practice, as one is allowed to |  |
| Get | To read one element one may see |  |
| Browse | To look at the day of a calendar as anyone signed in may see it |  |

## Aggregates

<!-- ddd-ts-kit:aggregates -->
- `Appointment`
- `Calendar`
- `Waitlist`
<!-- /ddd-ts-kit:aggregates -->

## Published events

<!-- ddd-ts-kit:events -->
- `scheduling.appointment.booked` (version 1)
- `scheduling.appointment.cancelled` (version 1)
- `scheduling.appointment.completed` (version 1)
- `scheduling.appointment.confirmed` (version 1)
- `scheduling.appointment.expired` (version 1)
- `scheduling.appointment.marked-no-show` (version 1)
- `scheduling.appointment.rescheduled` (version 1)
- `scheduling.calendar.created` (version 1)
<!-- /ddd-ts-kit:events -->

## Permissions

<!-- ddd-ts-kit:permissions -->
- `scheduling:appointment.cancel`
- `scheduling:appointment.reschedule`
- `scheduling:appointment.expire`
- `scheduling:calendar.create`
- `scheduling:appointment.book`
- `scheduling:appointment.confirm`
- `scheduling:appointment.complete`
- `scheduling:appointment.mark-no-show`
- `scheduling:calendar.set-opening-hours`
- `scheduling:calendar.add-exception`
- `scheduling:calendar.add-time-off`
- `scheduling:calendar.define-appointment-type`
- `scheduling:waitlist.join`
- `scheduling:waitlist.offer`
- `scheduling:appointment.search`
- `scheduling:agenda.read`
- `scheduling:appointment.read`
- `scheduling:calendar.browse`
<!-- /ddd-ts-kit:permissions -->

## Scheduled jobs

<!-- ddd-ts-kit:jobs -->
| Job | Schedule | Command |
|---|---|---|
| `scheduling.expire-unconfirmed-appointments` | `every 5m` | `ExpireUnconfirmedAppointments` |
<!-- /ddd-ts-kit:jobs -->

## Relationships

<!-- ddd-ts-kit:relationships -->
- Downstream of `identity` (customer-supplier).
- Upstream of `notification` (published-language).
- Upstream of `analytics` (conformist).
<!-- /ddd-ts-kit:relationships -->

## Domain events and what follows them

An effect of a domain event exists only if the state change that recorded it is committed. Every
handler of this context runs at the end of the unit of work of the command, before its commit,
and has transactional effects only: the publishers append to the outbox, the projections write
their tables, three handlers send `OfferFreedSlotCommand`, which joins the unit of work, and
`CalendarCreatedEventHandler` and `AppointmentBookedEventHandler` write the relationships of a
calendar and of an appointment through `SchedulingRelationships`. Its adapter,
`TupleSchedulingRelationships`, writes tuples in a table of the same database (ADR-0001): it is
a persistence adapter, in `infrastructure/persistence/`, for the reasons given in the
`CONTEXT.md` of `identity`.

## Reference

<!-- ddd-ts-kit:reference -->
Generated from the code by `ddd-ts-kit docs`; the same facts as data: `ddd-ts-kit describe scheduling --json`. The fields of each schema are in the generated contracts: [OpenAPI](../../../openapi/openapi.json), [event catalog](../../../docs/integration/event-catalog.md).

**Dependencies**: upstreams: `identity` (customer-supplier); downstreams: `notification` (published-language), `analytics` (conformist).

### Use cases

| Use case | Kind | Permission |
|---|---|---|
| `AddException` | command | `calendar.add-exception` |
| `AddTimeOff` | command | `calendar.add-time-off` |
| `BookAppointment` | command | `appointment.book` |
| `CancelAppointment` | command | `appointment.cancel` |
| `CompleteAppointment` | command | `appointment.complete` |
| `ConfirmAppointment` | command | `appointment.confirm` |
| `CreateCalendar` | command | `calendar.create` |
| `DefineAppointmentType` | command | `calendar.define-appointment-type` |
| `ExpireUnconfirmedAppointments` | command | `appointment.expire` |
| `GetAppointment` | query | `appointment.read` |
| `GetCalendarDay` | query | `calendar.browse` |
| `JoinWaitlist` | command | `waitlist.join` |
| `MarkAppointmentNoShow` | command | `appointment.mark-no-show` |
| `OfferFreedSlot` | command | `waitlist.offer` |
| `RescheduleAppointment` | command | `appointment.reschedule` |
| `SearchAppointments` | query | `appointment.search` |
| `SearchPracticeAgenda` | query | `agenda.read` |
| `SetOpeningHours` | command | `calendar.set-opening-hours` |

### Routes

| Method | Path | Operation | Use case | Permission | Request | Responses | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/appointments` | `searchAppointments` | `SearchAppointments` | `appointment.search` | query | 200: `page of SearchAppointmentsLine` | `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_CRITERIA` |
| POST | `/appointments` | `bookAppointment` | `BookAppointment` | `appointment.book` | body: `BookAppointmentBody` | 201: `BookAppointmentAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `UNKNOWN_CALENDAR`, `UNKNOWN_APPOINTMENT_TYPE`, `OUTSIDE_AVAILABILITY`, `OFF_GRID`, `BOOKING_TOO_LATE`, `BOOKING_TOO_FAR`, `SLOT_TAKEN`, `PATIENT_LIMIT_REACHED` |
| GET | `/appointments/:appointmentId` | `getAppointment` | `GetAppointment` | `appointment.read` | params: `GetAppointmentParams` | 200: `GetAppointmentAnswer` | `UNAUTHORIZED`, `FORBIDDEN`, `APPOINTMENT_NOT_FOUND` |
| POST | `/appointments/:appointmentId/cancellation` | `cancelAppointment` | `CancelAppointment` | `appointment.cancel` | params: `CancelAppointmentParams`, body: `CancelAppointmentBody` | 201: `CancelAppointmentAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_ENDED`, `REASON_REQUIRED` |
| POST | `/appointments/:appointmentId/completion` | `completeAppointment` | `CompleteAppointment` | `appointment.complete` | params: `CompleteAppointmentParams` | 201: `CompleteAppointmentAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_ENDED`, `APPOINTMENT_NOT_STARTED` |
| POST | `/appointments/:appointmentId/confirmation` | `confirmAppointment` | `ConfirmAppointment` | `appointment.confirm` | params: `ConfirmAppointmentParams` | 201: `ConfirmAppointmentAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_ENDED`, `APPOINTMENT_ALREADY_CONFIRMED` |
| POST | `/appointments/:appointmentId/no-show` | `markAppointmentNoShow` | `MarkAppointmentNoShow` | `appointment.mark-no-show` | params: `MarkAppointmentNoShowParams` | 201: `MarkAppointmentNoShowAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_ENDED`, `APPOINTMENT_NOT_STARTED` |
| POST | `/appointments/:appointmentId/reschedule` | `rescheduleAppointment` | `RescheduleAppointment` | `appointment.reschedule` | params: `RescheduleAppointmentParams`, body: `RescheduleAppointmentBody` | 201: `RescheduleAppointmentAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_ENDED`, `UNKNOWN_CALENDAR`, `UNKNOWN_APPOINTMENT_TYPE`, `OUTSIDE_AVAILABILITY`, `OFF_GRID`, `BOOKING_TOO_LATE`, `BOOKING_TOO_FAR`, `SLOT_TAKEN`, `PATIENT_LIMIT_REACHED` |
| POST | `/calendars` | `createCalendar` | `CreateCalendar` | `calendar.create` | body: `CreateCalendarBody` | 201: `CreateCalendarAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `UNKNOWN_PRACTITIONER`, `UNKNOWN_TIME_ZONE` |
| POST | `/calendars/:calendarId/appointment-types` | `defineAppointmentType` | `DefineAppointmentType` | `calendar.define-appointment-type` | params: `DefineAppointmentTypeParams`, body: `DefineAppointmentTypeBody` | 201: `DefineAppointmentTypeAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `UNKNOWN_CALENDAR`, `INVALID_APPOINTMENT_TYPE` |
| GET | `/calendars/:calendarId/days/:day` | `getCalendarDay` | `GetCalendarDay` | `calendar.browse` | params: `GetCalendarDayParams` | 200: `GetCalendarDayAnswer` | `UNAUTHORIZED`, `FORBIDDEN`, `UNKNOWN_CALENDAR`, `INVALID_DAY` |
| POST | `/calendars/:calendarId/exceptions` | `addException` | `AddException` | `calendar.add-exception` | params: `AddExceptionParams`, body: `AddExceptionBody` | 201: `AddExceptionAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `UNKNOWN_CALENDAR`, `INVALID_DAY`, `INVALID_RANGE` |
| PUT | `/calendars/:calendarId/opening-hours` | `setOpeningHours` | `SetOpeningHours` | `calendar.set-opening-hours` | params: `SetOpeningHoursParams`, body: `SetOpeningHoursBody` | 200: `SetOpeningHoursAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `UNKNOWN_CALENDAR`, `INVALID_RANGE` |
| POST | `/calendars/:calendarId/time-off` | `addTimeOff` | `AddTimeOff` | `calendar.add-time-off` | params: `AddTimeOffParams`, body: `AddTimeOffBody` | 201: `AddTimeOffAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `UNKNOWN_CALENDAR`, `INVALID_TIME_OFF`, `TIME_OFF_OVER_APPOINTMENTS` |
| POST | `/calendars/:calendarId/waitlist` | `joinWaitlist` | `JoinWaitlist` | `waitlist.join` | params: `JoinWaitlistParams`, body: `JoinWaitlistBody` | 201: `JoinWaitlistAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `UNKNOWN_CALENDAR`, `UNKNOWN_APPOINTMENT_TYPE`, `INVALID_DAY`, `ALREADY_WAITING` |
| GET | `/practices/:practiceId/agenda` | `searchPracticeAgenda` | `SearchPracticeAgenda` | `agenda.read` | params: `SearchPracticeAgendaParams`, query | 200: `page of SearchPracticeAgendaLine` | `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_CRITERIA` |

### Publishers

| Event | Versions | Publisher |
|---|---|---|
| `scheduling.appointment.booked` | 1 | `AppointmentBookedPublisher` |
| `scheduling.appointment.cancelled` | 1 | `AppointmentCancelledPublisher` |
| `scheduling.appointment.completed` | 1 | `AppointmentCompletedPublisher` |
| `scheduling.appointment.confirmed` | 1 | `AppointmentConfirmedPublisher` |
| `scheduling.appointment.expired` | 1 | `AppointmentExpiredPublisher` |
| `scheduling.appointment.marked-no-show` | 1 | `AppointmentMarkedNoShowPublisher` |
| `scheduling.appointment.rescheduled` | 1 | `AppointmentRescheduledPublisher` |
| `scheduling.calendar.created` | 1 | `CalendarCreatedPublisher` |

### Projections

| Projection | Class | Applies |
|---|---|---|
| `scheduling.agenda` | `AgendaProjection` | `AppointmentBooked`, `AppointmentConfirmed`, `AppointmentRescheduled`, `AppointmentCancelled`, `AppointmentExpired`, `AppointmentCompleted`, `AppointmentMarkedNoShow` |
| `scheduling.practitioners` | `PractitionersProjection` | `practiceMemberAddedV1`, `practiceMemberRemovedV1` |

### Ports

| Port | Kind | Adapters |
|---|---|---|
| `Agenda` | repository | `KnexAgenda` |
| `AppointmentRepository` | repository | `KnexAppointmentRepository` |
| `CalendarRepository` | repository | `KnexCalendarRepository` |
| `PersonDirectoryGateway` | gateway | `InProcessPersonDirectoryGateway` |
| `PractitionerDirectory` | repository | `KnexPractitionerDirectory` |
| `SchedulingRelationships` | repository | `TupleSchedulingRelationships` |
| `WaitlistRepository` | repository | `KnexWaitlistRepository` |

### Policies

| Policy | Permission |
|---|---|
| `PatientCancelsUntilNotice` | `appointment.cancel` |
| `PatientReschedulesUntilNotice` | `appointment.reschedule` |

### Gateways

| Gateway | Upstream | Adapters |
|---|---|---|
| `PersonDirectoryGateway` | `identity` | `InProcessPersonDirectoryGateway` |
<!-- /ddd-ts-kit:reference -->
