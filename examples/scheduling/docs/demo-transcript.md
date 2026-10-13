# Transcript of the real run

One run of `scripts/demo.mjs`, on 2026-10-10, against the example's own `docker compose` stack
(PostgreSQL 18, Dragonfly, Keycloak 26.8 with the imported realm, Jaeger, GlitchTip), the API and
the worker started from `dist/`. Tokens are real tokens of the local Keycloak and are never
printed; the passwords of the demo users are their user names, for local development only.
Bodies are cut after 700 characters.

> **Read with this in mind.** This run predates a change of design in `analytics`. The occupancy
> of step 7 was then served by a stored line per calendar and day, recounted at each event by a
> second projection (`process analytics.occupancy` and `OccupancyRegister` in the trace of
> step 10) and verified by a nightly job. Since then the occupancy is measured from the outcomes
> when it is read, and that projection, its table and the job are gone. The run is kept as it
> was; the last section, "Run again after analytics moved to read time", holds what a second
> real run answered for these two steps.
>
> It also predates the networks of practices (ADR-0003, 2026-10-13). Since then `demo-admin` holds
> `network-admin` and opens the practices of the network `north`, the audit trail of step 9 is
> read by `demo-ops`, platform staff in no network, through an elevation the trail records, and
> every entry carries the network of its actor. `scripts/demo.mjs` asks it that way; this run was
> not recorded again.

## Commands

```bash
cp .env.example .env            # then, in .env: OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:54318
docker compose --profile identity --profile observability --profile errors up -d --wait
docker compose logs glitchtip | grep 'DSN:'     # the DSN goes to SENTRY_DSN in .env (host 127.0.0.1:54800)
set -a && . ./.env && set +a
npm run db:migrate
node dist/src/main.js &                                              # the API, jobs off
OTEL_SERVICE_NAME=scheduling-worker node dist/src/apps/worker/main.js &   # consumers and scheduled jobs
node --env-file=.env scripts/demo.mjs
```

The stack answered healthy on 127.0.0.1 ports 54320 (PostgreSQL), 54379 (Dragonfly), 54080
(Keycloak), 54686 and 54318 (Jaeger), 54800 (GlitchTip); the API listened on 54300. This
transcript is the second run on the same database (a first run on an empty one passed the same
steps): the scenario can be replayed, each run opens two more practices.

## What the scenario printed

### 1. People register, the platform admin opens two practices

- `PUT /people/me` as **demo-admin**: `200` `{"id":"00000000-0000-4000-8000-00000000a001"}`
- `PUT /people/me` as **demo-manager**: `200` `{"id":"00000000-0000-4000-8000-00000000a002"}`
- `PUT /people/me` as **demo-manager-b**: `200` `{"id":"00000000-0000-4000-8000-00000000a007"}`
- `PUT /people/me` as **demo-practitioner**: `200` `{"id":"00000000-0000-4000-8000-00000000a003"}`
- `PUT /people/me` as **demo-assistant**: `200` `{"id":"00000000-0000-4000-8000-00000000a004"}`
- `PUT /people/me` as **demo-patient**: `200` `{"id":"00000000-0000-4000-8000-00000000a005"}`
- `PUT /people/me` as **demo-patient-2**: `200` `{"id":"00000000-0000-4000-8000-00000000a006"}`
- `PUT /people/me` as **demo-support**: `200` `{"id":"00000000-0000-4000-8000-00000000a008"}`
- `POST /practices` as **demo-admin**: `201` `{"id":"1f235636-8be0-4302-b456-a8796b65cc40"}`
- `POST /practices` as **demo-admin**: `201` `{"id":"e6ad8f95-c118-488b-a623-c38eefe29fe6"}`
- `POST /practices` as **demo-patient**: `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission identity:practice.open is not granted","requestId":"4bb23933-dd2a-44ab-8628-26301af4b3b0"}`
- `POST /practices/1f235636-8be0-4302-b456-a8796b65cc40/members` as **demo-manager**: `201` `{"id":"00000000-0000-4000-8000-00000000a003"}`
- `POST /practices/1f235636-8be0-4302-b456-a8796b65cc40/members` as **demo-manager**: `201` `{"id":"00000000-0000-4000-8000-00000000a004"}`

### 2. The practitioner opens a calendar with its availability

