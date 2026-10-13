[English](demo-transcript.md) · **Français**
<!-- translation-of: demo-transcript.md sha256:a0a9318c369e3ff8 -->

# Transcription de l'exécution réelle

Une exécution de `scripts/demo.mjs`, le 2026-10-10, contre la pile `docker compose` propre à
l'exemple (PostgreSQL 18, Dragonfly, Keycloak 26.8 avec le realm importé, Jaeger, GlitchTip), l'API
et le *worker* démarrés depuis `dist/`. Les jetons sont de vrais jetons du Keycloak local et ne sont
jamais affichés ; les mots de passe des utilisateurs de démonstration sont leurs noms
d'utilisateur, pour le développement local seulement. Les corps sont coupés après 700 caractères.

> **À lire en gardant ceci en tête.** Cette exécution précède un changement de conception dans
> `analytics`. L'occupation de l'étape 7 était alors servie par une ligne stockée par calendrier et
> par jour, recomptée à chaque événement par une seconde projection (`process analytics.occupancy`
> et `OccupancyRegister` dans la trace de l'étape 10) et vérifiée par un *job* nocturne. Depuis,
> l'occupation est mesurée à partir des issues au moment où on la lit, et cette projection, sa
> table et le *job* ont disparu. L'exécution est gardée telle qu'elle était ; la dernière section,
> « Nouvelle exécution après le passage d'analytics au calcul à la lecture », contient ce qu'une
> seconde exécution réelle a répondu pour ces deux étapes.

## Commandes

```bash
cp .env.example .env            # puis, dans .env : OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:54318
docker compose --profile identity --profile observability --profile errors up -d --wait
docker compose logs glitchtip | grep 'DSN:'     # le DSN va dans SENTRY_DSN de .env (hôte 127.0.0.1:54800)
set -a && . ./.env && set +a
npm run db:migrate
node dist/src/main.js &                                              # l'API, jobs désactivés
OTEL_SERVICE_NAME=scheduling-worker node dist/src/apps/worker/main.js &   # consommateurs et jobs planifiés
node --env-file=.env scripts/demo.mjs
```

La pile a répondu en bonne santé sur 127.0.0.1, ports 54320 (PostgreSQL), 54379 (Dragonfly),
54080 (Keycloak), 54686 et 54318 (Jaeger), 54800 (GlitchTip) ; l'API écoutait sur 54300. Cette
transcription est la seconde exécution sur la même base de données (une première exécution sur une
base vide a passé les mêmes étapes) : le scénario peut être rejoué, chaque exécution ouvre deux
cabinets de plus.

## Ce que le scénario a affiché

### 1. Les personnes s'inscrivent, l'administrateur de la plateforme ouvre deux cabinets

- `PUT /people/me` en tant que **demo-admin** : `200` `{"id":"00000000-0000-4000-8000-00000000a001"}`
- `PUT /people/me` en tant que **demo-manager** : `200` `{"id":"00000000-0000-4000-8000-00000000a002"}`
- `PUT /people/me` en tant que **demo-manager-b** : `200` `{"id":"00000000-0000-4000-8000-00000000a007"}`
- `PUT /people/me` en tant que **demo-practitioner** : `200` `{"id":"00000000-0000-4000-8000-00000000a003"}`
- `PUT /people/me` en tant que **demo-assistant** : `200` `{"id":"00000000-0000-4000-8000-00000000a004"}`
- `PUT /people/me` en tant que **demo-patient** : `200` `{"id":"00000000-0000-4000-8000-00000000a005"}`
- `PUT /people/me` en tant que **demo-patient-2** : `200` `{"id":"00000000-0000-4000-8000-00000000a006"}`
- `PUT /people/me` en tant que **demo-support** : `200` `{"id":"00000000-0000-4000-8000-00000000a008"}`
- `POST /practices` en tant que **demo-admin** : `201` `{"id":"1f235636-8be0-4302-b456-a8796b65cc40"}`
- `POST /practices` en tant que **demo-admin** : `201` `{"id":"e6ad8f95-c118-488b-a623-c38eefe29fe6"}`
- `POST /practices` en tant que **demo-patient** : `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission identity:practice.open is not granted","requestId":"4bb23933-dd2a-44ab-8628-26301af4b3b0"}`
- `POST /practices/1f235636-8be0-4302-b456-a8796b65cc40/members` en tant que **demo-manager** : `201` `{"id":"00000000-0000-4000-8000-00000000a003"}`
- `POST /practices/1f235636-8be0-4302-b456-a8796b65cc40/members` en tant que **demo-manager** : `201` `{"id":"00000000-0000-4000-8000-00000000a004"}`

### 2. Le praticien ouvre un calendrier avec ses disponibilités

- `POST /calendars` en tant que **demo-practitioner** : `201` `{"id":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c"}`
- `PUT /calendars/8ec0b2b3-196a-45ba-920f-ab3713e2dd6c/opening-hours` en tant que **demo-practitioner** : `200` `{"id":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c"}`
- `POST /calendars/8ec0b2b3-196a-45ba-920f-ab3713e2dd6c/appointment-types` en tant que **demo-practitioner** : `201` `{"id":"a5be6ca2-d996-4737-a92c-99fafb1d481c"}`

### 3. Délégation : l'assistant gère les calendriers qui lui sont délégués, et seulement ce qui a été délégué

- `POST /appointments` en tant que **demo-assistant** : `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission scheduling:appointment.book is not granted","requestId":"4e7309a8-44f2-4e49-9edb-cef74acf7141"}`
- `POST /practices/1f235636-8be0-4302-b456-a8796b65cc40/desks/00000000-0000-4000-8000-00000000a003/delegations` en tant que **demo-practitioner** : `201` `{"id":"c628c4d1-cbbd-4829-a35c-0ad11e00e2af"}`
- `POST /appointments` en tant que **demo-assistant** : `201` `{"id":"aed94000-37e1-4d5f-9072-d4e99845d07a"}`
- `PUT /calendars/8ec0b2b3-196a-45ba-920f-ab3713e2dd6c/opening-hours` en tant que **demo-assistant** : `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission scheduling:calendar.set-opening-hours is not granted","requestId":"5843e38c-f3a3-4fd2-99c5-6de43ad92d9f"}`

### 4. Un patient réserve pour lui-même ; le même créneau est refusé au suivant

- `POST /appointments` en tant que **demo-patient** : `201` `{"id":"2424c221-de78-40f1-bce0-1de51371ef14"}`
- `POST /appointments` en tant que **demo-patient-2** : `409` `{"type":"urn:problem:slot-taken","title":"Conflict","status":409,"code":"SLOT_TAKEN","detail":"The slot starting at 2026-10-17T06:00:00.000Z on calendar 8ec0b2b3-196a-45ba-920f-ab3713e2dd6c is already held.","requestId":"82ff83a3-482d-4e5e-af38-9c3f1fe79e8b"}`
- `GET /appointments?filter[status]=booked&sort=-startsAt` en tant que **demo-patient** : `200` `{"items":[{"id":"40485b8b-4445-44d2-b183-389032bad003","calendarId":"40f19775-cdbe-4e9a-976e-819b48477386","practiceId":"20026e9e-ba63-4cbf-b8d3-bd2d4a1084bf","practitionerId":"00000000-0000-4000-8000-00000000a003","patientId":"00000000-0000-4000-8000-00000000a005","appointmentTypeId":"c906268a-b92e-423b-845a-65309415bf65","startsAt":"2026-10-17T06:00:00.000Z","endsAt":"2026-10-17T06:30:00.000Z","day":"2026-10-17","status":"booked"},{"id":"2424c221-de78-40f1-bce0-1de51371ef14","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","practiceId":"1f235636-8be0-4302-b456-a8796b65cc40","practitionerId":"00000000-0000-4000-8000-00000000a003","patientId":"00000000-0000-4000-8000-00000000a005","appoin ...`

### 5. Chaque cabinet à part, chaque patient à part

- `GET /practices/1f235636-8be0-4302-b456-a8796b65cc40/agenda` en tant que **demo-manager-b** : `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission scheduling:agenda.read is not granted","requestId":"34468e37-7000-4cf9-99ed-6a34b8c4555c"}`
- `GET /practices/1f235636-8be0-4302-b456-a8796b65cc40/occupancy` en tant que **demo-manager-b** : `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission analytics:occupancy.read is not granted","requestId":"c233bb5c-9de8-4141-8da6-2b9633bfcf0d"}`
- `GET /appointments` en tant que **demo-manager-b** : `200` `{"items":[],"total":0}`
- `GET /appointments/2424c221-de78-40f1-bce0-1de51371ef14` en tant que **demo-patient-2** : `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission scheduling:appointment.read is not granted","requestId":"3ea46516-e89c-4e78-9d9c-c03842a6da68"}`
- `GET /calendars/8ec0b2b3-196a-45ba-920f-ab3713e2dd6c/days/2026-10-17` en tant que **demo-patient-2** : `200` `{"calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","day":"2026-10-17","timeZone":"Europe/Paris","open":[{"startsAt":"2026-10-16T22:00:00.000Z","endsAt":"2026-10-17T21:30:00.000Z"}],"timeOff":[],"appointmentTypes":[{"name":"Consultation","duration":30,"grid":30,"buffer":0,"needsConfirmation":false,"id":"a5be6ca2-d996-4737-a92c-99fafb1d481c"}],"busy":[{"startsAt":"2026-10-17T06:00:00.000Z","endsAt":"2026-10-17T06:30:00.000Z","heldUntil":"2026-10-17T06:30:00.000Z"},{"startsAt":"2026-10-17T07:00:00.000Z","endsAt":"2026-10-17T07:30:00.000Z","heldUntil":"2026-10-17T07:30:00.000Z","appointment":{"id":"aed94000-37e1-4d5f-9072-d4e99845d07a","patientId":"00000000-0000-4000-8000-00000000a006","appoin ...`
- `GET /practices/1f235636-8be0-4302-b456-a8796b65cc40/agenda` en tant que **demo-manager** : `200` `{"items":[{"id":"2424c221-de78-40f1-bce0-1de51371ef14","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","practiceId":"1f235636-8be0-4302-b456-a8796b65cc40","practitionerId":"00000000-0000-4000-8000-00000000a003","patientId":"00000000-0000-4000-8000-00000000a005","appointmentTypeId":"a5be6ca2-d996-4737-a92c-99fafb1d481c","startsAt":"2026-10-17T06:00:00.000Z","endsAt":"2026-10-17T06:30:00.000Z","day":"2026-10-17","status":"booked"},{"id":"aed94000-37e1-4d5f-9072-d4e99845d07a","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","practiceId":"1f235636-8be0-4302-b456-a8796b65cc40","practitionerId":"00000000-0000-4000-8000-00000000a003","patientId":"00000000-0000-4000-8000-00000000a006","appoin ...`

### 6. Moins de 24 heures avant : le patient ne peut plus annuler, le praticien le peut, avec une raison

- `POST /appointments` en tant que **demo-practitioner** : `201` `{"id":"d87e58d3-ee96-401e-8b9e-787b91e8bb83"}`
- `POST /appointments/d87e58d3-ee96-401e-8b9e-787b91e8bb83/cancellation` en tant que **demo-patient** : `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission scheduling:appointment.cancel is not granted","requestId":"d3392e6d-8b21-4ca5-923b-f6fa65675b5d"}`
- `POST /appointments/d87e58d3-ee96-401e-8b9e-787b91e8bb83/cancellation` en tant que **demo-practitioner** : `422` `{"type":"urn:problem:reason-required","title":"Unprocessable Content","status":422,"code":"REASON_REQUIRED","detail":"The practice gives a reason when it cancels an appointment.","requestId":"907b8cfd-7f50-43de-ad3c-00152ebf811b"}`
- `POST /appointments/d87e58d3-ee96-401e-8b9e-787b91e8bb83/cancellation` en tant que **demo-practitioner** : `201` `{"id":"d87e58d3-ee96-401e-8b9e-787b91e8bb83"}`

### 7. Les autres contextes ont suivi : notifications envoyées, chiffres mis à jour

- `GET /notifications` en tant que **demo-patient** : `200` `{"items":[{"id":"b7c55a31-eb0c-4ce6-8f5a-e116ccc04fdb","kind":"confirmation","appointmentId":"d87e58d3-ee96-401e-8b9e-787b91e8bb83","startsAt":"2026-10-10T09:00:00.000Z","sentAt":"2026-10-10T05:45:20.116Z"},{"id":"6bbb4bdc-fdf3-4bd1-a5a1-50025391810c","kind":"confirmation","appointmentId":"2424c221-de78-40f1-bce0-1de51371ef14","startsAt":"2026-10-17T06:00:00.000Z","sentAt":"2026-10-10T05:45:20.005Z"},{"id":"2d40af75-5210-4746-9d01-b899e1a70600","kind":"cancellation","appointmentId":"809c9b4b-9d96-4213-90f2-05ec884b0d8e","startsAt":"2026-10-10T09:00:00.000Z","sentAt":"2026-10-10T05:41:11.263Z"},{"id":"41b1ae41-2298-437a-9b42-ec8892790706","kind":"confirmation","appointmentId":"809c9b4b-9d96-4 ...`
- `GET /practices/1f235636-8be0-4302-b456-a8796b65cc40/occupancy` en tant que **demo-manager** : `200` `{"items":[{"id":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c.2026-10-10","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","day":"2026-10-10","heldMinutes":0,"appointmentsHeld":0,"completed":0,"noShows":0,"cancelledByPatient":0,"cancelledByPractice":1},{"id":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c.2026-10-17","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","day":"2026-10-17","heldMinutes":60,"appointmentsHeld":2,"completed":0,"noShows":0,"cancelledByPatient":0,"cancelledByPractice":0}],"total":2}`

### 8. Le support regarde au nom du patient, et ne peut pas écrire

`demo-support` prend l'identité de `demo-patient` dans Keycloak : le jeton est celui du patient, avec `impersonator_id` = 00000000-0000-4000-8000-00000000a008.

- `GET /appointments/2424c221-de78-40f1-bce0-1de51371ef14` en tant que **support-as-patient** : `200` `{"id":"2424c221-de78-40f1-bce0-1de51371ef14","calendarId":"8ec0b2b3-196a-45ba-920f-ab3713e2dd6c","practiceId":"1f235636-8be0-4302-b456-a8796b65cc40","practitionerId":"00000000-0000-4000-8000-00000000a003","patientId":"00000000-0000-4000-8000-00000000a005","appointmentTypeId":"a5be6ca2-d996-4737-a92c-99fafb1d481c","startsAt":"2026-10-17T06:00:00.000Z","endsAt":"2026-10-17T06:30:00.000Z","day":"2026-10-17","status":"booked","patientName":"Pia Patient"}`
- `POST /appointments/2424c221-de78-40f1-bce0-1de51371ef14/cancellation` en tant que **support-as-patient** : `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission CancelAppointmentCommand is not granted","requestId":"2e43c8a7-e6d9-4f7e-a3ce-89ace1ef81c2"}`

### 9. Le journal d'audit : qui a été autorisé, qui a été refusé, qui a regardé au nom de qui

- `GET /audit/entries` en tant que **demo-manager** : `403` `{"type":"urn:problem:forbidden","title":"Forbidden","status":403,"code":"FORBIDDEN","detail":"Permission audit:trail.read is not granted","requestId":"b79657dd-a153-48be-b949-db2346ea602b"}`
- `GET /audit/entries?outcome=denied&actorId=00000000-0000-4000-8000-00000000a007&limit=3` en tant que **demo-admin** : `200` `{"items":[{"id":"0afb7e92-294c-4896-aaef-3e56795e56bd","chain":"global","sequence":68,"occurredAt":"2026-10-10T05:41:11.046Z","category":"authorization","action":"scheduling:agenda.read","outcome":"denied","reason":"NO_RELATION","actorId":"00000000-0000-4000-8000-00000000a007","actorType":"user","resourceType":"practice","resourceId":"20026e9e-ba63-4cbf-b8d3-bd2d4a1084bf","context":"scheduling","correlationId":"e93c2b8e-3105-49be-8c72-f1a011713593","origin":"http","previousHash":"ecb1118f2798ce94b0b59466b104a36cd25f609618e7154011832a51d918a703","hash":"5e078d3bf225882a4bb76ebcc58d46b475eae9d270640a0b4b3bba40dea7c623"},{"id":"71615a41-c1ea-400b-b3db-30ced1b8c86f","chain":"global","sequence":6 ...`
- `GET /audit/entries?actorId=00000000-0000-4000-8000-00000000a005&limit=100` en tant que **demo-admin** : `200` `{"items":[{"id":"51d69071-8347-481c-b48c-86a5ae31b7d8","chain":"global","sequence":15,"occurredAt":"2026-10-10T05:41:10.624Z","category":"authorization","action":"identity:person.register","outcome":"allowed","actorId":"00000000-0000-4000-8000-00000000a005","actorType":"user","resourceType":"context","resourceId":"identity","context":"identity","correlationId":"4f0710f7-62f5-494d-8ff0-142fb5c05691","origin":"http","previousHash":"c0b977e893115d2f4892c5260e1e666fbedb13aac4d5cb1f273a4a05c48d7549","hash":"6f2139c565824aed43fbc5757b08189381e8214351120084c44ce37d57b6f880"},{"id":"f1e64721-3f03-4f59-90d6-b588cda446b7","chain":"global","sequence":17,"occurredAt":"2026-10-10T05:41:10.636Z","category ...`
Entrées du patient qui portent la personne qui a pris son identité, 00000000-0000-4000-8000-00000000a008 : 4, par exemple :

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


### 10. Une réservation, une trace, relue dans Jaeger

`GET http://127.0.0.1:54686/api/v3/traces/144a053238455edb659a6422e6e1e5a1` : 107 *spans* dans une seule trace, venus des processus scheduling (l'API et le *worker* forment un seul groupe de consommateurs : l'un ou l'autre peut prendre une livraison). Noms distincts :

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


### 11. Une défaillance inattendue atteint le système de suivi des erreurs avec l'identifiant de trace de sa requête HTTP

- `GET /notifications` en tant que **demo-patient** : `500` `{"type":"about:blank","title":"Internal Server Error","status":500,"code":"INTERNAL_ERROR","requestId":"942c262e-f314-4213-9983-45b2c3951640"}`
GlitchTip détient 1 événement de la trace 5e830714a9088cc4c7e91b5aa53d9e70 :

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

- `GET /notifications?limit=1` en tant que **demo-patient** : `200` `{"items":[{"id":"1c4c0cf1-f511-410d-a07f-b047152a4fdc","kind":"cancellation","appointmentId":"d87e58d3-ee96-401e-8b9e-787b91e8bb83","startsAt":"2026-10-10T09:00:00.000Z","sentAt":"2026-10-10T05:45:20.227Z"}],"total":6}`

Chaque étape a répondu comme prévu.

## Les *jobs* planifiés ont tourné dans le *worker*, pas dans l'API

Le journal du *worker* au premier passage d'une limite de cinq minutes (le journal de l'API ne
contient aucune ligne d'origine `schedule`) :

```text
{"level":"info","time":"2026-10-10T05:45:00.051Z","service":"scheduling-worker","environment":"development","job":"scheduling.expire-unconfirmed-appointments","context":"scheduling","outcome":"succeeded","scheduledAt":"2026-10-10T05:45:00.000Z","durationMs":43,"correlationId":"3fca9e9a-dbf2-44f8-8e8e-d8a4fff8e3ee","message":"Sch
{"level":"info","time":"2026-10-10T05:45:00.057Z","service":"scheduling-worker","environment":"development","job":"identity.expire-delegations","context":"identity","outcome":"succeeded","scheduledAt":"2026-10-10T05:45:00.000Z","durationMs":53,"correlationId":"2084920b-1393-4519-b9f2-c6ca9294d3eb","message":"Scheduled job succee
{"level":"info","time":"2026-10-10T05:45:00.063Z","service":"scheduling-worker","environment":"development","job":"notification.send-due-reminders","context":"notification","outcome":"succeeded","scheduledAt":"2026-10-10T05:45:00.000Z","durationMs":56,"correlationId":"76c42bc3-52aa-4108-805d-1bc72359a913","message":"Scheduled jo
```

## Ce que l'exécution a montré et que les tests n'avaient pas montré

- Les modèles de lecture écrits deux fois sur une même clé échouaient avec la vraie horloge
  jusqu'au contournement de `src/shared-kernel/storable-stamp.ts` (un défaut de `@ddd-ts-kit/knex`,
  voir `docs/tooling-report.md`).
- Un refus par une politique répond `403 FORBIDDEN` en nommant la permission ; le code de raison
  propre à la politique n'atteint pas le corps HTTP (le format *problem* du kit n'a pas de membre
  pour lui).
