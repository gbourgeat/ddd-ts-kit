[English](analytics.md) · **Français**
<!-- translation-of: analytics.md sha256:a23c87e74719e420 -->

# Consigne : analytics

> Gardée telle qu'elle a été donnée. Après la livraison (2026-10-10), le propriétaire a remplacé une
> partie de ce qu'elle demande : le modèle de lecture de l'occupation et `VerifyOccupancy` ont
> disparu, l'occupation est mesurée à partir des issues au moment où on la lit. Voir
> `../slices.md`, notes de 35 et 37.

Vous construisez le contexte délimité `analytics` de l'exemple scheduling. Nom du *worker* : `analytics`.

Périmètre
- Vous pouvez écrire : `src/contexts/analytics/**` et `test/e2e/analytics-*.e2e.spec.ts`.
- Générateurs que vous pouvez lancer : value-object, entity, domain-event, error, domain-service,
  command, query, route, port, adapter, event-handler, integration-handler, builder, e2e.

Tranches, dans cet ordre (lignes de `docs/architecture/slices.md`, règles sous son tableau) : 35,
36, 37. `VerifyOccupancy` et son *job* existent, non remplis ; la *gateway*
`AppointmentExportGateway` existe, non remplie, sur le contrat de lecture
`src/contexts/scheduling/published-language/appointment-export.contract.ts`.

Contrats que vous consommez (en lecture seule) : `src/contexts/scheduling/published-language/*`.

Particularités : ce contexte est un côté lecture, sans agrégat. Deux modèles de lecture, tous deux
des `ReadModelStore` écrits par des classes `@Projection` (pas de générateur : écrivez
`application/projections/<name>.projection.ts` d'après le README de `@ddd-ts-kit/kernel`,
« Projections », « Criteria », et de `@ddd-ts-kit/knex`, « Read models », « Criteria » ; rapportez
ce qu'en dit le *checker*) : l'issue de chaque rendez-vous (une ligne par rendez-vous, chaque
événement fixe l'état : occupé, terminé, absence, annulé par le patient, annulé par le cabinet,
expiré), et l'occupation d'un calendrier sur une journée (minutes occupées, rendez-vous occupés,
terminés, absences, annulations par partie), recalculée à partir des issues chaque fois que l'une
d'elles change. `SearchOccupancy` est une liste avec les critères du kit (`filter[calendarId]`,
`filter[day]` avec un intervalle, `sort`), paginée et restreinte par le périmètre d'accès
(`generate query --search` écrit une forme plus simple : adaptez-la et rapportez ce que vous avez
dû changer). `VerifyOccupancy` recalcule les jours de la dernière semaine à partir des issues et
corrige les écarts, de façon idempotente, à partir du `scheduledAt` du *job*. Une *spec*
d'intégration lance `ProjectionRebuild` sur le modèle de lecture des issues à partir d'un *fake* de
la *gateway* d'export qui contient des lignes que la projection a mal calculées, et constate
qu'elles sont réparées.

Terminé quand : chaque tranche est construite et testée, aucun marqueur ne reste dans votre
contexte, eslint, vitest et check sont propres sur votre dossier. Suivez
`docs/architecture/briefings/README.md` pour les règles communes et le rapport.
