# Notification

## Purpose

Tells people what happened to their appointments and reminds them before the start. It decides nothing about an appointment.

## Classification

supporting

Needed, and specific in what is said and when, but it decides nothing: a simple model behind a mail port.

## Ubiquitous language

| Term | Meaning | Not to be confused with |
|---|---|---|
| Notification | A message sent to a person about one fact of one appointment | scheduling: Notice |
| Send | To hand a notification to the mail provider |  |
| Recipient | The person a notification is for | scheduling: Patient |
| Contact | The address at which a recipient is reached |  |
| Confirmation | The notification that an appointment is booked or confirmed |  |
| Reminder | The notification due 24 hours before the start of an appointment, once per appointment and start |  |
| Plan | To schedule the reminder of an appointment |  |
| Due | Whose time to be sent has come |  |
| Withdraw | To drop a planned reminder because its appointment ended or moved | scheduling: Cancel |
| Mailer | The mail provider, seen from here |  |
| Kind | What a notification tells: a request, a confirmation, a rescheduling, a cancellation or a reminder |  |
| Request | The notification that an appointment is asked for and awaits its confirmation |  |
| Rescheduling | The notification that an appointment moved to another start |  |
| Cancellation | The notification that an appointment is cancelled |  |
| Read | To see the notifications sent to oneself |  |
| Search | To read the notifications sent to a person, latest first |  |

## Aggregates

<!-- ddd-ts-kit:aggregates -->
- `Notification`
- `Reminder`
<!-- /ddd-ts-kit:aggregates -->

## Published events

<!-- ddd-ts-kit:events -->
<!-- /ddd-ts-kit:events -->

## Permissions

<!-- ddd-ts-kit:permissions -->
- `notification:reminder.send`
- `notification:notification.send`
- `notification:reminder.plan`
- `notification:reminder.withdraw`
- `notification:notification.read`
<!-- /ddd-ts-kit:permissions -->

## Scheduled jobs

<!-- ddd-ts-kit:jobs -->
| Job | Schedule | Command |
|---|---|---|
| `notification.send-due-reminders` | `every 15m` | `SendDueReminders` |
<!-- /ddd-ts-kit:jobs -->

## Relationships

<!-- ddd-ts-kit:relationships -->
- Downstream of `scheduling` (published-language).
- Downstream of `identity` (published-language).
<!-- /ddd-ts-kit:relationships -->

## Reference

<!-- ddd-ts-kit:reference -->
Generated from the code by `ddd-ts-kit docs`; the same facts as data: `ddd-ts-kit describe notification --json`. The fields of each schema are in the generated contracts: [OpenAPI](../../../openapi/openapi.yaml), [event catalog](../../../docs/integration/event-catalog.md).

**Dependencies**: upstreams: `scheduling` (published-language), `identity` (published-language); downstreams: none.

### Use cases

| Use case | Kind | Permission |
|---|---|---|
| `PlanReminder` | command | `reminder.plan` |
| `SearchNotifications` | query | `notification.read` |
| `SendDueReminders` | command | `reminder.send` |
| `SendNotification` | command | `notification.send` |
| `WithdrawReminder` | command | `reminder.withdraw` |

### Routes

| Method | Path | Operation | Group | Guards | Use case | Permission | Request | Responses | Errors |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/notifications` | `searchNotifications` | `NotificationsRoutes` | `Authenticated` | `SearchNotifications` | `notification.read` | query | 200: `page of SearchNotificationsLine` | `UNAUTHORIZED`, `FORBIDDEN` |

### Consumed events

| Event | Version | From | Handler | Consumer |
|---|---|---|---|---|
| `scheduling.appointment.booked` | 1 | `scheduling` | `SchedulingAppointmentBookedIntegrationHandler` | `notification.scheduling-appointment-booked` |
| `scheduling.appointment.cancelled` | 1 | `scheduling` | `SchedulingAppointmentCancelledIntegrationHandler` | `notification.scheduling-appointment-cancelled` |
| `scheduling.appointment.confirmed` | 1 | `scheduling` | `SchedulingAppointmentConfirmedIntegrationHandler` | `notification.scheduling-appointment-confirmed` |
| `scheduling.appointment.expired` | 1 | `scheduling` | `SchedulingAppointmentExpiredIntegrationHandler` | `notification.scheduling-appointment-expired` |
| `scheduling.appointment.rescheduled` | 1 | `scheduling` | `SchedulingAppointmentRescheduledIntegrationHandler` | `notification.scheduling-appointment-rescheduled` |

### Projections

| Projection | Class | Applies |
|---|---|---|
| `notification.contacts` | `ContactsProjection` | `personRegisteredV1` |

### Ports

| Port | Kind | Adapters |
|---|---|---|
| `Contacts` | repository | `KnexContacts` |
| `Mailer` | external | `RemoteMailer` |
| `NotificationRepository` | repository | `KnexNotificationRepository` |
| `ReminderRepository` | repository | `KnexReminderRepository` |
| `SearchNotificationsReader` | repository | `KnexSearchNotificationsReader` |

### Errors

| Refusal | Factory | Code | Exposed facts |
|---|---|---|---|
| `ContactUnknown` | `forRecipient` | `CONTACT_UNKNOWN` | none |
| `InvalidNotificationKind` | `forKind` | `INVALID_NOTIFICATION_KIND` | none |
| `ReminderNotDue` | `forReminder` | `REMINDER_NOT_DUE` | none |
<!-- /ddd-ts-kit:reference -->