- `POST /calendars` as **demo-practitioner**: `201` `{"id":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c"}`
- `PUT /calendars/8ec0b2b3-196a-45ba-920f-ab3713e2dd6c/opening-hours` as **demo-practitioner**: `200` `{"id":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c"}`
- `POST /calendars/8ec0b2b3-196a-45ba-920f-ab3713e2dd6c/appointment-types` as **demo-practitioner**: `201` `{"id":"a5be6ca2-d996-4737-a92c-99fafb1d481c"}`

### 3. Delegation: the assistant manages the calendars delegated to them, and only what was delegated

- `POST /appointments` as **demo-assistant**: `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission scheduling:appointment.book is not granted","requestId":"4e7309a8-44f2-4e49-9edb-cef74acf7141"}`
- `POST /practices/1f235636-8be0-4302-b456-a8796b65cc40/desks/00000000-0000-4000-8000-00000000a003/delegations` as **demo-practitioner**: `201` `{"id":"c628c4d1-cbbd-4829-a35c-0ad11e00e2af"}`
- `POST /appointments` as **demo-assistant**: `201` `{"id":"aed94000-37e1-4d5f-9072-d4e99845d07a"}`
- `PUT /calendars/8ec0b2b3-196a-45ba-920f-ab3713e2dd6c/opening-hours` as **demo-assistant**: `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission scheduling:calendar.set-opening-hours is not granted","requestId":"5843e38c-f3a3-4fd2-99c5-6de43ad92d9f"}`

### 4. A patient books for themselves; the same slot is refused to the next one

- `POST /appointments` as **demo-patient**: `201` `{"id":"2424c221-de78-40f1-bce0-1de51371ef14"}`
- `POST /appointments` as **demo-patient-2**: `409` `{"type":"urn:problem:slot-taken","title":"Conflict","status":409,"code":"SLOT_TAKEN","detail":"The slot starting at 2026-10-17T06:00:00.000Z on calendar 8ec0b2b3-196a-45ba-920f-ab3713e2dd6c is already held.","requestId":"82ff83a3-482d-4e5e-af38-9c3f1fe79e8b"}`
- `GET /appointments?filter[status]=booked&sort=-startsAt` as **demo-patient**: `200` `{"items":[{"id":"40485b8b-4445-44d2-b183-389032bad003","calendarId":"40f19775-cdbe-4e9a-976e-819b48477386","practiceId":"20026e9e-ba63-4cbf-b8d3-bd2d4a1084bf","practitionerId":"00000000-0000-4000-8000-00000000a003","patientId":"00000000-0000-4000-8000-00000000a005","appointmentTypeId":"c906268a-b92e-423b-845a-65309415bf65","startsAt":"2026-10-17T06:00:00.000Z","endsAt":"2026-10-17T06:30:00.000Z","day":"2026-10-17","status":"booked"},{"id":"2424c221-de78-40f1-bce0-1de51371ef14","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","practiceId":"1f235636-8be0-4302-b456-a8796b65cc40","practitionerId":"00000000-0000-4000-8000-00000000a003","patientId":"00000000-0000-4000-8000-00000000a005","appoin ...`

### 5. Each practice to itself, each patient to themselves

