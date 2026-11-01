[English](0003-the-in-memory-tuple-store-refuses-production.md) · **Français**
<!-- translation-of: 0003-the-in-memory-tuple-store-refuses-production.md sha256:92fd8938f50364a5 -->

# ADR-0003 : le magasin de tuples en mémoire refuse la production

## Décision

Le `createTupleStore` qu'écrit `init --authz rebac` (`packages/cli/templates/init/platform/auth/relationships/create-tuple-store.ts.tpl`) répond le `InMemoryRelationTupleStore` en mémoire en `development` et `test` seulement, et lève une erreur dans tout autre environnement. Son message nomme ce qu'il faut lier à la place : `OpenFgaRelationTupleStore` de `@ddd-ts-kit/openfga`, ou une table de la base tenue au `relationTupleStoreContract`. `InMemoryRelationTupleStore` lui-même ne change pas et reste libre pour les tests. C'est la règle que suit déjà `DevelopmentHeaderAuthenticator`. L'entrée du changement est `changes/rebac-tuple-store-refuses-production.md`.

Un `NODE_ENV` absent arrête le démarrage. `loadConfig` (`packages/cli/templates/init/platform/config/load-config.ts.tpl`) signale `NODE_ENV must be set` sous `--authz rebac`, comme il signale `NODE_ENV must be development or test` sous `--authn none` pour l'en-tête de développement : un composant qui ne tourne qu'en développement et en test rend la variable obligatoire, si bien que la production n'est jamais atteinte par défaut. Un commentaire au-dessus du contrôle dit de le retirer dès que `createTupleStore` lie un magasin qui persiste. `createTupleStore` lit toujours `process.env['NODE_ENV'] ?? 'development'`, parce que les scripts qui composent l'application sans la démarrer, dont `scripts/openapi.ts`, tournent sans `NODE_ENV` et ne servent jamais de requête. L'entrée de ce changement est `changes/rebac-memory-store-needs-node-env.md`.

## Pourquoi

Les tuples du magasin en mémoire vivent dans le processus. Une révocation n'atteint que cette instance, une seconde instance ne la voit jamais, et un redémarrage oublie chaque droit accordé. En production ce n'est pas un mode dégradé, c'est un contrôle d'accès qui ne tient pas. Un projet qui démarre dans cet état ne doit pas tourner.

Refuser dans `createTupleStore` place le refus là où le choix se fait, et son message dit quoi faire. Une spec générée le prouve.

Le refus d'un `NODE_ENV` absent se trouve dans `loadConfig`, où l'en-tête de développement a déjà le sien, et non dans `createTupleStore` : le magasin est construit au chargement de son module, et un refus à cet endroit arrêterait aussi les scripts de contrat, qui le chargent sans `NODE_ENV`. `loadConfig` tourne au démarrage de l'application, du worker et des scripts qui ouvrent la base, lesquels lisent `.env`.

## Ce que cela coûte

- Un projet sur ReBAC qui tourne en production lie un vrai magasin dans `createTupleStore`, ou son démarrage refuse. `ddd-ts-kit init --force` apporte le refus et sa spec.
- Un projet sur ReBAC fixe `NODE_ENV` partout où il démarre : `.env` contient `NODE_ENV=development` pour `npm run dev`, le Dockerfile fixe `production`, les lanceurs de tests fixent `test`. `npm start` sur une machine sans `NODE_ENV` refuse.
- Le contrôle reste après qu'un magasin persistant a été lié, jusqu'à ce que quelqu'un le retire, comme son commentaire le demande.

## Ce qui l'inverserait

Un démarrage qui refuse un `NODE_ENV` absent pour toutes les piles remplacerait les deux contrôles de `loadConfig` par un seul. Un magasin persistant généré par défaut rendrait inutiles le refus de `createTupleStore` et le contrôle.
