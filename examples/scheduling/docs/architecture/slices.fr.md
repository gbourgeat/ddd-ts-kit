[English](slices.md) · **Français**
<!-- translation-of: slices.md sha256:4b7ddc92f1b67614 -->

# Tranches

La colonne « Commencer par » contient des commandes du générateur sans leur lanceur : dans cet
exemple, elles sont exécutées avec `node scripts/gen.mjs <command>` (le
`npx ddd-ts-kit generate <command> --json` du kit, mesuré). Un cas d'usage dont les mots ne sont pas encore dans le glossaire les ajoute avec
`--term "<Term>=<meaning>"`. Responsables : `conductor` (le chef d'orchestre), `platform`, ou le
*worker* d'un contexte (scheduling en a deux : `scheduling-calendar` et `scheduling-appointment`,
sur des agrégats différents).

| # | Contexte | Type | Tranche | Commencer par | Dépend de | Responsable | Statut |
|---|---|---|---|---|---|---|---|
| 1 | scheduling | skeleton | Calendar, Appointment, Waitlist | `aggregate scheduling <Name>` puis `repository scheduling <Name>`, trois fois | | conductor | done |
| 2 | identity | skeleton | Person, Practice, Delegation | `aggregate identity <Name>` puis `repository identity <Name>`, trois fois | | conductor | done |
| 3 | notification | skeleton | Notification, Reminder | `aggregate notification <Name>` puis `repository notification <Name>`, deux fois | | conductor | done |
| 4 | identity | contract | Personne enregistrée, Cabinet ouvert, Membre ajouté, Membre retiré, Délégation accordée, Délégation révoquée | `integration-event identity Person Registered`, `... Practice Opened`, `... Practice MemberAdded`, `... Practice MemberRemoved`, `... Delegation Granted`, `... Delegation Revoked` | 2 | conductor | done |
| 5 | scheduling | contract | Calendrier créé ; Rendez-vous réservé, confirmé, déplacé, annulé, expiré, terminé, marqué en absence | `integration-event scheduling Calendar Created`, `integration-event scheduling Appointment <Fact>` sept fois | 1 | conductor | done |
| 6 | identity | contract | Annuaire des personnes (contrat de lecture) | `gateway scheduling identity PersonDirectory` | 2 | conductor | done |
| 7 | scheduling | contract | Export des rendez-vous (contrat de lecture, source d'une reconstruction) | `gateway analytics scheduling AppointmentExport` | 1 | conductor | done |
| 8 | scheduling | skeleton | Politiques du préavis du patient | `policy scheduling PatientCancelsUntilNotice --permission appointment.cancel`, `policy scheduling PatientReschedulesUntilNotice --permission appointment.reschedule` | 1 | conductor | done |
| 9 | all | skeleton | Le travail déclenché par le temps | `command scheduling ExpireUnconfirmedAppointments --aggregate Appointment --permission appointment.expire` et `job scheduling ExpireUnconfirmedAppointments --every 5m --command ExpireUnconfirmedAppointments` ; la même paire pour `identity ExpireDelegations` (5m), `notification SendDueReminders` (15m), `analytics VerifyOccupancy` (cron `0 3 * * *`, Europe/Paris ; retiré après la livraison, voir la note de 37) | 1, 2, 3 | conductor | done |
| 10 | platform | skeleton | Tuples de relation persistants, schéma des relations, rôles combinés aux relations, prise d'identité en lecture seule | à la main dans `src/platform/auth/` (aucun générateur) et `adr "Combine token roles with relationships in one authorizer"` | | platform | todo |
| 11 | identity | slice | Enregistrer une personne | `command identity RegisterPerson --aggregate Person --permission person.register` ; `route identity RegisterPerson --method PUT --path /people/me` | 2, 4 | identity | todo |
| 12 | identity | slice | Ouvrir un cabinet | `command identity OpenPractice --aggregate Practice --permission practice.open` ; `route identity OpenPractice --method POST --path /practices` | 2, 4 | identity | todo |
| 13 | identity | slice | Ajouter un membre, retirer un membre | `command identity AddMember --aggregate Practice --permission member.add` ; `route ... --method POST --path /practices/:practiceId/members` ; `command identity RemoveMember --aggregate Practice --permission member.remove` ; `route ... --method DELETE --path /practices/:practiceId/members/:personId` | 12 | identity | todo |
| 14 | identity | slice | Accorder une délégation, révoquer une délégation | `command identity GrantDelegation --aggregate Delegation --permission delegation.grant` ; `route ... --method POST --path /practices/:practiceId/desks/:practitionerId/delegations` ; `command identity RevokeDelegation --aggregate Delegation --permission delegation.revoke` ; `route ... --method DELETE --path /practices/:practiceId/desks/:practitionerId/delegations/:delegationId` | 13 | identity | todo |
| 15 | identity | slice | Faire expirer les délégations (*job* de la ligne 9) | remplir `ExpireDelegations` | 14 | identity | todo |
| 16 | identity | slice | Les relations suivent les adhésions et les délégations | `port identity IdentityRelationships` ; `adapter identity IdentityRelationships` ; `event-handler identity Practice MemberAdded`, `... Practice MemberRemoved`, `... Delegation Granted`, `... Delegation Revoked`, `... Person Registered` | 10, 13, 14 | identity | todo |
| 17 | identity | slice | Répondre à l'annuaire des personnes | implémenter `PersonDirectoryContract` du langage publié | 6, 11 | identity | todo |
| 18 | scheduling | slice | Les praticiens connus d'identity (projection) | `integration-handler` n'est pas utilisé : une `@Projection` dans `application/projections/` sur `identity.practice.member-added` et `.member-removed` | 4 | scheduling-calendar | todo |
| 19 | scheduling | slice | Créer un calendrier (squelette ambulant du cœur) | `command scheduling CreateCalendar --aggregate Calendar --permission calendar.create` ; `route scheduling CreateCalendar --method POST --path /calendars` | 1, 5, 18 | scheduling-calendar | todo |
| 20 | scheduling | slice | Fixer les horaires d'ouverture, ajouter une exception, ajouter une indisponibilité, définir un type de rendez-vous | `command scheduling SetOpeningHours --aggregate Calendar --permission calendar.set-opening-hours` et sa route `PUT /calendars/:calendarId/opening-hours` ; `AddException` (`POST /calendars/:calendarId/exceptions`) ; `AddTimeOff` (`POST /calendars/:calendarId/time-off`) ; `DefineAppointmentType` (`POST /calendars/:calendarId/appointment-types`) ; objets-valeurs `TimeZone`, `Range`, `OpeningHours`, `Exception`, `TimeOff`, `AppointmentType`, `BookingWindow`, `Slot` | 19 | scheduling-calendar | todo |
| 21 | scheduling | slice | Les relations suivent les calendriers et les rendez-vous | `port scheduling SchedulingRelationships` ; `adapter scheduling SchedulingRelationships` ; `event-handler scheduling Calendar Created` ; `event-handler scheduling Appointment Booked` | 10, 19 | scheduling-calendar (calendrier), scheduling-appointment (rendez-vous) | todo |
| 22 | scheduling | slice | Réserver un rendez-vous (avec le Scheduler) | `domain-service scheduling Scheduler` ; `command scheduling BookAppointment --aggregate Appointment --permission appointment.book` ; `route scheduling BookAppointment --method POST --path /appointments` | 20 | scheduling-appointment | todo |
| 23 | scheduling | slice | Exactement une réservation sur deux concurrentes | contrainte d'exclusion dans la table des rendez-vous ; *spec* d'intégration avec deux transactions concurrentes | 22 | scheduling-appointment | todo |
| 24 | scheduling | slice | Confirmer, annuler, déplacer | `command scheduling ConfirmAppointment --aggregate Appointment --permission appointment.confirm` (`POST /appointments/:appointmentId/confirmation`) ; `CancelAppointment` (`POST /appointments/:appointmentId/cancellation`) ; `RescheduleAppointment` (`POST /appointments/:appointmentId/reschedule`) ; politiques de la ligne 8 | 22 | scheduling-appointment | todo |
| 25 | scheduling | slice | Terminer, marquer une absence, faire expirer les non confirmés | `command scheduling CompleteAppointment --aggregate Appointment --permission appointment.complete` (`POST /appointments/:appointmentId/completion`) ; `MarkAppointmentNoShow --permission appointment.mark-no-show` (`POST /appointments/:appointmentId/no-show`) ; remplir `ExpireUnconfirmedAppointments` | 22 | scheduling-appointment | todo |
| 26 | scheduling | slice | Modèle de lecture de l'agenda (projection des propres événements du contexte) et ses recherches | `@Projection` dans `application/projections/` ; `query scheduling SearchAppointments --permission appointment.search --search` (`GET /appointments`) ; `query scheduling SearchPracticeAgenda --permission agenda.read --search` (`GET /practices/:practiceId/agenda`) | 22 | scheduling-appointment | todo |
| 27 | scheduling | slice | Détail d'un rendez-vous, hydraté avec le nom du patient | `query scheduling GetAppointment --permission appointment.read` (`GET /appointments/:appointmentId`) ; remplir la *gateway* de la ligne 6 | 6, 22 | scheduling-appointment | todo |
| 28 | scheduling | slice | Jour d'un calendrier, vue partagée (occupé sans le nom) | `query scheduling GetCalendarDay --permission calendar.browse` (`GET /calendars/:calendarId/days/:day`) | 20, 26 | scheduling-calendar | todo |
| 29 | scheduling | slice | Liste d'attente : la rejoindre, proposer un créneau libéré, la réservation provisoire expire | `command scheduling JoinWaitlist --aggregate Waitlist --permission waitlist.join` (`POST /calendars/:calendarId/waitlist`) ; `command scheduling OfferFreedSlot --aggregate Waitlist --permission waitlist.offer` ; `event-handler scheduling Appointment Cancelled`, `... Appointment Expired`, `... Appointment Rescheduled` | 24, 25 | scheduling-calendar | todo |
| 30 | scheduling | slice | Répondre à l'export des rendez-vous | implémenter `AppointmentExportContract` du langage publié | 7, 26 | scheduling-appointment | todo |
| 31 | notification | slice | Les coordonnées connues d'identity (projection) | `@Projection` sur `identity.person.registered` | 4 | notification | todo |
| 32 | notification | slice | Envoyer une notification pour un fait d'un rendez-vous | `port notification Mailer` ; `adapter notification Mailer --kind external --decorators` ; `command notification SendNotification --aggregate Notification --permission notification.send` ; `integration-handler notification scheduling scheduling.appointment.booked`, `.confirmed`, `.rescheduled`, `.cancelled` | 3, 5, 31 | notification | todo |
| 33 | notification | slice | Planifier, retirer et envoyer les rappels | `command notification PlanReminder --aggregate Reminder --permission reminder.plan` ; `command notification WithdrawReminder --aggregate Reminder --permission reminder.withdraw` ; consommateurs de booked, rescheduled, cancelled, expired ; remplir `SendDueReminders` | 32 | notification | todo |
| 34 | notification | slice | Les notifications envoyées à une personne | `query notification SearchNotifications --permission notification.read --search` (`GET /notifications`) | 32 | notification | todo |
| 35 | analytics | slice | Issues des rendez-vous (projection) et occupation par jour (la projection de l'occupation a été remplacée après la livraison, voir la note de 35) | deux modèles de lecture `@Projection` sur les événements de la ligne 5 ; `port analytics ...` selon les besoins | 5 | analytics | todo |
| 36 | analytics | slice | Lire l'occupation | `query analytics SearchOccupancy --permission occupancy.read --search` (`GET /practices/:practiceId/occupancy`) | 35 | analytics | todo |
| 37 | analytics | slice | Vérifier l'occupation chaque nuit (remplacé après la livraison, voir la note de 37) ; reconstruire les issues à partir de scheduling | remplir `VerifyOccupancy` ; remplir la *gateway* de la ligne 7 ; une *spec* qui exécute `ProjectionRebuild` | 7, 35 | analytics | todo |
| 38 | all | slice | Une réservation, une trace, à travers le *worker* | `worker` ; *spec* de bout en bout qui vérifie l'arbre des *spans*, les champs des journaux, les entrées d'audit, le rapport d'erreur | 22, 32, 35 | conductor | todo |
| 39 | all | slice | Exécution réelle | `docker compose`, `scripts/demo.sh` | 38 | conductor | todo |

## Les règles de chaque tranche

- 11 : une personne s'enregistre elle-même : l'identifiant de la personne est celui de l'acteur ; s'enregistrer deux fois met à jour le nom et les coordonnées et n'annonce rien de nouveau.
- 12 : seul l'administrateur du réseau ouvre un cabinet, dans ce réseau (ADR-0003) ; le fuseau horaire est un fuseau IANA ; le premier responsable doit être une personne enregistrée ; un fuseau inconnu est refusé (`UNKNOWN_TIME_ZONE`).
- 13 : un membre est une personne enregistrée avec un rôle par cabinet (responsable, praticien, assistant) ; ajouter deux fois est refusé (`ALREADY_MEMBER`) ; le dernier responsable ne peut pas être retiré (`LAST_MANAGER`) ; retirer un membre révoque ses délégations, données et reçues (cause `member-removed`).
- 14 : le praticien et l'assistant sont des membres du cabinet avec ces rôles (`NOT_A_PRACTITIONER`, `NOT_AN_ASSISTANT`) ; une fin dans le passé est refusée (`DELEGATION_ENDS_IN_THE_PAST`) ; une délégation active par paire ; révoquer deux fois est refusé (`DELEGATION_NOT_ACTIVE`) ; la délégation doit appartenir au poste du chemin.
- 15 : idempotent ; l'instant vient du `scheduledAt` du *job*.
- 16 : des tuples, dans l'unité de travail de la commande : `practice:<id>#<role>@user:<person>` ; pour un praticien `desk:<practice>.<person>#holder@user:<person>` et `desk:...#practice@practice:<id>` ; pour une délégation `desk:<practice>.<practitioner>#delegate@user:<assistant>` et, quand les disponibilités sont comprises, `#availability_delegate` ; `person:<id>#self@user:<id>`. Retirés quand le fait prend fin.
- 19 : le praticien doit être connu dans le cabinet (`UNKNOWN_PRACTITIONER`) ; le calendrier prend le fuseau horaire du cabinet ; valeurs par défaut : préavis 2 h, horizon 90 jours, limite 3.
- 20 : les plages d'un jour ne se chevauchent pas et finissent après avoir commencé (`INVALID_RANGE`) ; une exception remplace son jour ; une indisponibilité qui couvre un rendez-vous actif est refusée (`TIME_OFF_OVER_APPOINTMENTS`) ; la durée et la grille sont des minutes positives, la grille divise 24 h.
- 22 : créneau sur la grille de son type, dans une seule plage d'ouverture de son jour en heure murale du cabinet (jours de changement d'heure testés en Europe/Paris), pas dans une indisponibilité, dans la fenêtre de réservation (`OUTSIDE_AVAILABILITY`, `OFF_GRID`, `BOOKING_TOO_LATE`, `BOOKING_TOO_FAR`) ; aucun chevauchement avec un rendez-vous actif, battement compris (`SLOT_TAKEN`, répondu 409) ; au plus N rendez-vous futurs actifs de ce patient avec ce praticien (`PATIENT_LIMIT_REACHED`) ; un type qui demande une confirmation donne un rendez-vous demandé avec une échéance.
- 23 : la contrainte d'exclusion de PostgreSQL tranche entre deux transactions concurrentes ; la perdante reçoit `SLOT_TAKEN` (409), pas une 500.
- 24 : un patient annule ou déplace jusqu'à 24 h avant le début (politiques ; le code du refus est le nom de la politique) ; le cabinet annule à tout moment avec un motif (`REASON_REQUIRED`) ; déplacer est un seul changement d'agrégat, contrôlé comme une réservation, le rendez-vous étant ignoré dans son propre contrôle de chevauchement ; un rendez-vous fini ne change plus (`APPOINTMENT_ENDED`).
- 25 : terminé et absence seulement après le début (`APPOINTMENT_NOT_STARTED`) ; l'expiration est idempotente et prend son instant de `scheduledAt`.
- 26 à 28 : les recherches sont restreintes dans la requête SQL par le périmètre d'accès, paginées et filtrées avec les critères du kit (`filter[...]`, `sort`) ; l'agenda d'un cabinet est refusé à qui n'est pas membre de ce cabinet et restreint aux calendriers que l'acteur tient (`run`) ; dans la vue du jour, un créneau occupé que l'acteur n'a pas le droit de lire s'affiche comme occupé sans le patient.
- 29 : une liste d'attente par calendrier et par jour, ordre d'arrivée, une personne en attente une seule fois ; un créneau libéré va à la première personne en attente dont le type lui convient, comme un rendez-vous demandé retenu 30 minutes ; quand il expire, la personne suivante.
- 32 : une notification par événement consommé et par destinataire (idempotente par identifiant d'événement) ; le *mailer* fait l'objet de nouvelles tentatives, puis l'événement part en file de rejet et est signalé.
- 33 : un rappel par rendez-vous et par début, dû 24 h avant ; un rendez-vous déplacé en reçoit un nouveau ; l'envoi est idempotent par occurrence.
- 35 : une issue porte l'état qu'elle pose (les rejeux et les livraisons dans le désordre aboutissent à la même ligne) ; l'occupation d'un calendrier et d'un jour est recalculée à partir des issues.
- 35, remplacée après la livraison (2026-10-10, *product owner*) : le second modèle de lecture, une ligne stockée par calendrier et par jour recomptée à chaque événement, a disparu. Une ligne par fait, calculée à la lecture : les issues sont la seule chose stockée, et `SearchOccupancy` les mesure dans une seule requête SQL groupée par le port `OccupancyReader`. Raison : un chiffre stocké demandait un traitement particulier des événements dans le désordre et une réparation nocturne, tout cela pour garder une copie égale à ce que les issues disent déjà.
- 37, remplacée en partie après la livraison (2026-10-10, *product owner*) : `VerifyOccupancy`, son *job* `analytics.verify-occupancy`, sa permission `occupancy.verify` et l'octroi à son acteur système sont retirés. Raison : ils existaient pour réparer les chiffres stockés de la ligne 35, et plus rien n'est stocké. La reconstruction des issues à partir de l'export de `scheduling` reste.
- 36 : restreinte aux calendriers que l'acteur mesure (le responsable du cabinet : tous ; un praticien : les siens) ; un autre cabinet est refusé.

## Les permissions et l'élément sur lequel elles portent

Chaque commande et chaque requête nomme sa permission et, dans son `@Requires(..., { resource })`,
l'élément sur lequel porte le droit, tel que le schéma des relations de `src/platform/auth/` le
connaît. Une permission absente de cette liste est réservée aux acteurs système (*jobs* et
consommateurs : ressource `{ type: 'context', id: '<context>' }`, telle que générée).

| Permission | Ressource de l'exigence | Qui la détient |
|---|---|---|
| `identity:person.register` | contexte (valeur par défaut générée) | toute personne connectée (jeton) |
| `identity:practice.open` | contexte | rôle `network-admin` (jeton) |
| `identity:member.add`, `identity:member.remove` | `practice:<practiceId>` | les responsables du cabinet |
| `identity:delegation.grant`, `identity:delegation.revoke` | `desk:<practiceId>.<practitionerId>` | le praticien du poste, les responsables du cabinet |
| `scheduling:calendar.create` | `desk:<practiceId>.<practitionerId>` | le praticien du poste, les responsables du cabinet |
| `scheduling:calendar.set-opening-hours`, `.add-exception`, `.add-time-off`, `.define-appointment-type` | `calendar:<calendarId>` | le praticien, les délégués dont la délégation comprend les disponibilités, les responsables |
| `scheduling:calendar.browse` | `calendar:<calendarId>` | toute personne connectée (jeton) ; ce qu'elle voit de chaque créneau dépend de `appointment.read` |
| `scheduling:appointment.book`, `scheduling:waitlist.join` | `calendar:<calendarId>`, avec `context: { selfService: <the patient is the actor> }` | rôle `patient` (jeton) pour soi-même ; le praticien, les délégués et les responsables pour n'importe qui |
| `scheduling:appointment.read` | `appointment:<appointmentId>` | le patient du rendez-vous ; qui tient son calendrier (`run`) |
| `scheduling:appointment.confirm`, `.cancel`, `.reschedule` | `appointment:<appointmentId>` | les mêmes, puis les politiques du préavis du patient |
| `scheduling:appointment.complete`, `.mark-no-show` | `appointment:<appointmentId>` | qui tient son calendrier (`run`) |
| `scheduling:appointment.search` | contexte | toute personne connectée ; la recherche est restreinte par `Access.scope(actor, appointment.read, 'appointment')` |
| `scheduling:agenda.read` | `practice:<practiceId>` | les membres du cabinet ; restreint par `Access.scope(actor, agenda.read, 'calendar')` aux calendriers qu'ils tiennent (`run`) |
| `notification:notification.read` | contexte | toute personne connectée ; restreint par `Access.scope(actor, notification.read, 'person')` à elle-même |
| `analytics:occupancy.read` | `practice:<practiceId>` | les membres du cabinet ; restreint par `Access.scope(actor, occupancy.read, 'calendar')` aux calendriers qu'ils mesurent (les leurs ; tous pour un responsable) |
| `audit:trail.read` | (plateforme) | rôle `platform-admin`, lu par une élévation sur les réseaux |

Les relations écrites par les contextes (par un port à eux, dans l'unité de travail de la
commande, jamais par le domaine) : voir la règle 16 pour `identity` ; `scheduling` écrit
`calendar:<id>#desk@desk:<practiceId>.<practitionerId>`, `calendar:<id>#practice@practice:<practiceId>`,
`appointment:<id>#patient@user:<patientId>` et `appointment:<id>#calendar@calendar:<calendarId>`.
