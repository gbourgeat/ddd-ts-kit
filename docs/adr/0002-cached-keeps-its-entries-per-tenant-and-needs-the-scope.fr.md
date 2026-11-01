[English](0002-cached-keeps-its-entries-per-tenant-and-needs-the-scope.md) · **Français**
<!-- translation-of: 0002-cached-keeps-its-entries-per-tenant-and-needs-the-scope.md sha256:afbf9b1595039daa -->

# ADR-0002 : `cached` garde ses entrées par locataire et a besoin de la portée

## Décision

L'aspect `cached` et le décorateur `Cached` de `@ddd-ts-kit/aspects` rangent une entrée sous le locataire du travail en cours. Le locataire se lit dans `scope`, l'`ExecutionScope` que reçoit `installAspectRuntime` (`packages/aspects/src/cached/cached.ts`, `packages/aspects/src/runtime/tenant-scope-of-work.ts`) :

- Un travail qui nomme un locataire a ses propres entrées, rangées comme le fait `tenantCacheKey`. Un travail sous une portée qui ne nomme aucun locataire garde la clé telle qu'écrite.
- Un *runtime* sans `scope` est refusé : `scopeOr` lève une `AspectRuntimeError` qui nomme `installAspectRuntime({ scope })` et `shared: true` (`packages/aspects/src/runtime/scope-or.ts`). L'erreur vient à l'appel, pas au câblage.
- `shared: true` garde une seule entrée pour tous les locataires, pour une réponse qui ne dépend d'aucun locataire. Il ne lit pas la portée.
- Un travail sous une élévation (`acrossTenants`) ne lit ni n'écrit le cache et exécute l'appel (`isElevatedWork` dans `packages/aspects/src/runtime/is-elevated-work.ts`), puisque sa réponse peut dépasser un seul locataire.

Une racine de composition générée donne la portée à `installAspectRuntime`. L'entrée du changement est `changes/cached-keeps-its-entries-per-tenant.md` (voir `CHANGELOG.md`).

## Pourquoi

Une clé de cache construite à partir des arguments d'un appel ne porte pas le locataire : deux locataires qui demandent le même identifiant partageraient une réponse. Toute la valeur du cache est de répondre sans interroger de nouveau la source, donc rien en aval ne vérifie que la réponse appartient à l'appelant.

Quand la portée manque, l'aspect ne peut pas dire le locataire du travail. Deux sorties étaient ouvertes : se rabattre sur la clé telle qu'écrite, ou refuser. Le repli ressemble à un cache qui marche et il est la fuite elle-même, silencieuse, découverte par le lecteur des données d'un autre locataire. Le refus coûte une erreur au premier appel, qui nomme ses deux sorties. Échouer fermé change une exposition de données en une erreur de configuration que montre le premier test qui exécute l'appel.

Une élévation n'est pas mise en cache du tout parce qu'une réponse écrite sous elle peut contenir ce que plusieurs locataires possèdent, et aucune clé de locataire ne la décrit.

## Ce que cela coûte

- Un projet dont la racine de composition est écrite à la main ajoute `scope` à `installAspectRuntime`, ou `cached` refuse à l'appel. Une lecture destinée à tous les locataires dit `shared: true`.
- Les entrées d'un cache déjà en place sont lues à froid une fois, puisque la clé a changé.
- Une lecture partagée sous une élévation n'est vue comme élevée que si le *runtime* a la portée ; sans elle, l'appel n'est pas distingué.

## Ce qui l'inverserait

Une réponse qui porte son locataire par construction (un type de clé impossible à construire sans lui) rendrait la vérification de la portée redondante, et le refus pourrait partir. Un besoin de réponses mises en cache entre locataires par défaut serait une raison d'inverser `shared`, pas de retirer le refus.
