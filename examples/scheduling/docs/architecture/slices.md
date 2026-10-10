# Slices

`Start with` holds generator commands without the runner: in this example they are run with
`node scripts/gen.mjs <command>` (the kit's `npx ddd-ts-kit generate <command> --json`, measured).
A use case whose words are not in the glossary yet adds them with `--term "<Term>=<meaning>"`.
Owners: `conductor`, `platform`, or the worker of a context (scheduling has two: `scheduling-calendar`
and `scheduling-appointment`, on different aggregates).

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| 1 | scheduling | skeleton | Calendar, Appointment, Waitlist | `aggregate scheduling <Name>` then `repository scheduling <Name>`, three times | | conductor | done |
| 2 | identity | skeleton | Person, Practice, Delegation | `aggregate identity <Name>` then `repository identity <Name>`, three times | | conductor | done |
| 3 | notification | skeleton | Notification, Reminder | `aggregate notification <Name>` then `repository notification <Name>`, twice | | conductor | done |
| 4 | identity | contract | Person registered, Practice opened, Member added, Member removed, Delegation granted, Delegation revoked | `integration-event identity Person Registered`, `... Practice Opened`, `... Practice MemberAdded`, `... Practice MemberRemoved`, `... Delegation Granted`, `... Delegation Revoked` | 2 | conductor | done |
| 5 | scheduling | contract | Calendar created; Appointment booked, confirmed, rescheduled, cancelled, expired, completed, marked no-show | `integration-event scheduling Calendar Created`, `integration-event scheduling Appointment <Fact>` seven times | 1 | conductor | done |
| 6 | identity | contract | Person directory (read contract) | `gateway scheduling identity PersonDirectory` | 2 | conductor | done |
| 7 | scheduling | contract | Appointment export (read contract, source of a rebuild) | `gateway analytics scheduling AppointmentExport` | 1 | conductor | done |
| 8 | scheduling | skeleton | Policies of the patient's notice | `policy scheduling PatientCancelsUntilNotice --permission appointment.cancel`, `policy scheduling PatientReschedulesUntilNotice --permission appointment.reschedule` | 1 | conductor | done |
| 9 | all | skeleton | Work done by time | `command scheduling ExpireUnconfirmedAppointments --aggregate Appointment --permission appointment.expire` and `job scheduling ExpireUnconfirmedAppointments --every 5m --command ExpireUnconfirmedAppointments`; the same pair for `identity ExpireDelegations` (5m), `notification SendDueReminders` (15m), `analytics VerifyOccupancy` (cron `0 3 * * *`, Europe/Paris; removed after delivery, see the note of 37) | 1, 2, 3 | conductor | done |
| 10 | platform | skeleton | Persistent relation tuples, relationship schema, roles combined with relationships, read-only impersonation | by hand in `src/platform/auth/` (no generator) and `adr "Combine token roles with relationships in one authorizer"` | | platform | todo |
| 11 | identity | slice | Register person | `command identity RegisterPerson --aggregate Person --permission person.register`; `route identity RegisterPerson --method PUT --path /people/me` | 2, 4 | identity | todo |
| 12 | identity | slice | Open practice | `command identity OpenPractice --aggregate Practice --permission practice.open`; `route identity OpenPractice --method POST --path /practices` | 2, 4 | identity | todo |
| 13 | identity | slice | Add member, remove member | `command identity AddMember --aggregate Practice --permission member.add`; `route ... --method POST --path /practices/:practiceId/members`; `command identity RemoveMember --aggregate Practice --permission member.remove`; `route ... --method DELETE --path /practices/:practiceId/members/:personId` | 12 | identity | todo |
| 14 | identity | slice | Grant delegation, revoke delegation | `command identity GrantDelegation --aggregate Delegation --permission delegation.grant`; `route ... --method POST --path /practices/:practiceId/desks/:practitionerId/delegations`; `command identity RevokeDelegation --aggregate Delegation --permission delegation.revoke`; `route ... --method DELETE --path /practices/:practiceId/desks/:practitionerId/delegations/:delegationId` | 13 | identity | todo |
| 15 | identity | slice | Expire delegations (job of row 9) | fill `ExpireDelegations` | 14 | identity | todo |
| 16 | identity | slice | Relationships follow memberships and delegations | `port identity IdentityRelationships`; `adapter identity IdentityRelationships`; `event-handler identity Practice MemberAdded`, `... Practice MemberRemoved`, `... Delegation Granted`, `... Delegation Revoked`, `... Person Registered` | 10, 13, 14 | identity | todo |
| 17 | identity | slice | Answer the person directory | implement `PersonDirectoryContract` of the published language | 6, 11 | identity | todo |
| 18 | scheduling | slice | Practitioners known from identity (projection) | `integration-handler` is not used: a `@Projection` in `application/projections/` over `identity.practice.member-added` and `.member-removed` | 4 | scheduling-calendar | todo |
| 19 | scheduling | slice | Create calendar (walking skeleton of the core) | `command scheduling CreateCalendar --aggregate Calendar --permission calendar.create`; `route scheduling CreateCalendar --method POST --path /calendars` | 1, 5, 18 | scheduling-calendar | todo |
| 20 | scheduling | slice | Set opening hours, add exception, add time off, define appointment type | `command scheduling SetOpeningHours --aggregate Calendar --permission calendar.set-opening-hours` and its route `PUT /calendars/:calendarId/opening-hours`; `AddException` (`POST /calendars/:calendarId/exceptions`); `AddTimeOff` (`POST /calendars/:calendarId/time-off`); `DefineAppointmentType` (`POST /calendars/:calendarId/appointment-types`); value objects `TimeZone`, `Range`, `OpeningHours`, `Exception`, `TimeOff`, `AppointmentType`, `BookingWindow`, `Slot` | 19 | scheduling-calendar | todo |
| 21 | scheduling | slice | Relationships follow calendars and appointments | `port scheduling SchedulingRelationships`; `adapter scheduling SchedulingRelationships`; `event-handler scheduling Calendar Created`; `event-handler scheduling Appointment Booked` | 10, 19 | scheduling-calendar (calendar), scheduling-appointment (appointment) | todo |
| 22 | scheduling | slice | Book appointment (with the Scheduler) | `domain-service scheduling Scheduler`; `command scheduling BookAppointment --aggregate Appointment --permission appointment.book`; `route scheduling BookAppointment --method POST --path /appointments` | 20 | scheduling-appointment | todo |
| 23 | scheduling | slice | Exactly one of two concurrent bookings | exclusion constraint in the table of appointments; integration spec with two concurrent transactions | 22 | scheduling-appointment | todo |
| 24 | scheduling | slice | Confirm, cancel, reschedule | `command scheduling ConfirmAppointment --aggregate Appointment --permission appointment.confirm` (`POST /appointments/:appointmentId/confirmation`); `CancelAppointment` (`POST /appointments/:appointmentId/cancellation`); `RescheduleAppointment` (`POST /appointments/:appointmentId/reschedule`); policies of row 8 | 22 | scheduling-appointment | todo |
| 25 | scheduling | slice | Complete, mark no-show, expire unconfirmed | `command scheduling CompleteAppointment --aggregate Appointment --permission appointment.complete` (`POST /appointments/:appointmentId/completion`); `MarkAppointmentNoShow --permission appointment.mark-no-show` (`POST /appointments/:appointmentId/no-show`); fill `ExpireUnconfirmedAppointments` | 22 | scheduling-appointment | todo |
| 26 | scheduling | slice | Agenda read model (projection of the context's own events) and its searches | `@Projection` in `application/projections/`; `query scheduling SearchAppointments --permission appointment.search --search` (`GET /appointments`); `query scheduling SearchPracticeAgenda --permission agenda.read --search` (`GET /practices/:practiceId/agenda`) | 22 | scheduling-appointment | todo |
| 27 | scheduling | slice | Appointment detail, hydrated with the patient's name | `query scheduling GetAppointment --permission appointment.read` (`GET /appointments/:appointmentId`); fill the gateway of row 6 | 6, 22 | scheduling-appointment | todo |
| 28 | scheduling | slice | Day of a calendar, shared view (busy without the name) | `query scheduling GetCalendarDay --permission calendar.browse` (`GET /calendars/:calendarId/days/:day`) | 20, 26 | scheduling-calendar | todo |
| 29 | scheduling | slice | Waitlist: join, offer a freed slot, the hold expires | `command scheduling JoinWaitlist --aggregate Waitlist --permission waitlist.join` (`POST /calendars/:calendarId/waitlist`); `command scheduling OfferFreedSlot --aggregate Waitlist --permission waitlist.offer`; `event-handler scheduling Appointment Cancelled`, `... Appointment Expired`, `... Appointment Rescheduled` | 24, 25 | scheduling-calendar | todo |
| 30 | scheduling | slice | Answer the appointment export | implement `AppointmentExportContract` of the published language | 7, 26 | scheduling-appointment | todo |
| 31 | notification | slice | Contacts known from identity (projection) | `@Projection` over `identity.person.registered` | 4 | notification | todo |
| 32 | notification | slice | Send a notification for a fact of an appointment | `port notification Mailer`; `adapter notification Mailer --kind external --decorators`; `command notification SendNotification --aggregate Notification --permission notification.send`; `integration-handler notification scheduling scheduling.appointment.booked`, `.confirmed`, `.rescheduled`, `.cancelled` | 3, 5, 31 | notification | todo |
| 33 | notification | slice | Plan, withdraw and send reminders | `command notification PlanReminder --aggregate Reminder --permission reminder.plan`; `command notification WithdrawReminder --aggregate Reminder --permission reminder.withdraw`; consumers of booked, rescheduled, cancelled, expired; fill `SendDueReminders` | 32 | notification | todo |
| 34 | notification | slice | Sent notifications of a person | `query notification SearchNotifications --permission notification.read --search` (`GET /notifications`) | 32 | notification | todo |
| 35 | analytics | slice | Outcomes of appointments (projection) and occupancy per day (the occupancy projection was replaced after delivery, see the note of 35) | two `@Projection` read models over the events of row 5; `port analytics ...` as needed | 5 | analytics | todo |
| 36 | analytics | slice | Read occupancy | `query analytics SearchOccupancy --permission occupancy.read --search` (`GET /practices/:practiceId/occupancy`) | 35 | analytics | todo |
| 37 | analytics | slice | Verify occupancy nightly (replaced after delivery, see the note of 37); rebuild the outcomes from scheduling | fill `VerifyOccupancy`; fill the gateway of row 7; a spec that runs `ProjectionRebuild` | 7, 35 | analytics | todo |
| 38 | all | slice | One booking, one trace, through the worker | `worker`; end-to-end spec asserting the span tree, the log fields, the audit entries, the error report | 22, 32, 35 | conductor | todo |
| 39 | all | slice | Real run | `docker compose`, `scripts/demo.sh` | 38 | conductor | todo |

## Rules per slice

- 11: a person registers themselves: the person id is the actor's id; registering twice updates the name and the contact and announces nothing new.
- 12: only the platform admin opens a practice; the time zone is an IANA zone; the first manager must be a registered person; refuses an unknown zone (`UNKNOWN_TIME_ZONE`).
- 13: a member is a registered person with one role per practice (manager, practitioner, assistant); adding twice is refused (`ALREADY_MEMBER`); the last manager cannot be removed (`LAST_MANAGER`); removing a member revokes their delegations, given and received (cause `member-removed`).
- 14: practitioner and assistant are members of the practice with those roles (`NOT_A_PRACTITIONER`, `NOT_AN_ASSISTANT`); an end in the past is refused (`DELEGATION_ENDS_IN_THE_PAST`); one active delegation per pair; revoking twice is refused (`DELEGATION_NOT_ACTIVE`); the delegation must belong to the desk of the path.
- 15: idempotent; the instant comes from the job's `scheduledAt`.
- 16: tuples, in the unit of work of the command: `practice:<id>#<role>@user:<person>`; for a practitioner `desk:<practice>.<person>#holder@user:<person>` and `desk:...#practice@practice:<id>`; for a delegation `desk:<practice>.<practitioner>#delegate@user:<assistant>` and, when availability is included, `#availability_delegate`; `person:<id>#self@user:<id>`. Removed when the fact ends.
- 19: the practitioner must be known in the practice (`UNKNOWN_PRACTITIONER`); the calendar takes the time zone of the practice; defaults: notice 2 h, horizon 90 days, limit 3.
- 20: ranges of a day do not overlap and end after they start (`INVALID_RANGE`); an exception replaces its day; a time off that covers an active appointment is refused (`TIME_OFF_OVER_APPOINTMENTS`); duration and grid are positive minutes, the grid divides 24 h.
- 22: slot on the grid of its type, inside one opening range of its day in the practice's wall-clock time (daylight-saving days tested in Europe/Paris), not in a time off, inside the booking window (`OUTSIDE_AVAILABILITY`, `OFF_GRID`, `BOOKING_TOO_LATE`, `BOOKING_TOO_FAR`); no overlap with an active appointment, buffer included (`SLOT_TAKEN`, answered 409); at most N future active appointments of this patient with this practitioner (`PATIENT_LIMIT_REACHED`); a type that needs a confirmation gives a requested appointment with a deadline.
- 23: the exclusion constraint of PostgreSQL decides between two concurrent transactions; the loser gets `SLOT_TAKEN` (409), not a 500.
- 24: a patient cancels or reschedules until 24 h before the start (policies; the refusal code is the policy's name); the practice cancels at any time with a reason (`REASON_REQUIRED`); rescheduling is one aggregate change, checked like a booking, the appointment being ignored in its own overlap check; an ended appointment does not change (`APPOINTMENT_ENDED`).
- 25: completed and no-show only after the start (`APPOINTMENT_NOT_STARTED`); expiry is idempotent and takes its instant from `scheduledAt`.
- 26 to 28: searches are narrowed in the statement by the access scope, paginated and filtered with the kit's criteria (`filter[...]`, `sort`); a practice's agenda is refused to a non-member of that practice and narrowed to the calendars the actor runs; in the day view, a held slot the actor may not read shows as busy without the patient.
- 29: one waitlist per calendar and day, arrival order, a waiter once; a freed slot goes to the first waiter whose type fits it, as a requested appointment held 30 minutes; when it expires, the next waiter.
- 32: one notification per consumed event and recipient (idempotent by event id); the mailer is retried, then the event is dead-lettered and reported.
- 33: one reminder per appointment and start, due 24 h before; a rescheduled appointment gets a new one; sending is idempotent by occurrence.
- 35: an outcome carries the state it sets (replays and out-of-order deliveries end on the same row); occupancy of a calendar and day is recomputed from the outcomes.
- 35, replaced after delivery (2026-10-10, product owner): the second read model, a stored line per calendar and day recounted at each event, is gone. One row per fact, computed at read time: the outcomes are the only thing stored, and `SearchOccupancy` measures them in one grouped statement through the port `OccupancyReader`. Reason: a stored figure needed special handling of events out of order and a nightly repair, all of it to keep a copy equal to what the outcomes already say.
- 37, replaced in part after delivery (2026-10-10, product owner): `VerifyOccupancy`, its job `analytics.verify-occupancy`, its permission `occupancy.verify` and the grant of its system actor are removed. Reason: they existed to repair the stored figures of row 35, and nothing is stored any more. The rebuild of the outcomes from the export of `scheduling` stays.
- 36: narrowed to the calendars the actor measures (the manager of the practice: all of them; a practitioner: their own); another practice is refused.

## Permissions and the element they bear on

Every command and query names its permission and, in its `@Requires(..., { resource })`, the
element the right bears on, as the relationship schema of `src/platform/auth/` knows it. A
permission not listed here is for system actors only (jobs and consumers: resource
`{ type: 'context', id: '<context>' }`, as generated).

| Permission | Resource of the requirement | Who holds it |
|---|---|---|
| `identity:person.register` | context (generated default) | any signed-in person (token) |
| `identity:practice.open` | context | role `platform-admin` (token) |
| `identity:member.add`, `identity:member.remove` | `practice:<practiceId>` | managers of the practice |
| `identity:delegation.grant`, `identity:delegation.revoke` | `desk:<practiceId>.<practitionerId>` | the practitioner of the desk, managers of the practice |
| `scheduling:calendar.create` | `desk:<practiceId>.<practitionerId>` | the practitioner of the desk, managers of the practice |
| `scheduling:calendar.set-opening-hours`, `.add-exception`, `.add-time-off`, `.define-appointment-type` | `calendar:<calendarId>` | the practitioner, delegates whose delegation includes availability, managers |
| `scheduling:calendar.browse` | `calendar:<calendarId>` | any signed-in person (token); what they see of each slot depends on `appointment.read` |
| `scheduling:appointment.book`, `scheduling:waitlist.join` | `calendar:<calendarId>`, with `context: { selfService: <the patient is the actor> }` | role `patient` (token) for themselves; the practitioner, delegates and managers for anyone |
| `scheduling:appointment.read` | `appointment:<appointmentId>` | the patient of the appointment; whoever runs its calendar |
| `scheduling:appointment.confirm`, `.cancel`, `.reschedule` | `appointment:<appointmentId>` | the same, then the policies of the patient's notice |
| `scheduling:appointment.complete`, `.mark-no-show` | `appointment:<appointmentId>` | whoever runs its calendar |
| `scheduling:appointment.search` | context | any signed-in person; the search is narrowed by `Access.scope(actor, appointment.read, 'appointment')` |
| `scheduling:agenda.read` | `practice:<practiceId>` | members of the practice; narrowed by `Access.scope(actor, agenda.read, 'calendar')` to the calendars they run |
| `notification:notification.read` | context | any signed-in person; narrowed by `Access.scope(actor, notification.read, 'person')` to themselves |
| `analytics:occupancy.read` | `practice:<practiceId>` | members of the practice; narrowed by `Access.scope(actor, occupancy.read, 'calendar')` to the calendars they measure (their own; all for a manager) |
| `audit:trail.read` | (platform) | role `platform-admin` |

Relationships written by the contexts (through a port of their own, in the unit of work of the
command, never by the domain): see rule 16 for `identity`; `scheduling` writes
`calendar:<id>#desk@desk:<practiceId>.<practitionerId>`, `calendar:<id>#practice@practice:<practiceId>`,
`appointment:<id>#patient@user:<patientId>` and `appointment:<id>#calendar@calendar:<calendarId>`.