- `GET /practices/1f235636-8be0-4302-b456-a8796b65cc40/agenda` as **demo-manager-b**: `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission scheduling:agenda.read is not granted","requestId":"34468e37-7000-4cf9-99ed-6a34b8c4555c"}`
- `GET /practices/1f235636-8be0-4302-b456-a8796b65cc40/occupancy` as **demo-manager-b**: `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission analytics:occupancy.read is not granted","requestId":"c233bb5c-9de8-4141-8da6-2b9633bfcf0d"}`
- `GET /appointments` as **demo-manager-b**: `200` `{"items":[],"total":0}`
- `GET /appointments/2424c221-de78-40f1-bce0-1de51371ef14` as **demo-patient-2**: `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission scheduling:appointment.read is not granted","requestId":"3ea46516-e89c-4e78-9d9c-c03842a6da68"}`
- `GET /calendars/8ec0b2b3-196a-45ba-920f-ab3713e2dd6c/days/2026-10-17` as **demo-patient-2**: `200` `{"calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","day":"2026-10-17","timeZone":"Europe/Paris","open":[{"startsAt":"2026-10-16T22:00:00.000Z","endsAt":"2026-10-17T21:30:00.000Z"}],"timeOff":[],"appointmentTypes":[{"name":"Consultation","duration":30,"grid":30,"buffer":0,"needsConfirmation":false,"id":"a5be6ca2-d996-4737-a92c-99fafb1d481c"}],"busy":[{"startsAt":"2026-10-17T06:00:00.000Z","endsAt":"2026-10-17T06:30:00.000Z","heldUntil":"2026-10-17T06:30:00.000Z"},{"startsAt":"2026-10-17T07:00:00.000Z","endsAt":"2026-10-17T07:30:00.000Z","heldUntil":"2026-10-17T07:30:00.000Z","appointment":{"id":"aed94000-37e1-4d5f-9072-d4e99845d07a","patientId":"00000000-0000-4000-8000-00000000a006","appoin ...`
- `GET /practices/1f235636-8be0-4302-b456-a8796b65cc40/agenda` as **demo-manager**: `200` `{"items":[{"id":"2424c221-de78-40f1-bce0-1de51371ef14","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","practiceId":"1f235636-8be0-4302-b456-a8796b65cc40","practitionerId":"00000000-0000-4000-8000-00000000a003","patientId":"00000000-0000-4000-8000-00000000a005","appointmentTypeId":"a5be6ca2-d996-4737-a92c-99fafb1d481c","startsAt":"2026-10-17T06:00:00.000Z","endsAt":"2026-10-17T06:30:00.000Z","day":"2026-10-17","status":"booked"},{"id":"aed94000-37e1-4d5f-9072-d4e99845d07a","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","practiceId":"1f235636-8be0-4302-b456-a8796b65cc40","practitionerId":"00000000-0000-4000-8000-00000000a003","patientId":"00000000-0000-4000-8000-00000000a006","appoin ...`

### 6. Less than 24 hours before: the patient may not cancel any more, the practitioner may, with a reason

- `POST /appointments` as **demo-practitioner**: `201` `{"id":"d87e58d3-ee96-401e-8b9e-787b91e8bb83"}`
- `POST /appointments/d87e58d3-ee96-401e-8b9e-787b91e8bb83/cancellation` as **demo-patient**: `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission scheduling:appointment.cancel is not granted","requestId":"d3392e6d-8b21-4ca5-923b-f6fa65675b5d"}`
- `POST /appointments/d87e58d3-ee96-401e-8b9e-787b91e8bb83/cancellation` as **demo-practitioner**: `422` `{"type":"urn:problem:reason-required","title":"Unprocessable Content","status":422,"code":"REASON_REQUIRED","detail":"The practice gives a reason when it cancels an appointment.","requestId":"907b8cfd-7f50-43de-ad3c-00152ebf811b"}`
- `POST /appointments/d87e58d3-ee96-401e-8b9e-787b91e8bb83/cancellation` as **demo-practitioner**: `201` `{"id":"d87e58d3-ee96-401e-8b9e-787b91e8bb83"}`

### 7. The other contexts followed: notifications sent, figures updated

- `GET /notifications` as **demo-patient**: `200` `{"items":[{"id":"b7c55a31-eb0c-4ce6-8f5a-e116ccc04fdb","kind":"confirmation","appointmentId":"d87e58d3-ee96-401e-8b9e-787b91e8bb83","startsAt":"2026-10-10T09:00:00.000Z","sentAt":"2026-10-10T05:45:20.116Z"},{"id":"6bbb4bdc-fdf3-4bd1-a5a1-50025391810c","kind":"confirmation","appointmentId":"2424c221-de78-40f1-bce0-1de51371ef14","startsAt":"2026-10-17T06:00:00.000Z","sentAt":"2026-10-10T05:45:20.005Z"},{"id":"2d40af75-5210-4746-9d01-b899e1a70600","kind":"cancellation","appointmentId":"809c9b4b-9d96-4213-90f2-05ec884b0d8e","startsAt":"2026-10-10T09:00:00.000Z","sentAt":"2026-10-10T05:41:11.263Z"},{"id":"41b1ae41-2298-437a-9b42-ec8892790706","kind":"confirmation","appointmentId":"809c9b4b-9d96-4 ...`
- `GET /practices/1f235636-8be0-4302-b456-a8796b65cc40/occupancy` as **demo-manager**: `200` `{"items":[{"id":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c.2026-10-10","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","day":"2026-10-10","heldMinutes":0,"appointmentsHeld":0,"completed":0,"noShows":0,"cancelledByPatient":0,"cancelledByPractice":1},{"id":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c.2026-10-17","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","day":"2026-10-17","heldMinutes":60,"appointmentsHeld":2,"completed":0,"noShows":0,"cancelledByPatient":0,"cancelledByPractice":0}],"total":2}`