- La décision enregistrée pour l'annulation sous identité empruntée est `allowed` (le patient peut
  annuler son rendez-vous) ; le refus qui suit vient de la règle de lecture seule des sessions sous
  identité empruntée et est enregistré comme la commande en échec.
- Les consommateurs tournent dans les deux processus comme un seul groupe de consommateurs : une
  livraison est prise par l'API ou par le *worker*, dans la même trace dans les deux cas.

## Arrêter

```bash
kill %1 %2
docker compose --profile identity --profile observability --profile errors down --volumes
```

## Nouvelle exécution après le passage d'analytics au calcul à la lecture

Une seconde exécution réelle de `scripts/demo.mjs`, le 2026-10-10, après le retrait de l'occupation
stockée : les mêmes commandes sur une base de données vide, avec les profils `identity` et
`observability` seulement (pas de GlitchTip, donc l'étape 11 a répondu "SENTRY_DSN is not set:
skipped."). Toutes les autres étapes ont répondu comme prévu. Deux étapes diffèrent par ce qui les
sert, pas par ce que lit un client.

Étape 7, l'occupation, désormais une seule instruction groupée sur les issues. La même forme et les
mêmes chiffres que plus haut pour le même scénario (les identifiants sont ceux de cette exécution) :

- `GET /practices/f6fe6079-0b05-4855-a9e3-ae518ed15a45/occupancy` en tant que **demo-manager** : `200` `{"items":[{"id":"767d0ef7-879d-400b-bc38-f0aa4ef4f3a5.2026-10-10","calendarId":"767d0ef7-879d-400b-bc38-f0aa4ef4f3a5","day":"2026-10-10","heldMinutes":0,"appointmentsHeld":0,"completed":0,"noShows":0,"cancelledByPatient":0,"cancelledByPractice":1},{"id":"767d0ef7-879d-400b-bc38-f0aa4ef4f3a5.2026-10-17","calendarId":"767d0ef7-879d-400b-bc38-f0aa4ef4f3a5","day":"2026-10-17","heldMinutes":60,"appointmentsHeld":2,"completed":0,"noShows":0,"cancelledByPatient":0,"cancelledByPractice":0}],"total":2}`

Étape 10, la trace de la réservation. `analytics` est un seul consommateur, qui écrit l'issue ; il
n'y a plus de `process analytics.occupancy`, ni de `OutcomeRegister.get` ou `.list`, ni
d'`OccupancyRegister` :

`GET http://127.0.0.1:54686/api/v3/traces/bf1d9dd666a392d44302b8d55771b7db` : 92 *spans* dans une seule trace, venus des processus scheduling (l'API et le *worker* forment un seul groupe de consommateurs : l'un ou l'autre peut prendre une livraison). Noms distincts :

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
