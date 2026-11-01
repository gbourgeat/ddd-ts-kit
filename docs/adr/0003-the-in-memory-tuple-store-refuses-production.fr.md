[English](0003-the-in-memory-tuple-store-refuses-production.md) · **Français**
<!-- translation-of: 0003-the-in-memory-tuple-store-refuses-production.md sha256:69fc469026cf6b64 -->

# ADR-0003 : le magasin de tuples en mémoire refuse la production

## Décision

Le `createTupleStore` qu'écrit `init --authz rebac` (`packages/cli/templates/init/platform/auth/relationships/create-tuple-store.ts.tpl`) répond le `InMemoryRelationTupleStore` en mémoire en `development` et `test` seulement, et lève une erreur dans tout autre environnement. Son message nomme ce qu'il faut lier à la place : `OpenFgaRelationTupleStore` de `@ddd-ts-kit/openfga`, ou une table de la base tenue au `relationTupleStoreContract`. `InMemoryRelationTupleStore` lui-même ne change pas et reste libre pour les tests. C'est la règle que suit déjà `DevelopmentHeaderAuthenticator`. L'entrée du changement est `changes/rebac-tuple-store-refuses-production.md`.

L'environnement est `process.env['NODE_ENV'] ?? 'development'` : un `NODE_ENV` absent compte pour du développement. C'est un choix, fait pour s'accorder avec `loadConfig` (`packages/cli/templates/init/platform/config/load-config.ts.tpl`), qui lit `env.oneOf('NODE_ENV', environments, 'development')`. Un processus démarré en production avec `NODE_ENV` absent reçoit donc le magasin en mémoire sans refus de `createTupleStore`. Ce qui l'arrête ailleurs : avec `--authn none`, `loadConfig` signale lui-même `NODE_ENV must be development or test` quand la variable est absente. Avec un autre authentificateur, rien dans le projet ne le signale.

## Pourquoi

Les tuples du magasin en mémoire vivent dans le processus. Une révocation n'atteint que cette instance, une seconde instance ne la voit jamais, et un redémarrage oublie chaque droit accordé. En production ce n'est pas un mode dégradé, c'est un contrôle d'accès qui ne tient pas. Un projet qui démarre dans cet état ne doit pas tourner.

Refuser dans `createTupleStore` place le refus là où le choix se fait, et son message dit quoi faire. Une spec générée le prouve.

Lire un `NODE_ENV` absent comme du développement garde une seule lecture de la variable dans le projet : la configuration, l'authentificateur de développement et ce magasin s'accordent. Un autre défaut ici ferait dire deux choses à une même variable.

## Ce que cela coûte

- Un projet sur ReBAC qui tourne en production lie un vrai magasin dans `createTupleStore`, ou son démarrage refuse. `ddd-ts-kit init --force` apporte le refus et sa spec.
- Un `NODE_ENV` absent en production n'est pas attrapé par cette fonction. Le déploiement fixe `NODE_ENV=production`.

## Ce qui l'inverserait

Un démarrage qui lit `NODE_ENV` une fois et refuse quand il est absent, pour toutes les piles, laisserait le défaut de `createTupleStore` passer à `production` et fermerait l'écart ci-dessus. Un magasin persistant généré par défaut rendrait le refus inutile.
