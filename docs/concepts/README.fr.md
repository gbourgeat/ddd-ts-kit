[English](README.md) · **Français**
<!-- translation-of: README.md sha256:ec9f0f7b3baaa0e8 -->

# Concepts : un parcours de lecture

**Résumé.** Ces pages expliquent les idées sur lesquelles ce kit est construit : le
Domain-Driven Design (stratégique et tactique), l'architecture en couches et sa règle de
dépendance, la messagerie et la cohérence entre contextes délimités (bounded contexts), les
préoccupations transverses, le code propre et les tests. Elles enseignent et donnent les raisons ;
les règles elles-mêmes sont énoncées une seule fois, dans la
[référence d'architecture](../ARCHITECTURE.fr.md), et chaque page y renvoie par identifiant de
règle. Chaque page se lit seule en quelques minutes. Lues dans l'ordre, elles forment un parcours
de « qu'est-ce qu'un domaine » à « comment est-ce que je teste ceci », avec un seul exemple du
début à la fin : une application de prise de rendez-vous.

![Le parcours de lecture en six sections : conception stratégique (pages 1 à 5), conception tactique (6 à 11), architecture (12 à 15), messagerie et cohérence (16 à 22), préoccupations transverses (23 à 33), code et tests (34 et 35), chacune avec la question à laquelle elle répond](../assets/diagrams/concepts-reading-path.fr.svg)

## L'exemple suivi

Des clients prennent rendez-vous avec des praticiens. Cinq contextes délimités sont construits, et
l'identité est achetée :

| Contexte | Classification | Possède |
|---|---|---|
| `appointments` | cœur | les règles de réservation, de report et d'annulation ; aucun praticien n'est réservé deux fois |
| `availability` | de soutien | les créneaux libres, calculés à partir des calendriers et des rendez-vous réservés |
| `calendars` | de soutien | les heures de travail et les absences de chaque praticien |
| `notifications` | de soutien | les confirmations et les rappels, par des fournisseurs de courriel et de SMS |
| `analytics` | de soutien | les statistiques d'occupation et d'absences aux rendez-vous |
| identité | générique | un fournisseur OpenID Connect ; aucun contexte dans le code |

Comment ils dépendent les uns des autres, de l'amont vers l'aval, tels que les trouve
l'[exemple détaillé de la carte des contextes](context-map-worked-example.fr.md) :

![L'exemple suivi : calendars publie vers appointments et availability ; appointments, le contexte cœur, publie vers availability et notifications, et analytics s'y conforme ; le fournisseur de courriel et de SMS est en amont de notifications, qui garde une couche anticorruption ; le fournisseur d'identité émet les jetons de chaque contexte](../assets/diagrams/concepts-running-example.fr.svg)

L'application d'exemple du dépôt, [`examples/scheduling`](../../examples/scheduling), est un
découpage plus petit du même domaine, qui tourne ; plusieurs pages citent son code.

## 1. Conception stratégique : où sont les frontières

Lisez celles-ci d'abord. Elles décident de tout ce qui suit, et ce sont des décisions de
personnes, pas d'outils.

1. [Domaine et sous-domaines](domain-and-subdomains.fr.md) : cœur, de soutien, générique, et
   comment classer.
2. [Contexte délimité](bounded-context.fr.md) : ce qu'est une frontière et les tests qui en
   trouvent une.
3. [Langage omniprésent](ubiquitous-language.fr.md) : le glossaire, et pourquoi il s'écrit avant
   le code.
4. [Carte des contextes](context-map.fr.md) : les patrons de relation entre contextes, quand
   chacun convient et ce qu'il coûte.
5. [Carte des contextes : un exemple détaillé](context-map-worked-example.fr.md) : d'une simple
   expression des besoins à la carte de l'application de prise de rendez-vous.

## 2. Conception tactique : ce qu'il y a dans un contexte

6. [Entités et objets-valeurs](entities-and-value-objects.fr.md) : l'identité contre la valeur.
7. [Agrégats](aggregates.fr.md) : la frontière de cohérence, une transaction, la référence par
   identifiant, le dimensionnement.
8. [Briques du domaine](domain-building-blocks.fr.md) : événement du domaine, service du domaine,
   *repository*, fabrique (factory).
9. [Invariants, permissions, validation](invariants-permissions-validation.fr.md) : trois choses
   différentes, trois endroits.
10. [Modèle anémique](anemic-model.fr.md) : comment en reconnaître un, et quand un modèle mince
    convient.
11. [Machines à états](state-machines.fr.md) : le cycle de vie d'un agrégat déclaré une fois,
    interrogé par l'agrégat, dessiné dans son CONTEXT.md.

## 3. Architecture : comment le code est rangé

12. [Couches et règle de dépendance](layers-and-dependency-rule.fr.md) : architecture
    hexagonale, en oignon et *clean architecture*, ce qu'elles partagent et où elles diffèrent.
13. [Ports et composition](ports-and-composition.fr.md) : les ports comme classes abstraites, la
    racine de composition, les déclarations par décorateurs ou le câblage explicite.
14. [CQRS](cqrs.fr.md) : les bus de commandes et de requêtes tels qu'ils sont utilisés ici ;
    l'*event sourcing* est un choix séparé, par agrégat.
    [La couche présentation](presentation-layer.fr.md) va avec : une classe de contrôleur par
    route, les groupes de routes, les gardes à la bordure et les permissions sur le cas d'usage.
15. [Monolithe modulaire](modular-monolith.fr.md) : un seul déployable, de vrais modules.

## 4. Messagerie et cohérence : comment les contextes collaborent

16. [Événements du domaine et d'intégration](domain-and-integration-events.fr.md) : les deux
    sortes et ce qui les sépare.
17. [Outbox transactionnelle](transactional-outbox.fr.md) : pourquoi publier directement vers un
    *broker* perd ou invente des événements, et les stratégies de relais.
18. [Livraison et idempotence](delivery-and-idempotency.fr.md) : au moins une fois, les
    consommateurs idempotents, le stockage des événements traités, l'ordre.
19. [Cohérence à terme](eventual-consistency.fr.md) : expliquée à une personne du produit.
20. [Sagas et gestionnaires de processus](sagas-and-process-managers.fr.md) : ce que le kit
    fournit et ce qu'il ne fournit pas.
21. [Versionnement des événements](event-versioning.fr.md) : changer un contrat que d'autres
    consomment.
22. [L'event sourcing, par agrégat](event-sourcing.fr.md) : quand un agrégat garde ses événements
    au lieu de son état, ce que cela coûte, et comment y faire passer un agrégat et l'en faire
    revenir.

## 5. Préoccupations transverses : ce qui entoure les cas d'usage

23. [Authentification et autorisation](authentication-and-authorization.fr.md) : rôles,
    attributs, relations, avec une table de décision.
24. [Acteur et portée d'exécution](actor-and-execution-scope.fr.md) : qui agit, explicitement, et
    ce que porte chaque unité de travail.
25. [Multitenance](multitenancy.fr.md) : un seul déploiement, de nombreux clients, et aucune
    lecture ni écriture qui passe de l'un à l'autre.
26. [Journal d'audit](audit-trail.fr.md) : qui a fait quoi, enregistré depuis l'extérieur des cas
    d'usage.
27. [Observabilité](observability.fr.md) : traçage, journaux, métriques, remontée des erreurs, et
    l'identifiant de corrélation qui les relie.
28. [Résilience](resilience.fr.md) : nouvelle tentative (retry), délai d'expiration (timeout),
    disjoncteur (circuit breaker), cloison (bulkhead), cache, et comment chacun échoue.
29. [Cache HTTP](http-caching.fr.md) : quoi mettre en cache à quelle couche, qui peut garder une
    réponse, et jamais une décision d'autorisation d'un acteur à l'autre.
30. [Jobs planifiés](scheduled-jobs.fr.md) : le travail déclenché par le temps, et pourquoi il
    doit être idempotent.
31. [Jobs en arrière-plan](background-jobs.fr.md) : le travail qu'un cas d'usage confie à un
    *worker*, mis en file dans sa transaction, exécuté au moins une fois.
32. [Stockage de fichiers](file-storage.fr.md) : les fichiers dans un stockage et jamais dans la
    base de données, l'ordre qui garde les deux cohérents, les liens signés.
33. [Import et export de fichiers](file-import-export.fr.md) : une conception, pas encore
    construite : un gros fichier lu ou écrit par un *job* en arrière-plan, ligne par ligne, entre
    la file d'attente et le stockage de fichiers.

## 6. Code et tests

34. [Code propre](clean-code.fr.md) : nommage, petites fonctions, lecture en descente (stepdown),
    commentaires, testabilité par construction.
35. [Stratégie de test](testing-strategy.fr.md) : des *fakes* plutôt que des *mocks*, des
    *builders*, des tests de contrat, les quatre niveaux.

## Parcours plus courts

- **Une personne du produit ou un nouveau venu au DDD :** 1, 2, 3, 5, puis 19.
- **Avant d'écrire un premier cas d'usage :** 3, 7, 9, 12, 14, 35.
- **Avant de faire dialoguer deux contextes :** 4, 16, 17, 18, 21.
- **Avant de garder un agrégat sous forme de ses événements :** 7, 16, 17, 21, 22.
- **Avant de servir plusieurs clients depuis un seul déploiement :** 23, 24, 25.
- **Avant de mettre le système en production :** 23, 27, 28, 29, 30, 31, 32, puis les
  [pages d'outils](../README.fr.md#outils--une-page-par-décision).

## Limites et quand ne pas l'utiliser

Ces pages décrivent une façon assumée (opinionated) d'appliquer les patrons : celle que ce kit impose.
D'autres applications valables existent (l'*event sourcing*, une base de lecture séparée, des
agrégats persistés comme documents), et plusieurs pages disent où le kit s'arrête. Les patrons
eux-mêmes ont un coût : pour un petit outil avec peu de logique métier, l'essentiel des sections 2
à 4 dépasse ce que le problème demande, et chaque page a une section « Limites et quand ne pas
l'utiliser » qui le dit dans ses propres termes.

## Voir aussi

- [Index de la documentation](../README.fr.md)
- [Référence d'architecture](../ARCHITECTURE.fr.md) : les règles normatives
- [Méthodologie](../guides/methodology.fr.md) : les mêmes idées sous forme d'une suite d'étapes
- [Configuration](../CONFIG.fr.md)
