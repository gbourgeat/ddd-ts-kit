[English](notification.md) · **Français**
<!-- translation-of: notification.md sha256:ce64e0b85be0fc5f -->

# Consigne : notification

Vous construisez le contexte délimité `notification` de l'exemple scheduling. Nom du *worker* : `notification`.

Périmètre
- Vous pouvez écrire : `src/contexts/notification/**` et `test/e2e/notification-*.e2e.spec.ts`.
- Générateurs que vous pouvez lancer : value-object, entity, domain-event, error, domain-service,
  command, query, route, port, adapter, event-handler, integration-handler, builder, e2e.

Tranches, dans cet ordre (lignes de `docs/architecture/slices.md`, règles sous son tableau) : 31, 32,
33, 34. Les agrégats `Notification` et `Reminder` existent avec leurs *repositories* ;
`SendDueReminders` et son *job* existent, non remplis.

Contrats que vous consommez (en lecture seule) : `src/contexts/scheduling/published-language/*`
(événements des rendez-vous) et `src/contexts/identity/published-language/person-registered.v1.*`.

Particularités : les contacts sont une `@Projection` (pas de générateur : écrivez
`application/projections/<name>.projection.ts` d'après le README de `@ddd-ts-kit/kernel`,
« Projections », et de `@ddd-ts-kit/knex`, « Read models » ; rapportez ce qu'en dit le *checker*).
Le port `Mailer` a un adaptateur de développement qui écrit le message dans le journal de
l'application (le port `Logger`, jamais le corps d'un courriel : identifiant du destinataire,
type, identifiant du rendez-vous) et porte sa politique de résilience sur la classe avec les
décorateurs de `@ddd-ts-kit/aspects/decorators` (`@Retry`, `@Timeout` : c'est le seul endroit de
l'exemple où la politique fait partie de l'adaptateur), et un *fake* qui échoue à la demande. Une
*spec* montre un *mailer* qui échoue à chaque tentative : le consommateur fait l'objet de nouvelles
tentatives, puis l'événement part en file de rejet et atteint le système de remontée des erreurs
(README de `@ddd-ts-kit/events`, « Consume idempotently », et de `@ddd-ts-kit/testing`). Les rappels
sont dus 24 h avant le début et envoyés une fois par rendez-vous et par début : le *job* passe
`scheduledAt`.

Terminé quand : chaque tranche est construite et testée, aucun marqueur ne reste dans votre
contexte, eslint, vitest et check sont propres sur votre dossier. Suivez
`docs/architecture/briefings/README.md` pour les règles communes et le rapport.
