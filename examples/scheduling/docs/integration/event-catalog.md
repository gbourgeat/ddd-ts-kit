# Event catalog

Generated from the integration event declarations. Do not edit by hand: regenerate.

## identity

### identity.delegation.granted

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `identity.delegation.granted` | 1 | A practitioner let an assistant of the same practice manage their calendars, with or without their availability, until an optional end. | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `delegationId` | string | yes |  |
| `practiceId` | string | yes |  |
| `practitionerId` | string | yes |  |
| `assistantId` | string | yes |  |
| `availabilityIncluded` | boolean | yes |  |
| `endsAt` | string (date) \| string (date-time) | no |  |

### identity.delegation.revoked

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `identity.delegation.revoked` | 1 | A delegation ended: withdrawn, expired at its end date, or because one of the two left the practice. | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `delegationId` | string | yes |  |
| `practiceId` | string | yes |  |
| `practitionerId` | string | yes |  |
| `assistantId` | string | yes |  |
| `cause` | enum ("revoked", "expired", "member-removed") | yes |  |

### identity.person.registered

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `identity.person.registered` | 1 | A person signed in for the first time and is now known to the platform, with the name and the address to reach them. | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `personId` | string | yes |  |
| `displayName` | string | yes |  |
| `email` | string (email) | yes |  |

### identity.practice.member-added

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `identity.practice.member-added` | 1 | A person became a member of a practice with a role; the time zone of the practice travels with it so that a consumer needs nothing else to place the member. | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `practiceId` | string | yes |  |
| `personId` | string | yes |  |
| `role` | enum ("manager", "practitioner", "assistant") | yes |  |
| `displayName` | string | yes |  |
| `timeZone` | string | yes |  |

### identity.practice.member-removed

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `identity.practice.member-removed` | 1 | A membership ended: the person no longer holds this role in the practice. | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `practiceId` | string | yes |  |
| `personId` | string | yes |  |
| `role` | enum ("manager", "practitioner", "assistant") | yes |  |

### identity.practice.opened

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `identity.practice.opened` | 1 | A practice was opened, in its time zone, with its first manager. | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `practiceId` | string | yes |  |
| `name` | string | yes |  |
| `timeZone` | string | yes |  |
| `managerId` | string | yes |  |

## scheduling

### scheduling.appointment.booked

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `scheduling.appointment.booked` | 1 | A slot is now held for a patient: booked, or requested when the patient must still confirm before a deadline. | no |

Consumers: `notification`

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `appointmentId` | string | yes |  |
| `calendarId` | string | yes |  |
| `practiceId` | string | yes |  |
| `practitionerId` | string | yes |  |
| `patientId` | string | yes |  |
| `startsAt` | string (date) \| string (date-time) | yes |  |
| `endsAt` | string (date) \| string (date-time) | yes |  |
| `day` | string | yes |  |
| `status` | enum ("booked", "requested") | yes |  |
| `confirmBefore` | string (date) \| string (date-time) | no |  |

### scheduling.appointment.cancelled

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `scheduling.appointment.cancelled` | 1 | An appointment was cancelled before taking place, by the patient or by the practice; its slot is free again. The reason given stays in scheduling. | no |

Consumers: `notification`

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `appointmentId` | string | yes |  |
| `calendarId` | string | yes |  |
| `practiceId` | string | yes |  |
| `practitionerId` | string | yes |  |
| `patientId` | string | yes |  |
| `startsAt` | string (date) \| string (date-time) | yes |  |
| `endsAt` | string (date) \| string (date-time) | yes |  |
| `day` | string | yes |  |
| `cancelledBy` | enum ("patient", "practice") | yes |  |

### scheduling.appointment.completed

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `scheduling.appointment.completed` | 1 | The appointment took place. | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `appointmentId` | string | yes |  |
| `calendarId` | string | yes |  |
| `practiceId` | string | yes |  |
| `practitionerId` | string | yes |  |
| `patientId` | string | yes |  |
| `startsAt` | string (date) \| string (date-time) | yes |  |
| `endsAt` | string (date) \| string (date-time) | yes |  |
| `day` | string | yes |  |

### scheduling.appointment.confirmed

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `scheduling.appointment.confirmed` | 1 | The patient confirmed a requested appointment: it will be honoured. | no |

Consumers: `notification`

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `appointmentId` | string | yes |  |
| `calendarId` | string | yes |  |
| `practiceId` | string | yes |  |
| `practitionerId` | string | yes |  |
| `patientId` | string | yes |  |
| `startsAt` | string (date) \| string (date-time) | yes |  |
| `endsAt` | string (date) \| string (date-time) | yes |  |
| `day` | string | yes |  |

### scheduling.appointment.expired

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `scheduling.appointment.expired` | 1 | A requested appointment was not confirmed in time; its slot is free again. | no |

Consumers: `notification`

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `appointmentId` | string | yes |  |
| `calendarId` | string | yes |  |
| `practiceId` | string | yes |  |
| `practitionerId` | string | yes |  |
| `patientId` | string | yes |  |
| `startsAt` | string (date) \| string (date-time) | yes |  |
| `endsAt` | string (date) \| string (date-time) | yes |  |
| `day` | string | yes |  |

### scheduling.appointment.marked-no-show

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `scheduling.appointment.marked-no-show` | 1 | The patient did not come to the appointment. | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `appointmentId` | string | yes |  |
| `calendarId` | string | yes |  |
| `practiceId` | string | yes |  |
| `practitionerId` | string | yes |  |
| `patientId` | string | yes |  |
| `startsAt` | string (date) \| string (date-time) | yes |  |
| `endsAt` | string (date) \| string (date-time) | yes |  |
| `day` | string | yes |  |

### scheduling.appointment.rescheduled

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `scheduling.appointment.rescheduled` | 1 | An appointment moved to another slot of the same calendar, in one step; the previous slot is free again. | no |

Consumers: `notification`

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `appointmentId` | string | yes |  |
| `calendarId` | string | yes |  |
| `practiceId` | string | yes |  |
| `practitionerId` | string | yes |  |
| `patientId` | string | yes |  |
| `startsAt` | string (date) \| string (date-time) | yes |  |
| `endsAt` | string (date) \| string (date-time) | yes |  |
| `day` | string | yes |  |
| `previousStartsAt` | string (date) \| string (date-time) | yes |  |
| `previousDay` | string | yes |  |

### scheduling.calendar.created

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `scheduling.calendar.created` | 1 | A practitioner has a new calendar in a practice, in the time zone of that practice. | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `calendarId` | string | yes |  |
| `practiceId` | string | yes |  |
| `practitionerId` | string | yes |  |
| `timeZone` | string | yes |  |