### 8. Support looks on behalf of the patient, and cannot write

`demo-support` impersonates `demo-patient` in Keycloak: the token is the patient's, with `impersonator_id` = 00000000-0000-4000-8000-00000000a008.

- `GET /appointments/2424c221-de78-40f1-bce0-1de51371ef14` as **support-as-patient**: `200` `{"id":"2424c221-de78-40f1-bce0-1de51371ef14","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","practiceId":"1f235636-8be0-4302-b456-a8796b65cc40","practitionerId":"00000000-0000-4000-8000-00000000a003","patientId":"00000000-0000-4000-8000-00000000a005","appointmentTypeId":"a5be6ca2-d996-4737-a92c-99fafb1d481c","startsAt":"2026-10-17T06:00:00.000Z","endsAt":"2026-10-17T06:30:00.000Z","day":"2026-10-17","status":"booked","patientName":"Pia Patient"}`
- `POST /appointments/2424c221-de78-40f1-bce0-1de51371ef14/cancellation` as **support-as-patient**: `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission CancelAppointmentCommand is not granted","requestId":"2e43c8a7-e6d9-4f7e-a3ce-89ace1ef81c2"}`

### 9. The audit trail: who was allowed, who was refused, who looked on whose behalf

- `GET /audit/entries` as **demo-manager**: `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission audit:trail.read is not granted","requestId":"b79657dd-a153-48be-b949-db2346ea602b"}`
- `GET /audit/entries?outcome=denied&actorId=00000000-0000-4000-8000-00000000a007&limit=3` as **demo-admin**: `200` `{"items":[{"id":"0afb7e92-294c-4896-aaef-3e56795e56bd","chain":"global","sequence":68,"occurredAt":"2026-10-10T05:41:11.046Z","category":"authorization","action":"scheduling:agenda.read","outcome":"denied","reason":"NO_RELATION","actorId":"00000000-0000-4000-8000-00000000a007","actorType":"user","resourceType":"practice","resourceId":"20026e9e-ba63-4cbf-b8d3-bd2d4a1084bf","context":"scheduling","correlationId":"e93c2b8e-3105-49be-8c72-f1a011713593","origin":"http","previousHash":"ecb1118f2798ce94b0b59466b104a36cd25f609618e7154011832a51d918a703","hash":"5e078d3bf225882a4bb76ebcc58d46b475eae9d270640a0b4b3bba40dea7c623"},{"id":"71615a41-c1ea-400b-b3db-30ced1b8c86f","chain":"global","sequence":6 ...`
- `GET /audit/entries?actorId=00000000-0000-4000-8000-00000000a005&limit=100` as **demo-admin**: `200` `{"items":[{"id":"51d69071-8347-481c-b48c-86a5ae31b7d8","chain":"global","sequence":15,"occurredAt":"2026-10-10T05:41:10.624Z","category":"authorization","action":"identity:person.register","outcome":"allowed","actorId":"00000000-0000-4000-8000-00000000a005","actorType":"user","resourceType":"context","resourceId":"identity","context":"identity","correlationId":"4f0710f7-62f5-494d-8ff0-142fb5c05691","origin":"http","previousHash":"c0b977e893115d2f4892c5260e1e666fbedb13aac4d5cb1f273a4a05c48d7549","hash":"6f2139c565824aed43fbc5757b08189381e8214351120084c44ce37d57b6f880"},{"id":"f1e64721-3f03-4f59-90d6-b588cda446b7","chain":"global","sequence":17,"occurredAt":"2026-10-10T05:41:10.636Z","category ...`
Entries of the patient that carry the impersonator 00000000-0000-4000-8000-00000000a008: 4, for example:

