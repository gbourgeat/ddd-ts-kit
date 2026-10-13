[English](scheduling-calendar.md) · **Français**
<!-- translation-of: scheduling-calendar.md sha256:217ce51ad1451f27 -->

# Consigne : scheduling, calendriers et liste d'attente

Vous construisez la moitié du contexte délimité `scheduling` (le cœur). Nom du *worker* :
`scheduling-calendar`. Un autre *worker*, `scheduling-appointment`, construit l'autre moitié dans
le même dossier au même moment.

Périmètre
- Vous possédez : les agrégats `Calendar` et `Waitlist` avec leurs objets-valeurs, *repositories*,
  *builders* et tables ; la projection des praticiens ; les commandes, requêtes et routes des lignes
  18, 19, 20, 28, 29 ; le port `SchedulingRelationships` et son adaptateur (ligne 21 : vous les
  créez avec la méthode des calendriers ; l'autre *worker* ajoute la méthode des rendez-vous).
- Vous ne touchez pas : `Appointment`, le `Scheduler`, les commandes des rendez-vous, la projection
  de l'agenda, les politiques. Fichiers partagés du contexte (`scheduling.permissions.ts`,
  `create-scheduling-tables.schema.ts`, `scheduling.schema.ts`, `scheduling.routes.ts`,
  `CONTEXT.md`) : les générateurs les écrivent ; quand vous en modifiez un à la main, relisez-le juste
  avant et ne changez que vos lignes.
- Générateurs que vous pouvez lancer : value-object, entity, domain-event, error, domain-service,
  command, query, route, port, adapter, event-handler, builder, e2e.

La jonction avec `scheduling-appointment`, fixée : ils génèrent l'objet-valeur `Slot` en premier
(`Slot.between(startsAt, endsAt, heldUntil)` : début, fin du rendez-vous, fin de ce qu'il occupe
avec le battement ; `overlaps(other)`). Vous fournissez sur `Calendar`, aussi tôt que vous le
pouvez, même avant que les règles qui sont derrière soient complètes :
`slotFor(appointmentTypeId: string, startsAt: Date, now: Date): Slot` (lève les erreurs de
disponibilité de la règle 22 : `OUTSIDE_AVAILABILITY`, `OFF_GRID`, `BOOKING_TOO_LATE`,
`BOOKING_TOO_FAR`, `UNKNOWN_APPOINTMENT_TYPE`), `confirmationDeadlineFor(appointmentTypeId, now): Date | undefined`
(défini quand le type demande une confirmation), et les accesseurs `practiceId`, `practitionerId`,
`limit` (les rendez-vous futurs qu'un patient peut détenir), `timeZone` (un objet-valeur avec
`dayOf(instant): string`, `YYYY-MM-DD` à l'horloge murale du cabinet, écrit sans aucune
bibliothèque : `Intl.DateTimeFormat` suffit). Ne leur dites rien d'autre : ils lisent votre
agrégat. Pour la ligne 29, vous avez besoin de leur fabrique `Appointment.request(...)` : faites
cette ligne en dernier.

Tranches, dans cet ordre : 18, 19, 21 (partie calendrier), 20, 28, 29. Les projections n'ont pas de
générateur : écrivez `application/projections/<name>.projection.ts` d'après le README de
`@ddd-ts-kit/kernel` (« Projections ») et de `@ddd-ts-kit/knex` (« Read models »), et rapportez ce
qu'en dit le *checker*. La ligne 28 lit le modèle de lecture de l'agenda que `scheduling-appointment`
construit à la ligne 26 : ne vous accordez sur rien, lisez leur port quand il existe ; s'il n'existe
pas encore quand vous y arrivez, faites d'abord la 29.

Terminé quand : vos lignes sont construites et testées (jours de changement d'heure
d'Europe/Paris compris pour les disponibilités), aucun marqueur ne reste dans vos fichiers, eslint,
vitest et check sont propres sur vos fichiers. Suivez `docs/architecture/briefings/README.md` pour
les règles communes et le rapport.
