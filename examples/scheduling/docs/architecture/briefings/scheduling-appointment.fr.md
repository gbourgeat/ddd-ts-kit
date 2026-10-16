[English](scheduling-appointment.md) · **Français**
<!-- translation-of: scheduling-appointment.md sha256:a5180cf11e52076b -->

# Consigne : scheduling, rendez-vous

Vous construisez la moitié du contexte délimité `scheduling` (le cœur). Nom du *worker* :
`scheduling-appointment`. Un autre *worker*, `scheduling-calendar`, construit l'autre moitié dans
le même dossier au même moment.

Périmètre
- Vous possédez : l'agrégat `Appointment` avec ses objets-valeurs, son *repository*, son *builder*
  et sa table ; le service du domaine `Scheduler` ; les deux politiques du préavis du patient ; les
  commandes, requêtes et routes des lignes M1.22 à M1.27 et M1.30 ; la projection de l'agenda ; la *gateway*
  vers l'annuaire des personnes ; l'implémentation d'`AppointmentExportContract` ; la méthode des
  rendez-vous du port `SchedulingRelationships` (ligne M1.21 : `scheduling-calendar` crée le port et
  son adaptateur, vous ajoutez la vôtre ; s'il n'existe pas encore quand vous en avez besoin,
  créez-le avec le générateur et ne leur dites rien : ils le liront).
- Vous ne touchez pas : `Calendar`, `Waitlist`, leurs objets-valeurs, la projection des praticiens.
  Fichiers partagés du contexte (`scheduling.permissions.ts`, `create-scheduling-tables.schema.ts`,
  `scheduling.schema.ts`, `scheduling.routes.ts`, `CONTEXT.md`) : les générateurs les écrivent ;
  quand vous en modifiez un à la main, relisez-le juste avant et ne changez que vos lignes.
- Générateurs que vous pouvez lancer : value-object, entity, domain-event, error, domain-service,
  command, query, route, port, adapter, event-handler, builder, e2e.

La jonction avec `scheduling-calendar`, fixée : générez l'objet-valeur `Slot` EN PREMIER
(`Slot.between(startsAt, endsAt, heldUntil)` : début, fin du rendez-vous, fin de ce qu'il occupe
avec le battement ; `overlaps(other)` compare ce qui est occupé). Ils fournissent sur `Calendar` :
`slotFor(appointmentTypeId, startsAt, now): Slot` (lève les erreurs de disponibilité de la règle
M1.22), `confirmationDeadlineFor(appointmentTypeId, now): Date | undefined`, et les accesseurs
`practiceId`, `practitionerId`, `limit`, `timeZone.dayOf(instant)`. Construisez d'abord la vie d'un
rendez-vous (elle n'a besoin que de `Slot`), puis la réservation et le déplacement une fois que
`Calendar.slotFor` existe. Ils ont besoin de vous, pour la liste d'attente : une fabrique (factory)
qui donne un rendez-vous demandé avec une échéance.

Tranches, dans cet ordre : l'agrégat avec toute sa vie (lignes M1.22, M1.24, M1.25 au niveau du domaine),
M1.22, M1.23, M1.21 (partie rendez-vous), M1.24, M1.25, M1.26, M1.27, M1.30. La ligne M1.23 est tout l'intérêt de l'exemple :
une contrainte d'exclusion de PostgreSQL sur le calendrier et l'intervalle occupé des rendez-vous
actifs (l'extension `btree_gist` ; le *worker* de la plateforme la charge dans le PostgreSQL en
processus des tests), l'adaptateur qui traduit cette violation en l'erreur du domaine
`SLOT_TAKEN`, la route qui répond 409, et une *spec* d'intégration qui envoie deux réservations
d'un même créneau à la fois et en voit exactement une gagner. Avec `DATABASE_URL` défini, les
*specs* tournent sur un vrai serveur, où les deux transactions sont vraiment concurrentes ; en
processus, elles sont sérialisées par la session unique : écrivez la *spec* de sorte qu'elle soit
vraie dans les deux cas. Lisez `/home/gbourgeat/ddd-ts-kit/packages/redis/README.md` sur la raison
pour laquelle le verrou n'est pas la garde, et dites-le dans un commentaire là où la contrainte est
déclarée. Les projections n'ont pas de générateur : écrivez
`application/projections/<name>.projection.ts` d'après le README de `@ddd-ts-kit/kernel`
(« Projections », « Criteria », « Hydration ») et de `@ddd-ts-kit/knex` (« Read models »,
« Criteria »), et rapportez ce qu'en dit le *checker*. Les listes prennent les critères du kit
(`filter[...]`, `sort`) et le périmètre d'accès, comme le montrent ces README ;
`generate query --search` écrit une forme plus simple : adaptez-la et rapportez ce que vous avez dû
changer.

Terminé quand : vos lignes sont construites et testées, aucun marqueur ne reste dans vos fichiers,
eslint, vitest et check sont propres sur vos fichiers. Suivez `docs/architecture/briefings/README.md`
pour les règles communes et le rapport.