```json
{
  "id": "b0d4eadc-34b6-44e0-9e07-74a1c73cf5a7",
  "chain": "global",
  "sequence": 92,
  "occurredAt": "2026-10-10T05:41:11.619Z",
  "category": "authorization",
  "action": "scheduling:appointment.cancel",
  "outcome": "allowed",
  "actorId": "00000000-0000-4000-8000-00000000a005",
  "actorType": "user",
  "impersonatedBy": "00000000-0000-4000-8000-00000000a008",
  "resourceType": "appointment",
  "resourceId": "40485b8b-4445-44d2-b183-389032bad003",
  "context": "scheduling",
  "correlationId": "f58c75ea-0802-4b87-ad0c-599396d42968",
  "origin": "http",
  "previousHash": "73e5cc0c5b9deca21cc0b3690e01fc2f8bb92595f63228da0ce79246633c498f",
  "hash": "eb10f50ae57950e8617a6c82ca4a9996f128deea189424eef1cf1520775f54d7"
}
```


### 10. One booking, one trace, read back from Jaeger

`GET http://127.0.0.1:54686/api/v3/traces/144a053238455edb659a6422e6e1e5a1`: 107 spans in one trace, from the processes scheduling (the API and the worker are one consumer group: either may take a delivery). Distinct names:

```text
pg.query:BEGIN app
pg.query:INSERT app
pg.query:SELECT app
pg.query:UPDATE app
pg.query:COMMIT app
repository CalendarRepository.findById
repository AppointmentRepository.heldOn
repository AppointmentRepository.heldBy
repository AppointmentRepository.insert
external SchedulingRelationships.recordAppointment
handler AppointmentBookedEventHandler
outbox append scheduling.appointment.booked
handler AppointmentBookedPublisher
repository Agenda.written
repository Agenda.upsertIfNewer
domain-event scheduling.appointment.booked
repository AppointmentRepository.save
command BookAppointmentCommand
publish scheduling.appointment.booked
repository OutcomeRegister.written
repository OutcomeRegister.upsertIfNewer
process analytics.outcomes
repository NotificationRepository.findByCause
repository Contacts.get
external Mailer.transport
external Mailer.send
external Mailer.deliver
repository OutcomeRegister.get
repository NotificationRepository.insert
repository OutcomeRegister.list
repository OccupancyRegister.written
repository OccupancyRegister.upsertIfNewer
repository ReminderRepository.findByAppointment
repository ReminderRepository.insert
repository ReminderRepository.save
process analytics.occupancy
command PlanReminderCommand
handler NotificationSentEventHandler
domain-event notification.notification.sent
repository NotificationRepository.save
command SendNotificationCommand
process notification.scheduling-appointment-booked
pg.query:SAVEPOINT app
pg.query:RELEASE app
POST /appointments
```


### 11. An unexpected failure reaches the error tracker with the trace id of its request

- `GET /notifications` as **demo-patient**: `500` `{"type":"about:blank","title":"Internal Server Error","status":500,"code":"INTERNAL_ERROR","requestId":"942c262e-f314-4213-9983-45b2c3951640"}`
GlitchTip holds 1 event of the trace 5e830714a9088cc4c7e91b5aa53d9e70:

```json
{
  "type": "error",
  "traceId": "5e830714a9088cc4c7e91b5aa53d9e70",
  "operation": "ListNotificationsQuery",
  "origin": "http",
  "errorCode": "42P01",
  "correlationId": "942c262e-f314-4213-9983-45b2c3951640",
  "actorId": "00000000-0000-4000-8000-00000000a005"
}
```

- `GET /notifications?limit=1` as **demo-patient**: `200` `{"items":[{"id":"1c4c0cf1-f511-410d-a07f-b047152a4fdc","kind":"cancellation","appointmentId":"d87e58d3-ee96-401e-8b9e-787b91e8bb83","startsAt":"2026-10-10T09:00:00.000Z","sentAt":"2026-10-10T05:45:20.227Z"}],"total":6}`

Every step answered as designed.

## Scheduled jobs ran in the worker, not in the API

The worker's log at the first five-minute boundary (the API's log holds no line of origin
`schedule`):

```text
{"level":"info","time":"2026-10-10T05:45:00.051Z","service":"scheduling-worker","environment":"development","job":"scheduling.expire-unconfirmed-appointments","context":"scheduling","outcome":"succeeded","scheduledAt":"2026-10-10T05:45:00.000Z","durationMs":43,"correlationId":"3fca9e9a-dbf2-44f8-8e8e-d8a4fff8e3ee","message":"Sch
{"level":"info","time":"2026-10-10T05:45:00.057Z","service":"scheduling-worker","environment":"development","job":"identity.expire-delegations","context":"identity","outcome":"succeeded","scheduledAt":"2026-10-10T05:45:00.000Z","durationMs":53,"correlationId":"2084920b-1393-4519-b9f2-c6ca9294d3eb","message":"Scheduled job succee
{"level":"info","time":"2026-10-10T05:45:00.063Z","service":"scheduling-worker","environment":"development","job":"notification.send-due-reminders","context":"notification","outcome":"succeeded","scheduledAt":"2026-10-10T05:45:00.000Z","durationMs":56,"correlationId":"76c42bc3-52aa-4108-805d-1bc72359a913","message":"Scheduled jo
```

