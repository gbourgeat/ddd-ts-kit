[English](0002-keep-read-models-with-projections-in-application-projections.md) · **Français**
<!-- translation-of: 0002-keep-read-models-with-projections-in-application-projections.md sha256:c5f6d3519a65bf21 -->

# ADR-0002 : garder les modèles de lecture et leurs projections dans application/projections

- Statut : remplacé le 2026-10-12 par le kit : `application/projections/` est un rôle de l'arborescence canonique
- Date : 2026-10-10
- Déroge à : `contexts.scheduling.extraDirectories.application/projections`, `contexts.notification.extraDirectories.application/projections`, `contexts.analytics.extraDirectories.application/projections`

## Contexte

Trois contextes tiennent à jour des modèles de lecture à partir d'événements : `scheduling` (les praticiens connus par `identity`, l'agenda à partir de ses propres événements), `notification` (les contacts) et `analytics` (les issues et l'occupation). Le noyau donne à cela un rôle à part entière, `@Projection`, dont le README le place dans `application/projections/*.projection.ts`. La référence de l'architecture liste une arborescence fermée par contexte dans laquelle ce répertoire n'apparaît pas, le *checker* le refuse (`tree/closed`), et le *barrel* généré laisse les classes de côté.

## Décision

Les projections vivent dans `application/projections/` des trois contextes, déclaré comme répertoire supplémentaire dans la configuration, et la racine de composition les ajoute au module de leur contexte par leur nom.

## Conséquences

Un modèle de lecture est écrit par une seule classe nommée, que le kit rend idempotente et ordonnée, au lieu de plusieurs gestionnaires d'événements d'intégration qui envoient chacun une commande. Le *barrel* ne liste pas ces classes : une projection qui n'est pas nommée dans `src/platform/composition/compose-application.ts` n'est pas abonnée, en silence ; ce sont donc les *specs* de bout en bout de chaque modèle de lecture qui prouvent le câblage. `ddd-ts-kit docs` ne liste pas les projections dans `CONTEXT.md`.

## Alternatives envisagées

Des gestionnaires d'événements d'intégration qui envoient des commandes à un agrégat qui est un modèle de lecture (la forme prise en charge) : plus de fichiers, une idempotence et un ordre écrits à la main, et pas de reconstruction. Mettre les fichiers de projection dans `application/integration/handlers/` sous un autre suffixe : le contrôle des rôles refuse une classe sans le décorateur du répertoire.

## Portée

Le répertoire `application/projections/` de `scheduling`, `notification` et `analytics`, et rien d'autre : des fichiers nommés `*.projection.ts` qui contiennent une classe déclarée avec `@Projection`. La règle est `tree/closed`.

## Condition de retrait

Le *checker* et le *barrel* connaissent `application/projections/` : les trois entrées `extraDirectories` et l'inscription explicite dans la racine de composition sont alors supprimées. Vérifié à chaque montée de version du kit par la personne qui la fait.

## Remplacé

Le 2026-10-12, le kit a fait de la projection un rôle à part entière : `application/projections/*.projection.ts` est un répertoire de l'arborescence canonique, le *barrel* généré exporte chaque projecteur et inscrit ce que prend son constructeur, et `ddd-ts-kit generate projection` en écrit un. La condition de retrait ci-dessus est remplie. Les trois entrées `extraDirectories` et leurs dérogations ont été supprimées de `ddd-ts-kit.config.json`, la racine de composition ne nomme plus les projections (`contextModule('scheduling', schedulingDeclarations)` les apporte), et `ddd-ts-kit docs` les liste dans la référence de chaque `CONTEXT.md`. Une conséquence dans les tests : une *spec* de gestionnaire de `scheduling` assemble désormais la projection de l'agenda avec le reste du contexte ; elle donne donc un *fake* au modèle de lecture qu'écrit la projection. Cet enregistrement est gardé pour l'histoire de la décision ; plus rien dans la configuration n'y renvoie.
