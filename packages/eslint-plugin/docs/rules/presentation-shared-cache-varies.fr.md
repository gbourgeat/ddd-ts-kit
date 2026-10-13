[English](presentation-shared-cache-varies.md) · **Français**
<!-- translation-of: presentation-shared-cache-varies.md sha256:4e54d42c456d0b5b -->

# ddd-ts-kit/presentation-shared-cache-varies

Identifiant d'architecture : `presentation/shared-cache-varies` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque `@Controller({...})`, `@RouteGroup({...})` et `defineRoute({...}, handler)` de `@ddd-ts-kit/http` hors des tests.

## Pourquoi

Un cache partagé (Varnish, un CDN) range une réponse sous son URL et la remet à l'appelant suivant qui demande la même URL. La réponse d'une route qui connaît son appelant est passée par une décision d'autorisation prise pour cet appelant : sa permission, son périmètre d'accès, son *tenant*. Gardée dans un cache partagé, elle est servie à l'appelant suivant sans que cette décision soit reprise. Une politique de cache `public` sur une telle route doit dire de quoi dépend la réponse, dans `vary`, pour que le cache garde une réponse par valeur de cet élément ; le plus souvent, la réponse est plutôt `private`.

## Signalé

Un `cache` dont le `scope` est `CacheScope.public` (ou `'public'`), sans `vary` ou avec un `vary` vide, sur :

- un contrôleur ou un groupe de routes qui écrit des `guards` autres que `[Public]` ;
- une route fonction qui écrit `security` avec au moins un schéma.

Incorrect :

```ts
@RouteGroup({
  prefix: '/agenda',
  guards: [Authenticated],
  cache: { scope: CacheScope.public, maxAge: '1m' },
})
export class AgendaRoutes {}
```

Correct :

```ts
@RouteGroup({
  prefix: '/agenda',
  guards: [Authenticated],
  cache: { scope: CacheScope.private, maxAge: '0s', mustRevalidate: true, etag: 'representation' },
})
export class AgendaRoutes {}
```

## Détails

Un contrôleur qui nomme son groupe et n'écrit pas de `guards` à lui prend les gardes du groupe, qu'un autre fichier déclare : il n'est pas jugé ici, et `@ddd-ts-kit/http` refuse la même déclaration par une `DeclarationError` quand les routes sont construites, pour chaque route quel que soit le fichier. La règle est la vue anticipée, dans l'éditeur, de ce refus.

Ce que nomme un `vary` non vide est vérifié quand les routes sont montées, là où les options de l'application sont connues : il doit nommer `Authorization`, `Cookie` ou l'en-tête dans lequel est lu le *tenant* (`vary: ['Accept-Language']` seul est refusé), et un cache qui ignore `Vary` (Cloudflare, Bunny) refuse une réponse publique qui varie. Une réponse dont le schéma réserve des champs à certains appelants (`withFieldAccess`) doit aussi y nommer `Authorization` ou `Cookie`, même sur une route que tout le monde peut appeler. La règle n'en juge pas : un seul fichier ne montre ni les options ni les marques du schéma.

## Options

Aucune.

`rules."presentation/shared-cache-varies"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line presentation/shared-cache-varies -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Avec le checker de la CLI

Nouvelle avec ce *plugin* : le checker de la CLI ne connaît que son identifiant ; les routes sont refusées à l'exécution par `@ddd-ts-kit/http`.