## What the run showed that the tests had not

- Read models written twice on one key failed on the real clock until the workaround of
  `src/shared-kernel/storable-stamp.ts` (a defect of `@ddd-ts-kit/knex`, see `docs/tooling-report.md`).
- A refusal by a policy answers `403 FORBIDDEN` naming the permission; the policy's own reason
  code does not reach the HTTP body (the kit's problem format has no member for it).
- The decision recorded for the impersonated cancellation is `allowed` (the patient may cancel
  their appointment); the refusal that follows comes from the read-only rule of impersonated
  sessions and is recorded as the failed command.
- Consumers run in both processes as one consumer group: a delivery is taken by the API or by
  the worker, in the same trace either way.

## Stopping

```bash
kill %1 %2
docker compose --profile identity --profile observability --profile errors down --volumes
```

## Run again after analytics moved to read time

A second real run of `scripts/demo.mjs`, on 2026-10-10, after the stored occupancy was removed:
the same commands on an empty database, with the profiles `identity` and `observability` only
(no GlitchTip, so step 11 answered "SENTRY_DSN is not set: skipped."). Every other step answered
as designed. Two steps differ in what serves them, not in what a client reads.

Step 7, the occupancy, now one grouped statement over the outcomes. The same shape and the same
figures as above for the same scenario (the identifiers are those of this run):

- `GET /practices/f6fe6079-0b05-4855-a9e3-ae518ed15a45/occupancy` as **demo-manager**: `200` `{"items":[{"id":"767d0ef7-879d-400b-bc38-f0aa4ef4f3a5.2026-10-10","calendarId":"767d0ef7-879d-400b-bc38-f0aa4ef4f3a5","day":"2026-10-10","heldMinutes":0,"appointmentsHeld":0,"completed":0,"noShows":0,"cancelledByPatient":0,"cancelledByPractice":1},{"id":"767d0ef7-879d-400b-bc38-f0aa4ef4f3a5.2026-10-17","calendarId":"767d0ef7-879d-400b-bc38-f0aa4ef4f3a5","day":"2026-10-17","heldMinutes":60,"appointmentsHeld":2,"completed":0,"noShows":0,"cancelledByPatient":0,"cancelledByPractice":0}],"total":2}`

Step 10, the trace of the booking. `analytics` is one consumer, which writes the outcome; there
is no `process analytics.occupancy`, no `OutcomeRegister.get` or `.list` and no
`OccupancyRegister` any more:

`GET http://127.0.0.1:54686/api/v3/traces/bf1d9dd666a392d44302b8d55771b7db`: 92 spans in one trace, from the processes scheduling (the API and the worker are one consumer group: either may take a delivery). Distinct names:

```text
pg.query:BEGIN app
pg.query:INSERT app
pg.query:SELECT app
pg.query:UPDATE app
pg.query:COMMIT app
pg.query:SAVEPOINT app
pg.query:RELEASE app
repository CalendarRepository.findById
repository AppointmentRepository.heldOn
repository AppointmentRepository.heldBy
repository AppointmentRepository.insert
external SchedulingRelationships.recordAppointment
handler AppointmentBookedEventHandler
outbox append scheduling.appointment.booked
handler AppointmentBookedPublisher
repository Agenda.written
repository Agenda.upsertIfNewer
domain-event scheduling.appointment.booked
repository AppointmentRepository.save
command BookAppointmentCommand
publish scheduling.appointment.booked
repository NotificationRepository.findByCause
repository Contacts.get
external Mailer.transport
external Mailer.deliver
repository OutcomeRegister.written
repository NotificationRepository.insert
process analytics.outcomes
repository ReminderRepository.findByAppointment
repository ReminderRepository.insert
repository ReminderRepository.save
command PlanReminderCommand
handler NotificationSentEventHandler
domain-event notification.notification.sent
repository NotificationRepository.save
command SendNotificationCommand
process notification.scheduling-appointment-booked
POST /appointments
```
