[English](README.md) · **Français**
<!-- translation-of: README.md sha256:a9ec0fdc22ad8dd0 -->

# @ddd-ts-kit/http

Déclarez une route une seule fois, sans framework. Montez-la sur Express 5, Fastify 5, Hono 4
(sur Node) ou NestJS, servez-la aussi comme procédure oRPC ou tRPC, et générez le contrat OpenAPI 3.1 à
partir de la même déclaration.

Chaque adaptateur passe par un seul pipeline (`executeRoute`) : validation, gestionnaire
(handler), correspondance des erreurs. Le comportement est donc le même sur les quatre
frameworks, et une seule suite de tests le prouve.

![La place du package dans une application : l'adaptateur de chaque framework remet chaque requête HTTP au même pipeline executeRoute, qui lance le gestionnaire de la route, et le gestionnaire appelle un cas d'usage ; la même liste de routes est montée sur le serveur et donnée à generateOpenApi, qui écrit le contrat](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/http-package-overview.fr.svg)

Le package vit dans la couche présentation : il transforme une requête HTTP en un appel de
votre gestionnaire, et la réponse du gestionnaire (ou son refus) en une réponse HTTP. Il ne
décide rien du métier : le gestionnaire envoie une commande ou une requête à l'application, et
le cas d'usage décide.

## Déclarer

<!-- checked sample -->
```ts
import { z } from 'zod';
import type { Actor } from '@ddd-ts-kit/kernel';
import { defineRoute, defineRoutes } from '@ddd-ts-kit/http';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

/** Le côté lecture de l'application, remis aux routes par la racine de composition. */
interface OrderQueries {
  byId(orderId: string, actor: Actor): Promise<{ id: string; total: number }>;
}

const order = zodSchema(z.object({ id: z.string(), total: z.number() }), { io: 'output' });

export const orderRoutes = (orders: OrderQueries) =>
  defineRoutes(
    defineRoute(
      {
        method: 'GET',
        path: '/orders/:orderId',
        operationId: 'getOrder',
        summary: 'Read an order',
        tags: ['orders'],
        request: { params: zodSchema(z.object({ orderId: z.string().uuid() })) },
        responses: { 200: { description: 'The order.', body: order } },
        errors: ['NOT_FOUND'],
        security: ['bearer'],
      },
      async ({ params, context }) => ({
        status: 200, // doit être un statut déclaré, et le corps doit respecter son schéma
        body: await orders.byId(params.orderId, context.execution.actor),
      }),
    ),
  );
```

- `params`, `query`, `headers` et `body` sont typés d'après les schémas. Tout `Schema` de
  `@ddd-ts-kit/validation` convient (zod, class-validator, TypeBox, Standard Schema).
- Les chemins sont faits de segments littéraux et de paramètres `:name`, la forme que partagent
  Express et Fastify.
- Les frameworks remettent les valeurs de la chaîne de requête sous forme de texte : convertissez
  dans le schéma (`z.coerce.number()`).
- `context` vaut `{ requestId, execution, principal?, rawHeaders?, raw, expectedVersion?, stream? }`.
  `execution` est l'`ExecutionContext` du kernel pour la requête HTTP (voir « Le contexte
  d'exécution d'une requête ») ; `raw` est l'objet requête du framework et `rawHeaders` les
  en-têtes tels qu'ils sont arrivés ; `expectedVersion` est lu dans `If-Match` (voir « Requêtes
  conditionnelles ») et `stream` est le corps non analysé d'une route déclarée avec `rawBody`.
- `security` est obligatoire : les noms des schémas de sécurité qui s'appliquent, ou `false` pour
  une route que tout le monde peut appeler. Une route n'est jamais publique par omission :
  l'oublier ne compile pas, et `defineRoute` refuse une liste vide, qui dirait la même chose que
  `false` sans le dire.
- `defineRoutes` et chaque montage refusent un `operationId` en double, ou un couple méthode et
  chemin en double.
- `prefixRoutes('/api', routes)` place des routes sous un préfixe, pour le serveur et pour le
  contrat.

Un refus est levé, pas renvoyé. Le gestionnaire ne répond que le succès qu'il déclare ; ce qui
peut mal se passer est un code dans `errors`, que le contrat documente et auquel le pipeline
répond :

```ts
// Au lieu de : un 404 écrit à la main, une deuxième forme de réponse que chaque route réinvente
responses: { 200: { description: 'The order.', body: order }, 404: { description: 'No such order.' } },
async ({ params }) => {
  const found = await orders.find(params.orderId);
  return found === undefined ? { status: 404 } : { status: 200, body: found };
},

// Écrivez : le cas d'usage lève un refus (NotFoundError, ou une fabrique d'une classe de refus) et la
// route liste son code ; la réponse est un document problem, le même sur chaque route (voir « Erreurs »)
responses: { 200: { description: 'The order.', body: order } },
errors: ['NOT_FOUND'],
async ({ params, context }) => ({ status: 200, body: await orders.byId(params.orderId, context.execution.actor) }),
```

## Contrôleurs, groupes de routes et gardes

Une route peut aussi être une classe : une classe par route, une méthode, `handle`. Son
décorateur est la déclaration, et le compilateur y tient `handle` : une partie que les schémas
ne produisent pas, ou un autre corps que la réponse déclarée, est une erreur sur le décorateur.

<!-- checked sample -->
```ts
import { z } from 'zod';
import { AuthorizedCommand, type Actor, type CommandBus } from '@ddd-ts-kit/kernel';
import { Authenticated, Controller, RouteGroup, controllerRoutes, type HttpRequest } from '@ddd-ts-kit/http';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

/** La commande du cas d'usage, dans la couche application (sa permission @Requires est omise ici). */
class PlaceOrder extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly customerId: string,
  ) {
    super(actor);
  }
}

const body = zodSchema(z.object({ customerId: z.string().min(1) }));
const placed = zodSchema(z.object({ id: z.string() }), { io: 'output' });

type PlaceOrderBody = Infer<typeof body>; // { customerId: string }
type Placed = Infer<typeof placed>; // { id: string }

@RouteGroup({ prefix: '/orders', tags: ['orders'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class OrdersRoutes {}

@Controller({
  group: OrdersRoutes,
  method: 'POST',
  path: '/',
  summary: 'Place an order',
  body,
  response: { status: 201, body: placed },
  errors: ['OUT_OF_STOCK'],
})
export class PlaceOrderController {
  constructor(private readonly commands: CommandBus) {}

  async handle({ body, actor }: HttpRequest<{ body: PlaceOrderBody }>): Promise<Placed> {
    return { id: await this.commands.execute(new PlaceOrder(actor, body.customerId)) };
  }
}

declare const application: { resolve<T>(target: abstract new (...args: never) => T): T };

export const routes = controllerRoutes([PlaceOrderController], { resolve: application.resolve });
```

La route de ce contrôleur est `POST /orders` : le préfixe de son groupe, puis son propre chemin
(`/` est le préfixe lui-même).
Elle répond 201 avec `{ id }`, documente `OUT_OF_STOCK` (le sien), `FORBIDDEN` (celui de son
groupe) et `UNAUTHORIZED` (celui de la garde `Authenticated`), et ne laisse aucun appelant
anonyme atteindre `handle`.

| Export | Ce que c'est |
|---|---|
| `Controller(spec)` | le décorateur d'un contrôleur : `group`, `method`, `path` (après le préfixe du groupe), `operationId` (par défaut, le nom de la classe sans `Controller`), `summary`, `description`, `tags`, `params`, `query`, `headers`, `body`, `upload` (voir « Téléversements et fichiers »), `response: { status, description?, body? }`, `errors`, `guards`, `deprecated`, `cache` et `ifMatch` (voir « Cache HTTP »), `produces` et `consumes` (voir [Représentations](#représentations--json-xml-csv)), `form` (voir [Formulaires décrits par le serveur](#formulaires-décrits-par-le-serveur)) |
| `RouteGroup({ parent, prefix, tags, guards, errors, cache })` | nomme un ensemble de routes sur une classe vide ; un enfant hérite de son `parent` et y ajoute ; le `cache` le plus proche l'emporte |
| `Guard` | l'interface `{ documents?, admit?(admission: GuardAdmission), check(request: GuardRequest) }`, et le décorateur d'une classe de garde qui prend des dépendances ; `admit` décide sur l'appelant seul, avant que la requête HTTP soit lue |
| `Authenticated`, `Public`, `HasRole(...roles)`, `HasScope(...scopes)`, `TenantMember` | les gardes que livre le package, sur l'`Actor` et la `Session` de la requête HTTP : 401 à l'appelant anonyme, avant que la requête HTTP soit lue, 403 sans l'un des rôles, sans chacun des scopes nommés (`Session.scopes`, typés par les `SessionScopes` du projet) ou hors du tenant de la requête HTTP ; `Public` laisse entrer tout le monde et s'emploie seule. Un refus d'une garde est signalé à `onGuardRefusal` |
| `RequestMapper<Request, Message>`, `Serializer<Result, Body>` | les interfaces des deux traducteurs facultatifs (`map`, `serialize`), et les décorateurs qui les déclarent |
| `HttpRequest<{ params, query, headers, body }>` | la requête HTTP telle que `handle`, un *mapper* ou une garde la nomment, avec `actor` et `context` |
| `controllerRoutes(controllers, { resolve, security, guards })` | la `Route` de chaque contrôleur, donné comme classe (construite par `resolve`) ou comme instance ; `security` nomme les schémas de sécurité de l'application (`['bearer']` par défaut) ; `guards: 'skip'` sert à la *spec* d'un contrôleur seul |
| `controllerRoute(controller, options)` | l'unique route d'un contrôleur, pour une *spec* |
| `routeOf(controller or route, options)` | (`@ddd-ts-kit/http/testing`) la route d'une *spec* et `send(request)`, par tout le pipeline au nom d'un `caller` authentifié, gardes comprises sauf si `guards: 'skip'` dit le contraire, réponses vérifiées : voir [La *spec* d'une route](#la-spec-dune-route--routeof) |

Un contrôleur sans groupe et sans garde est refusé dès que sa classe est définie. Les gardes
s'exécutent dans l'ordre, après la validation et avant `handle`, dans la portée d'exécution de
la requête HTTP, et ce qu'elles lèvent reçoit une réponse *problem* comme tout refus. Avant
cela, les gardes qui déclarent un `admit` décident sur l'appelant seul, dans l'ordre, avant que
rien de la requête HTTP ne soit lu : l'appelant anonyme d'une route `Authenticated` reçoit 401,
jamais les problèmes de validation de son entrée, et son téléversement n'est jamais reçu. Une garde
est un contrôle à la frontière ; une permission se déclare sur le cas d'usage (`@Requires`), où
un *job* et un gestionnaire d'événement la rencontrent aussi. Les contrôleurs sont des classes
déclarées de la frontière (`Edge` de `@ddd-ts-kit/kernel/declarations`) : `@ddd-ts-kit/di` lie
chacun sous lui-même et les liste dans `DeclaredEdges`. Un contrôleur a une seule réponse et
répond son corps : une route à plusieurs statuts de succès, à en-têtes de réponse ou à corps
brut reste une fonction `defineRoute`. Les raisons sont sur la page
[couche présentation](../../docs/concepts/presentation-layer.fr.md).

## Une requête, étape par étape

`executeRoute(route, request, options)` est tout le comportement du package : un adaptateur ne
fait que copier la requête HTTP de son framework dans une `RawRequest` (`params`, `query`,
`headers`, `body`, `raw`, et le flux du corps, `stream`), l'appeler, et réécrire la
`RouteResponse` qu'elle renvoie.

![Les étapes que suit executeRoute pour une requête HTTP : les identifiants, puis, dans le hook around, authentification, téléversement, validation, If-Match, contexte d'exécution et tenant, puis les gardes et handle dans la portée d'exécution, le contrôle de la réponse, les en-têtes et le 304 ; chaque étape qui peut refuser nomme son statut, et chaque refus devient un document problem](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/http-package-pipeline.fr.svg)

Les étapes inutiles sont sautées : pas de téléversement, pas d'`If-Match`, pas de garde, pas de
validateur. Le premier refus termine la requête HTTP : une requête HTTP invalide n'atteint
jamais le contrôle d'une garde, et un appelant qu'une garde refuse n'atteint jamais `handle`.
Une accréditation que `resolvePrincipal` rejette est refusée avant tout le reste ; juste après,
l'admission de la route (`admit`, les gardes qui décident sur l'appelant seul) refuse par 401 ou
403 un appelant refusé pour ce qu'il est, avant le téléversement, le corps et la validation, et
le signale à `onGuardRefusal`. Les contrôles des gardes s'exécutent après la validation, et
lisent donc des paramètres typés.

Comme `executeRoute` n'a besoin d'aucun serveur, la *spec* d'une route l'appelle directement,
comme le font les adaptateurs :

<!-- checked sample -->
```ts
import { z } from 'zod';
import { NotFoundError } from '@ddd-ts-kit/kernel';
import { defineRoute, executeRoute, type RawRequest } from '@ddd-ts-kit/http';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

const orders = new Map([['7', { id: '7', total: 42 }]]);

const getOrder = defineRoute(
  {
    method: 'GET',
    path: '/orders/:orderId',
    operationId: 'getOrder',
    summary: 'Read an order',
    request: { params: zodSchema(z.object({ orderId: z.string().regex(/^\d+$/) })) },
    responses: {
      200: { description: 'The order.', body: zodSchema(z.object({ id: z.string(), total: z.number() }), { io: 'output' }) },
    },
    errors: ['NOT_FOUND'],
    security: false,
  },
  async ({ params }) => {
    const found = orders.get(params.orderId);

    if (found === undefined) {
      throw new NotFoundError(`Order ${params.orderId} does not exist.`);
    }

    return { status: 200, body: found };
  },
);

const request = (orderId: string): RawRequest => ({ params: { orderId }, query: {}, headers: {}, body: undefined, raw: undefined });

export const found = await executeRoute(getOrder, request('7')); // 200, { id: '7', total: 42 }
export const missing = await executeRoute(getOrder, request('8')); // 404, un problem avec le code NOT_FOUND
export const invalid = await executeRoute(getOrder, request('x')); // 422, VALIDATION_FAILED, une erreur en params.orderId
```

Passez les options de l'application en troisième argument (`validateResponses: true` dans les
tests, `resolvePrincipal` pour appeler au nom d'un acteur donné) : la réponse est celle que le
serveur enverrait, en-têtes compris.

### La *spec* d'une route : `routeOf`

`routeOf` de `@ddd-ts-kit/http/testing` est cet appel, réglé une fois pour toute une *spec* : il
prend un contrôleur (une instance, ou sa classe avec `resolve`) ou une route déjà construite
(`defineRoute`, `nestControllerRoute`), et `send` lui confie une requête, chaque partie omise
étant vide. Chaque requête traverse tout le pipeline, gardes comprises, au nom de `caller`, un
utilisateur authentifié (`user-1`, sans rôle) sauf si la *spec* en nomme un autre, et sa réponse
est vérifiée contre la déclaration (`validateResponses: true`). Les autres options
d'`executeRoute` (`errorMapper` par exemple) sont données une fois, à côté ; `guards: 'skip'`
laisse de côté les gardes d'un contrôleur, pour la *spec* qui le dit. La *spec* générée de chaque
route et de chaque contrôleur est écrite avec lui, et avec un bus enregistreur de
`@ddd-ts-kit/kernel/testing`, pour vérifier ce que le cas d'usage a reçu :

<!-- checked sample -->
```ts
import { z } from 'zod';
import { AuthorizedCommand, type Actor, type CommandBus } from '@ddd-ts-kit/kernel';
import { Authenticated, Controller, RouteGroup, controllerRoutes, type HttpRequest } from '@ddd-ts-kit/http';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

/** The command of the use case, in the application layer (its @Requires permission left out here). */
class PlaceOrder extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly customerId: string,
  ) {
    super(actor);
  }
}

const body = zodSchema(z.object({ customerId: z.string().min(1) }));
const placed = zodSchema(z.object({ id: z.string() }), { io: 'output' });

type PlaceOrderBody = Infer<typeof body>; // { customerId: string }
type Placed = Infer<typeof placed>; // { id: string }

@RouteGroup({ prefix: '/orders', tags: ['orders'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class OrdersRoutes {}

@Controller({
  group: OrdersRoutes,
  method: 'POST',
  path: '/',
  summary: 'Place an order',
  body,
  response: { status: 201, body: placed },
  errors: ['OUT_OF_STOCK'],
})
export class PlaceOrderController {
  constructor(private readonly commands: CommandBus) {}

  async handle({ body, actor }: HttpRequest<{ body: PlaceOrderBody }>): Promise<Placed> {
    return { id: await this.commands.execute(new PlaceOrder(actor, body.customerId)) };
  }
}

declare const application: { resolve<T>(target: abstract new (...args: never) => T): T };

export const routes = controllerRoutes([PlaceOrderController], { resolve: application.resolve });
```

## Cache HTTP

Une lecture dit comment les caches sur le trajet peuvent garder sa réponse, sur son contrôleur,
sur son groupe de routes (chaque lecture du groupe, `GET` et `HEAD`, sauf si un contrôleur dit
autre chose : une écriture du groupe garde le comportement par défaut d'une écriture) ou sur une
route fonction (`cache` de la déclaration) :

```ts
import { CacheScope, Public, RouteGroup } from '@ddd-ts-kit/http';

@RouteGroup({
  prefix: '/catalog',
  guards: [Public],
  cache: { scope: CacheScope.public, maxAge: '1m', sMaxAge: '5m', staleWhileRevalidate: '30s', staleIfError: '1d' },
})
export class CatalogRoutes {}
```

| Champ | Produit |
|---|---|
| `scope` | `public` (tout cache : un CDN, Varnish, le navigateur), `private` (le navigateur de l'appelant seulement), `no-store` (personne) |
| `maxAge`, `sMaxAge` | `max-age`, et `s-maxage`, que les caches partagés lisent à sa place ; des secondes entières, en texte : `'0s'`, `'30s'`, `'5m'`, `'1h'`, `'1d'` |
| `staleWhileRevalidate`, `staleIfError` | combien de temps une réponse périmée peut encore être servie pendant que le cache redemande, ou pendant que le serveur échoue |
| `mustRevalidate` | `must-revalidate` : une fois périmée, jamais servie sans redemander |
| `vary` | `Vary` : les en-têtes de la requête HTTP dont dépend la réponse, en plus de l'URL |

Le pipeline envoie `Cache-Control` (et `Vary`) sur une réponse de succès, `no-store` sur chaque
refus d'une route qui déclare une politique de cache, et `no-store` sur chaque réponse d'une
route qui connaît son appelant et n'en déclare aucune : une réponse authentifiée n'est jamais
gardée par défaut. Une route publique qui ne déclare rien ne dit rien, comme avant. Un en-tête
que le gestionnaire d'une route fonction répond lui-même l'emporte. Le contrat documente les
en-têtes sur la réponse à laquelle ils s'appliquent.

Une politique de cache intenable est refusée dès la déclaration de la route, avec une
`DeclarationError` :

- une politique autre que `no-store` sur une écriture (un cache ne garde que `GET` et `HEAD`),
  les validateurs d'une lecture (`etag`, `lastModified`) sur une écriture, `ifMatch` sur une
  lecture ;
- `public` ou `private` sans `maxAge` (`'0s'` fait revalider la réponse à chaque fois), une durée
  qui n'est pas en secondes entières, une durée sur `no-store`, `sMaxAge` sur une réponse privée ;
- **une réponse `public` d'une route qui connaît son appelant** (une garde autre que `Public`,
  une route fonction avec `security`) qui ne nomme pas dans `vary` ce dont elle dépend. Un cache
  partagé range une réponse sous son URL : sans `vary: ['Authorization']` (ou l'en-tête qui porte
  le tenant), il remettrait la réponse d'un appelant au suivant. `private` est la réponse
  habituelle. La règle ESLint `presentation/shared-cache-varies` signale la même déclaration dans
  l'éditeur, pour ce que montre un seul fichier.

```ts
// Au lieu de : refusé avec une DeclarationError ; un CDN remettrait l'agenda d'un appelant au suivant
@RouteGroup({ prefix: '/me', guards: [Authenticated], cache: { scope: CacheScope.public, maxAge: '1m' } })

// Écrivez : gardé par le navigateur de l'appelant seulement
@RouteGroup({ prefix: '/me', guards: [Authenticated], cache: { scope: CacheScope.private, maxAge: '1m' } })

// Ou, quand un cache partagé doit la garder : une copie par accréditation
@RouteGroup({
  prefix: '/me',
  guards: [Authenticated],
  cache: { scope: CacheScope.public, maxAge: '1m', vary: ['Authorization'] },
})
```

Quand les routes sont montées (`mountExpress`, `mountFastify`, `createRoutesModule`), les options
de l'application sont connues, et une réponse publique y est tenue avec une `DeclarationError` :

- sur une route qui connaît son appelant, `vary` nomme `Authorization`, `Cookie`, ou un en-tête
  d'où le tenant est lu (`resolveTenant`) : `vary: ['Accept-Language']` seul est refusé ;
- sur toute route, même une que tout le monde peut appeler, une réponse dont le schéma réserve
  des champs à certains appelants (`withFieldAccess` avec une exigence `read`, sur la réponse, sa
  page ou son flux) nomme `Authorization` ou `Cookie` dans `vary` : ce qu'elle montre dépend de
  qui appelle ;
- derrière un cache qui ignore `Vary` (`cacheTags.header` de Cloudflare ou de Bunny), une réponse
  publique qui varie est refusée, sauf si `cacheTags.honoursVary: true` dit que le cache range
  ses réponses selon ces en-têtes ; une réponse choisie par `Accept` parmi plusieurs types de
  média (`produces`) varie sur lui ;
- avec des tags rangés par tenant (`cacheTags.perTenant`), une route avec tags que tout le monde
  peut appeler a besoin de `resolveTenant` : sinon un appel anonyme ne nomme aucun tenant, et
  aucune purge n'atteindrait sa réponse.

Chaque réponse qu'un cache peut garder varie selon les en-têtes d'où le tenant est lu
(`TenantResolver.headers` : `tenantFromHeader` nomme son en-tête, `firstTenantOf` les en-têtes
de ses *resolvers*), que le pipeline ajoute à `Vary`. Une réponse avec tags rangée par tenant,
à une requête HTTP qui ne nomme aucun tenant, est `no-store`.

Ne mettez jamais en cache une décision d'autorisation d'un acteur à l'autre : ce qu'un appelant
peut voir est décidé par le cas d'usage pour cet appelant, et un cache partagé ne garde jamais
que ce qui est le même pour tout le monde (voir [Cache HTTP](../../docs/concepts/http-caching.fr.md)).

### Requêtes conditionnelles

Une lecture qui nomme sa version répond `ETag` ou `Last-Modified`, et `304 Not Modified` sans
corps à un appelant qui détient déjà cette version :

```ts
@Controller({
  group: CalendarsRoutes,
  method: 'GET',
  path: '/:calendarId/days/:day',
  summary: 'Get calendar day',
  params,
  response: { status: 200, body: answer },
  cache: { scope: CacheScope.private, maxAge: '0s', mustRevalidate: true, etag: 'representation' },
})
```

| Champ | Produit |
|---|---|
| `etag: 'representation'` | un tag fort, le SHA-256 des octets envoyés : valable pour toute réponse, et le gestionnaire s'exécute quand même (il économise le transfert, pas le travail) |
| `etag: { version: 'version' }` | un tag faible, `W/"7"`, tiré de la version que porte le corps sous ce champ (avec des points : `calendar.version`) : la version de l'agrégat ou du modèle de lecture affiché |
| `lastModified: 'changedAt'` | `Last-Modified`, tiré de l'instant sous ce champ (une `Date` ou un texte ISO 8601), comparé à `If-Modified-Since` à la seconde près |

`If-None-Match` est lu en premier et comparé faiblement, `If-Modified-Since` seulement en son
absence. Un corps auquel manque le champ qu'il nomme répond 500, comme toute réponse que sa
déclaration n'autorise pas. Le contrat gagne les paramètres `If-None-Match` et
`If-Modified-Since`, les en-têtes `ETag` et `Last-Modified` et la réponse `304`. Sous les
[représentations](#représentations--json-xml-csv), la version, l'instant et les étiquettes de
cache sont lus dans ce qu'a répondu le gestionnaire, les mêmes en JSON, XML ou CSV ; une étiquette
forte résume les octets du type de média envoyé, si bien que chaque représentation a la sienne, et
une liste en flux, dont les octets ne sont pas connus quand ses en-têtes partent, n'en a aucune.

Une écriture faite sur la version qu'un client a lue déclare `ifMatch` (`IfMatch.optional` ou
`IfMatch.required`). Le pipeline lit la version nommée dans `If-Match` (le tag faible renvoyé
par la lecture, ou sa forme forte `"7"`) et la remet au gestionnaire en
`context.expectedVersion` ; le cas d'usage la compare à la version de l'agrégat qu'il a chargé :

```ts
// le contrôleur : new SetOpeningHoursCommand(request.actor, calendarId, ranges, request.context.expectedVersion)
// le gestionnaire de la commande :
const calendar = await this.calendars.findById(command.calendarId);
expectVersion(calendar, command.expectedVersion); // PreconditionFailedError, 412, quand elle a changé
```

| Requête HTTP | Réponse |
|---|---|
| `If-Match` nomme la version courante, ou `*` | la modification s'exécute |
| `If-Match` nomme une autre version, ou un tag qui n'est pas une version | `412 PRECONDITION_FAILED` |
| pas d'`If-Match`, `ifMatch: 'optional'` | la modification s'exécute sans condition, comme avant |
| pas d'`If-Match`, `ifMatch: 'required'` | `428 PRECONDITION_REQUIRED`, avant que le gestionnaire s'exécute |

C'est la concurrence optimiste à la frontière : la version qu'une personne a vue à l'écran, pas
seulement celle que le gestionnaire a chargée une milliseconde plus tôt. Deux écritures au même
instant rencontrent toujours la `ConcurrencyError` du *repository*. La RFC 9110 compare
`If-Match` fortement, et sous cette règle un tag faible ne correspond jamais : le kit compare
plutôt les versions, ce que les deux formes nomment ici, et le documente. Le contrat gagne le
paramètre `If-Match` et les *problems* `412` (et `428`).

### Tags de cache et purge après le commit

Une réponse publique nomme les ressources qu'elle montre, pour qu'un cache partagé la range sous
leurs tags et la supprime quand l'une d'elles change, au lieu d'attendre `maxAge` :

```ts
cache: {
  scope: CacheScope.public,
  maxAge: '1m',
  sMaxAge: '1h',
  tags: [{ resource: 'calendar', param: 'calendarId' }, { resource: 'appointment', field: 'items.id' }],
},
```

| Source | Tag |
|---|---|
| `{ resource, param }` | `<resource>:<valeur du paramètre de chemin>` |
| `{ resource, field }` | `<resource>:<valeur>` pour chaque valeur à ce chemin pointé du corps (une liste est parcourue) |
| `{ resource }` | `<resource>` : une modification de n'importe quel élément de ce type purge la réponse (une liste, une recherche) |

Les tags sont faits avec `cacheTag(resource, id)` du kernel, l'identifiant encodé en pourcentage.
Une application multitenant les range sous le tenant de la requête HTTP (`acme/calendar:c-1`)
avec `cacheTags: { header, perTenant: true }`, et ses purges avec `perTenant: true` de
`PublishedCacheInvalidation` : les deux côtés ou aucun, sinon les purges manquent leur cible.
Les tags ne sont envoyés que lorsque l'application nomme l'en-tête que lit son cache partagé,
`cacheTags: { header }` des options : `CacheTagHeader.xkey` (Varnish), `surrogateKey` (Fastly),
`cacheTag` (Cloudflare), `cdnTag` (Bunny) ; sans lui, aucune réponse ne porte de tags. Le
contrat les liste comme gabarits dans `x-cache-tags`. Des tags sur une réponse privée, ou qui
lisent un paramètre que le chemin n'a pas, sont refusés dès la déclaration de la route.

La purge est demandée par le cas d'usage et faite après le commit de sa transaction :

```ts
// application/event-handlers/calendar-opening-hours-set.event-handler.ts : before-commit, la phase par défaut
@DomainEventHandler(CalendarOpeningHoursSet)
export class CalendarOpeningHoursSetEventHandler implements DomainEventHandler<CalendarOpeningHoursSet> {
  constructor(private readonly cacheInvalidation: CacheInvalidation) {}

  async handle(event: CalendarOpeningHoursSet): Promise<void> {
    await this.cacheInvalidation.invalidate([cacheTag('calendar', event.aggregateId)]);
  }
}
```

`CacheInvalidation` du kernel publie une demande de purge sur le *publisher* de l'application,
que `kernelModule()` lie par défaut : derrière une outbox, la demande est une ligne de la
transaction de la commande. Une commande annulée (rollback) ne purge rien ; une commande dont la
transaction aboutit (commit) purge même quand le processus s'arrête juste après le commit,
puisque la ligne attend le relais suivant. Le relais remet les demandes à un `CachePurger` et
tous les autres événements au *broker* :

<!-- checked sample -->
```ts
import { OutboxRelay, type OutboxStore } from '@ddd-ts-kit/events';
import { PurgingPublisher, type Clock, type IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { VarnishCachePurger } from '@ddd-ts-kit/http/purgers';

declare const store: OutboxStore;
declare const broker: IntegrationEventPublisher;
declare const clock: Clock;
declare const varnishUrl: string;
declare const varnishPurgeKey: string;

export const relay = new OutboxRelay({
  store,
  publisher: new PurgingPublisher(new VarnishCachePurger({ url: varnishUrl, key: varnishPurgeKey }), broker),
  clock,
});
```

Une purge qui échoue lève une erreur : le relais la retente comme il retente une publication, et
une demande livrée deux fois purge deux fois, ce qui ne change rien. Une lecture qui a chargé
l'état précédent juste avant le commit peut encore atteindre le cache après la purge et y
rester pendant son `s-maxage` : `RepeatedCachePurger` du kernel purge une fois de plus un peu
plus tard (`new RepeatedCachePurger(varnish, { againAfterMs: 2_000 })`), au mieux. Sans outbox
(`events: in-memory`), la demande atteint le bus en mémoire, où rien ne purge : passez
`cacheInvalidation` à `kernelModule` pour purger autrement.

`@ddd-ts-kit/http/purgers` contient les adaptateurs du port `CachePurger` ; ils n'ont besoin
d'aucune dépendance (le `fetch` de Node) et sont tenus à `cachePurgerContract` de
`@ddd-ts-kit/testing/contracts`, que l'adaptateur en mémoire (`InMemoryCachePurger` du kernel)
passe aussi :

| Adaptateur | Purge | En-tête des tags | Vérifié |
|---|---|---|---|
| `VarnishCachePurger({ url, key?, mode?, soft? })` | `PURGE` avec `xkey-purge` (vmod_xkey), ou `xkey-softpurge` avec `soft` ; `mode: 'ban'` envoie un `x-ban-tag` par tag, ses caractères de motif échappés, que le VCL transforme en ban ; `key` va dans `x-purge-key`, que le VCL exige d'une purge venue d'une autre machine | `xkey` | la suite de contrat sur Varnish 9.1.0 avec le VCL qu'écrit `init --http-cache varnish`, en CI |
| `FastlyCachePurger({ serviceId, token, soft? })` | `POST /service/<id>/purge`, 256 *surrogate keys* par requête HTTP | `surrogate-key` | la suite de contrat sur un *fake* de l'API de purge documentée, et les requêtes HTTP qu'il envoie ; jamais lancé contre Fastly |
| `CloudflareCachePurger({ zoneId, token })` | `POST /zones/<id>/purge_cache` avec `tags`, 100 par requête HTTP, sur toutes les offres | `cache-tag` | la suite de contrat sur un *fake* de l'API de purge documentée, et les requêtes HTTP qu'il envoie ; jamais lancé contre Cloudflare |

Une purge que le cache ne confirme pas par un 2xx est une `CachePurgeError`. Bunny et les autres
caches sont comparés sur la page [Caches HTTP](../../docs/tools/http-caches.fr.md).

## Erreurs

Un gestionnaire lève une `DomainError` ; son `code` est associé à un statut en un seul endroit,
et la réponse est en `application/problem+json` (RFC 9457) :

```json
{ "type": "urn:problem:not-found", "title": "Not Found", "status": 404, "code": "NOT_FOUND",
  "detail": "Order 7 does not exist.", "requestId": "..." }
```

![Comment la réponse à une erreur est choisie : une erreur qui n'est pas une DomainError répond 500 sans détail ; une DomainError reçoit le statut auquel son code correspond, d'après les défauts, les codes de l'application, sinon 422 ; un 5xx ne répond que son statut et son code, un 4xx un document problem avec son détail, ses faits exposés et ses erreurs de validation](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/http-package-error-answer.fr.svg)

Un refus construit par une fabrique porte des faits, et ils sont privés : le document ne
contient, sous `facts`, que ceux que sa fabrique a exposés par leur nom, et aucun membre `facts`
quand elle n'en a exposé aucun.

<!-- checked sample -->
```ts
import { DomainRefusal } from '@ddd-ts-kit/kernel';

// scheduling.codes.ts
export const SchedulingCodes = {
  SlotTaken: 'SLOT_TAKEN',
} as const;

// domain/errors/slot-taken.error.ts
export class SlotTaken extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTaken;

  static forCalendar(calendarId: string, startsAt: Date) {
    return SlotTaken.refusal('The slot is already held.', { calendarId, startsAt }).exposing('startsAt');
  }
}
```

Avec `SLOT_TAKEN` associé à 409 (`createErrorMapper({ SLOT_TAKEN: 409 })`, plus bas), un
gestionnaire qui lève `SlotTaken.forCalendar('c-1', startsAt)` répond :

```json
{ "type": "urn:problem:slot-taken", "title": "Conflict", "status": 409, "code": "SLOT_TAKEN",
  "detail": "The slot is already held.", "facts": { "startsAt": "2026-03-02T09:00:00.000Z" }, "requestId": "..." }
```

`calendarId` reste dans le processus : la fabrique ne l'a pas exposé.

`facts` est un objet facultatif du schéma `Problem` du document OpenAPI. Un client choisit sa
branche sur `code` et lit les données dans `facts`, jamais dans `detail`, qui est une phrase
pour un humain et peut changer. Le message est renvoyé tel qu'il a été écrit : il ne dit rien
que l'appelant n'a pas envoyé, et rien sur une autre personne. Un refus associé à un 5xx ne
répond ni son message ni ses faits.

<!-- checked sample -->
```ts
import type { Problem } from '@ddd-ts-kit/http';

// Au lieu de : des données extraites de la phrase, ce qui casse le jour où la phrase est reformulée
export function startsAtFromDetail(problem: Problem): string | undefined {
  return /held at (.+)\.$/.exec(problem.detail ?? '')?.[1];
}

// Écrivez : choisir la branche sur le code stable, lire le fait que le refus a exposé
export function startsAtOf(problem: Problem): string | undefined {
  if (problem.code !== 'SLOT_TAKEN') {
    return undefined;
  }

  const startsAt = problem.facts?.['startsAt'];

  return typeof startsAt === 'string' ? startsAt : undefined;
}
```

Valeurs par défaut : `VALIDATION_FAILED` 422 (avec `issues`, chemins préfixés par la partie :
`body.items.0.sku`), `NOT_FOUND` 404, `CONFLICT` 409, `CONCURRENCY_CONFLICT` 409 (une mise à jour
perdue ou un interblocage : le client renvoie la requête), `INVARIANT_VIOLATION` 422,
`UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_ACCEPTABLE` 406, `PRECONDITION_FAILED` 412,
`UNSUPPORTED_MEDIA_TYPE` 415 (un corps ou un fichier d'un type que la route ne prend pas),
`PRECONDITION_REQUIRED` 428, et pour les fichiers `FILE_NOT_FOUND` 404, `FILE_TOO_LARGE` 413, et
`SERVICE_UNAVAILABLE` 503 (une unité de travail que la base n'a pas pu servir à temps,
`TransactionTimeoutError` : le client réessaie plus tard). Une erreur qui n'est pas une
`DomainError` répond 500 `INTERNAL_ERROR`, sauf si son `code` correspond à un statut de serveur,
comme `SERVICE_UNAVAILABLE` : elle garde ce statut et ce code, rien de son message. Un code du domaine sans correspondance répond 422 (`fallbackStatus` du second argument le change).

<!-- checked sample -->
```ts
import { createErrorMapper } from '@ddd-ts-kit/http';

export const errorMapper = createErrorMapper({ ORDER_ALREADY_SHIPPED: 409, QUOTA_EXCEEDED: 429, SLOT_TAKEN: 409 });

errorMapper.statusOf('SLOT_TAKEN'); // 409, le code de l'application
errorMapper.statusOf('NOT_FOUND'); // 404, une valeur par défaut
errorMapper.statusOf('INVALID_EMAIL'); // 422, un code sans correspondance
errorMapper.typeOf('SLOT_TAKEN'); // 'urn:problem:slot-taken', le type de son document problem
```

Tout ce qui n'est pas une `DomainError` répond 500 `Internal Server Error` sans détail (son
code est `INTERNAL_ERROR`) : le message d'une erreur inattendue ne quitte jamais le processus.
Journalisez-la depuis le hook `onError`, et remontez-la à l'outil de suivi des erreurs avec
`onError: reportHttpErrors(errorReporter)` : chaque requête HTTP qui reçoit un 5xx part vers
l'`ErrorReporter` du kernel, une seule fois, avec les identifiants de corrélation, d'acteur et de
tenant de son contexte d'exécution (`context.execution`, présent dès que la requête HTTP est
allée jusque-là) ; un 4xx, jamais.

Un refus construit par une fabrique (`DomainRefusal`, ou `ConceptError` de la forme
antérieure) répond son message comme `detail`, sauf si le message cite un fait que la fabrique
n'a pas exposé : le client lit alors une phrase tirée du code (`INVALID_EMAIL` donne `Invalid
email.`) et le message reste dans les journaux et les remontées d'erreurs. Un fait est repéré dans le message sous forme de texte, de nombre ou
d'instant ISO ; un fait écrit autrement (une date formatée, un nombre arrondi) n'est pas
vu : exposez donc ce qu'un client peut lire, et gardez le reste hors de la phrase.

## Options communes aux adaptateurs

Chaque montage prend les mêmes `ExecuteOptions`, un simple objet construit là où le serveur
démarre :

<!-- checked sample -->
```ts
import { auditGuardRefusals } from '@ddd-ts-kit/audit';
import { CacheTagHeader, createErrorMapper, type ExecuteOptions } from '@ddd-ts-kit/http';
import type { AuditTrail, Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { tracedRoutes } from '@ddd-ts-kit/tracing';

declare function authenticate(raw: unknown): Promise<unknown>;
declare const logger: { error(fields: Record<string, unknown>): void };
declare const trail: AuditTrail;
declare const clock: Clock;
declare const ids: IdGenerator;

export const options: ExecuteOptions = {
  errorMapper: createErrorMapper({ ORDER_ALREADY_SHIPPED: 409 }),
  resolvePrincipal: (raw) => authenticate(raw), // lever UnauthorizedError pour refuser
  onError: (error, { requestId, correlationId, operationId, problem }) => {
    if (problem.status >= 500) {
      logger.error({ requestId, correlationId, operationId, error });
    }
  },
  onGuardRefusal: auditGuardRefusals(trail, { clock, ids }), // les refus à la frontière, dans le journal d'audit
  validateResponses: process.env['NODE_ENV'] === 'test', // contrôle les réponses d'après la déclaration
  around: tracedRoutes(), // de @ddd-ts-kit/tracing : le span de la requête, nommé par le gabarit de sa route
  // l'en-tête où le cache partagé placé devant lit les tags ; honoursVary et perTenant : voir Cache HTTP
  cacheTags: { header: CacheTagHeader.xkey },
};
```

`onGuardRefusal(refusal)` est prévenu, et attendu, pour chaque requête HTTP qu'une garde a
refusée avant son contrôleur (`HasRole`, `HasScope`, `TenantMember`, une garde du projet, et un
tenant auquel l'appelant n'appartient pas) : son opération, son *problem* et son contexte
d'exécution. Ces refus n'atteignent aucun cas d'usage, si bien que le hook d'autorisation de
`@ddd-ts-kit/auth` ne les voit jamais ; `auditGuardRefusals(trail, { clock, ids })` de
`@ddd-ts-kit/audit` écrit chacun dans le journal d'audit comme une décision refusée (sauf celui
d'un appelant anonyme). Seul un refus est signalé, une `DomainError` comme `UnauthorizedError`
ou `ForbiddenError` : une garde qui échoue sur une autre erreur est une panne, qui reçoit un 500
et n'est pas signalée. Un refus d'un gestionnaire n'est pas signalé là, et un hook qui échoue ne
change pas la réponse.

`around(route, respond)` enveloppe tout le traitement d'une requête HTTP, de l'authentification
à la réponse, refus compris, et reçoit la route qui a été trouvée (`method`, `path` tel que
déclaré, `operationId`). C'est là qu'un traceur nomme une requête HTTP `POST /orders/:id/lines`
plutôt que par son URL ; ce package ne dépend d'aucune bibliothèque de traçage.

L'identifiant de requête est le `x-request-id` reçu quand il est bien formé, sinon un UUID ; il
est renvoyé dans l'en-tête de réponse `x-request-id` et dans chaque *problem*.

## Le contexte d'exécution d'une requête

`executeRoute` construit un `ExecutionContext` du kernel pour chaque requête HTTP et le remet au
gestionnaire en `context.execution` :

| Champ | Valeur |
|---|---|
| `correlationId` | le `x-correlation-id` reçu quand il est bien formé (lettres, chiffres, `._:-`, 128 au plus), sinon l'identifiant de requête ; renvoyé dans l'en-tête de réponse `x-correlation-id`, sur les *problems* aussi, et donné à `onError` |
| `origin` | `http` |
| `actor`, `session` | d'après la réponse de `resolvePrincipal`, lue structurellement : une `Session` donne les deux, un `Actor` donne l'acteur, toute autre chose est l'acteur anonyme |
| `tenantId` | le tenant que nomme `resolveTenant`, une fois établi que l'appelant lui appartient ; sinon le tenant de l'acteur |
| `locale` | la langue de la session, sinon la langue préférée d'`Accept-Language` |
| `deadline` | l'arrivée plus `requestTimeoutMs`, quand l'option est fixée |

<!-- checked sample -->
```ts
import { principalResolver, type Authenticator } from '@ddd-ts-kit/auth';
import type { ExecuteOptions } from '@ddd-ts-kit/http';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';

declare const authenticator: Authenticator;
declare const app: { resolve<T>(token: abstract new (...args: never) => T): T };

export const options: ExecuteOptions = {
  resolvePrincipal: principalResolver(authenticator), // de @ddd-ts-kit/auth : répond une Session
  executionScope: app.resolve(ExecutionScope), // la portée dans laquelle l'application exécute ses cas d'usage
  clock: app.resolve(Clock),
  requestTimeoutMs: 10_000,
};
```

Avec `executionScope`, chaque gestionnaire s'exécute dans `scope.run(context.execution, ...)` :
les *loggers*, les colonnes d'audit, le cloisonnement par tenant et les en-têtes sortants lisent
le contexte de la requête HTTP sans enveloppe autour du gestionnaire, et aucune route ne peut
l'oublier. `withPrincipal` reste, pour une portée qui vous est propre ; il s'exécute dans la
portée d'exécution. Le pipeline n'interrompt pas un gestionnaire à son échéance : une enveloppe
de délai d'expiration (timeout) ou un appel sortant lit `deadline` et la respecte. `clock` est
l'option qui dit quand une requête HTTP est arrivée, l'horloge du système par défaut.

Les cas d'usage reçoivent toujours l'acteur explicitement : `new PlaceOrder(context.execution.actor, body)`,
ou `actorOf(context.principal)` de `@ddd-ts-kit/auth`, qui lit le même acteur.

### Le tenant d'une requête

Une application multitenant dit où une requête HTTP nomme son tenant, avec `resolveTenant` :

<!-- checked sample -->
```ts
import { firstTenantOf, tenantFromClaim, tenantFromSubdomain, type ExecuteOptions } from '@ddd-ts-kit/http';

export const options: ExecuteOptions = {
  resolveTenant: firstTenantOf(tenantFromSubdomain('app.example.com'), tenantFromClaim()),
  // ou tenantFromHeader('x-tenant-id'), tenantFromPath('tenantId')
};
```

| *Resolver* | Nomme |
|---|---|
| `tenantFromSubdomain(baseDomain)` | l'unique label à gauche du domaine de base dans `Host` (`acme.app.example.com`) ; derrière un proxy, faites-lui transmettre l'hôte d'origine |
| `tenantFromHeader(name?)` | la valeur d'un en-tête, `x-tenant-id` par défaut |
| `tenantFromPath(parameter?)` | un paramètre de chemin, `tenantId` par défaut |
| `tenantFromClaim()` | le tenant de l'accréditation, `Actor.tenantId` |
| `firstTenantOf(...resolvers)` | le premier qui en nomme un |
| `servedTenantOf(resolver, served)` | ce que nomme `resolver`, quand il fait partie des *tenants* servis ; tout autre reçoit un 404 (`NOT_FOUND`), si bien qu'un justificatif qui nomme un *tenant* que le déploiement ne connaît pas (ses *jobs*, son annuaire) n'atteint rien |

Le pipeline contrôle ensuite lui-même l'appartenance, avant toute garde et tout gestionnaire :
un appelant authentifié qui n'appartient pas au tenant nommé (son `tenantId`, ou son attribut
`tenants` pour un acteur de plusieurs tenants) reçoit un 403, si bien qu'un en-tête ou un
sous-domaine choisi par un client n'ouvre jamais les données d'un autre tenant. Un appelant
anonyme garde le tenant auquel il s'est adressé, pour les routes publiques d'un tenant. La garde
`TenantMember` place un groupe de routes derrière un tenant : 401 à l'appelant anonyme, 403 à
une requête HTTP sans tenant ou d'un autre tenant. Le personnel de la plateforme ne la passe
pas : il atteint les tenants par une élévation du kernel (`acrossTenants`), derrière des gardes
qui lui sont propres. Un identifiant de tenant qu'aucun tenant ne peut avoir (`*`, une liste, un
`:`, hors de la grammaire d'`isTenantId`) reçoit un 404 avant que quoi que ce soit le lise, quel
que soit l'appelant.

| Appelant | Tenant nommé par la requête HTTP | Réponse |
|---|---|---|
| anonyme | n'importe lequel | continue, dans le tenant auquel il s'est adressé ; une route `TenantMember` répond 401 |
| membre de `acme` | `acme` | continue, `execution.tenantId` vaut `acme` |
| membre de `acme` | `globex` | 403, avant toute garde et tout gestionnaire, signalé à `onGuardRefusal` |
| membre de `acme` | aucun | continue dans `acme`, le tenant de l'acteur |
| n'importe qui | `*` ou `a,b` | 404 |

## Dans la racine de composition

Le package ne lie et ne résout rien : les routes sont une simple liste et `ExecuteOptions` un
simple objet, tous deux construits là où le serveur démarre. Ce qu'il prend de l'application,
ce sont des ports, résolus par leur classe :

<!-- checked sample -->
```ts
import { defineContextModule, kernelModule, type ContextModule } from '@ddd-ts-kit/di';
import { createApplication } from '@ddd-ts-kit/di/tsyringe';
import { ErrorMapper, createErrorMapper, type ExecuteOptions } from '@ddd-ts-kit/http';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';

declare const orderingModule: ContextModule; // le module d'un contexte délimité

const httpModule = defineContextModule({
  name: 'http',
  register(builder) {
    builder.bind(ErrorMapper).toValue(createErrorMapper({ ORDER_ALREADY_SHIPPED: 409 }));
  },
});

const app = createApplication({ modules: [kernelModule(), httpModule, orderingModule] });

export const options: ExecuteOptions = {
  errorMapper: app.resolve(ErrorMapper),
  executionScope: app.resolve(ExecutionScope),
  clock: app.resolve(Clock),
};
```

| Quoi | Est | Pourquoi |
|---|---|---|
| `ErrorMapper` | un port : une classe abstraite, la classe est le jeton d'injection | un par application, et le serveur et le générateur du contrat doivent recevoir le même ; le lier est facultatif, `createErrorMapper(...)` dans une constante convient aussi |
| `ExecutionScope`, `Clock` | des ports du kernel | résolus depuis l'application et remis dans les options |
| `resolvePrincipal`, `withPrincipal`, `onError`, `requestId` | des fonctions d'`ExecuteOptions` | les hooks d'un serveur, écrits là où il démarre ; le côté injectable de l'authentification est l'`Authenticator` de `@ddd-ts-kit/auth`, que `principalResolver` transforme en `resolvePrincipal` |
| la liste des routes | une valeur, `readonly Route[]` | le résultat de `defineRoutes(...)`, passé au montage et à `generateOpenApi` |
| `Schema` | une interface de `@ddd-ts-kit/validation` | une valeur par partie de la requête HTTP, déclarée dans la route |

## Pagination

Un seul vocabulaire de chaîne de requête et une seule réponse pour chaque recherche, au-dessus
de `PageRequest` et `Page` du kernel : `limit`, `offset` ou `cursor`, et `sort`
(`placedAt,-total` : des champs séparés par des virgules, un `-` en tête pour l'ordre
décroissant).

<!-- checked sample -->
```ts
import { z } from 'zod';
import type { Page, PageRequest } from '@ddd-ts-kit/kernel';
import { defineRoute, pageQuerySchema, pageResponse, pageSchemaOf } from '@ddd-ts-kit/http';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

interface Order {
  readonly id: string;
  readonly placedAt: Date;
  readonly total: number;
}

declare const orders: { search(page: PageRequest<'placedAt' | 'total'>): Promise<Page<Order>> };

const order = zodSchema(z.object({ id: z.string(), placedAt: z.string(), total: z.number() }), { io: 'output' });
const toOrderDto = ({ id, placedAt, total }: Order) => ({ id, placedAt: placedAt.toISOString(), total });

export const searchOrders = defineRoute(
  {
    method: 'GET',
    path: '/orders',
    operationId: 'searchOrders',
    summary: 'Search orders',
    request: { query: pageQuerySchema({ sortable: ['placedAt', 'total'], maxSize: 50 }) },
    responses: { 200: { description: 'A page of orders.', body: pageSchemaOf(order) } },
    security: ['bearer'],
  },
  async ({ query }) => ({
    status: 200, // query est une PageRequest<'placedAt' | 'total'>
    body: pageResponse(await orders.search(query), toOrderDto),
  }),
);
```

| Fonction | Fait |
|---|---|
| `pageRequestFrom(query, options?)` | lit les quatre paramètres, en texte ou déjà convertis, en une `PageRequest` ; lève la `ValidationError` du pipeline, si bien qu'un paramètre erroné reçoit un 422 avec une erreur par paramètre (`query.limit`, `query.sort`...). Pour une route dont le schéma de chaîne de requête contient aussi des filtres : déclarez les quatre paramètres dans ce schéma et appelez-la dans le gestionnaire |
| `pageQuerySchema(options?)` | la même lecture sous forme de `Schema`, pour une route dont toute la chaîne de requête est la page |
| `pageResponse(page, map)` | le corps JSON `{ items, total?, nextCursor? }`, chaque élément passé par `map` |
| `pageRequestParameters(options?)` | le JSON Schema de la chaîne de requête (un paramètre OpenAPI par propriété) ; `properties` se fusionne dans un schéma plus large |
| `pageSchemaOf(itemSchema)` | le `Schema` d'une page d'éléments : valide l'enveloppe et chaque élément, décrit les deux dans le contrat ; partagé sous le nom `<Item>Page` quand l'élément est partagé ([schémas partagés](#schémas-partagés)) |

Les `options` sont les `PageLimits` du kernel (`defaultSize` 20, `maxSize` 100) plus `sortable`,
la liste fermée des champs selon lesquels un client peut trier, et `kind`, la variante d'une
chaîne de requête qui ne nomme ni `offset` ni `cursor` (`offset` par défaut). Sans `sortable`,
un paramètre `sort` est refusé : un client ne choisit jamais une colonne que le port de lecture
n'a pas offerte. `offset` et `cursor` ensemble sont refusés. Ces fonctions ne dépendent d'aucune
bibliothèque de validation ; `pageQuerySchema` et `pageSchemaOf` sont de simples `Schema` et se
placent à côté de schémas zod ou class-validator.

## Filtres et tri

Une seule grammaire de chaîne de requête pour chaque route de recherche, au-dessus des critères
(`Criteria`) du kernel : le port de lecture déclare ce qu'il accepte avec `defineCriteria`, et la
route lit la chaîne de requête en des critères que cette définition accepte, ou répond 422.

```ts
import { criteriaQuerySchema, defineRoute, pageResponse, pageSchemaOf } from '@ddd-ts-kit/http';

const searchAppointments = defineRoute(
  {
    method: 'GET',
    path: '/appointments',
    operationId: 'searchAppointments',
    summary: 'Search appointments',
    request: { query: criteriaQuerySchema(appointmentCriteria) },
    responses: { 200: { description: 'A page of appointments.', body: pageSchemaOf(appointment) } },
    security: ['bearer'],
  },
  async ({ query, context }) => ({
    status: 200, // query est un Criteria<AppointmentRow>
    body: pageResponse(await queries.execute(new SearchAppointments(context.execution.actor, query)), toAppointmentDto),
  }),
);
```

```
GET /appointments?filter[status]=in:booked,confirmed&filter[startsAt]=gte:2026-10-01T00:00:00Z
                 &filter[or][practitionerId]=eq:p-7&filter[or][remote]=true
                 &sort=-startsAt,id&limit=20&cursor=eyJzdGFydHNBdCI6...
```

| Écrit | Signifie |
|---|---|
| `filter[<field>]=<operator>:<value>` | une condition. Les opérateurs sont ceux du kernel : `eq`, `ne`, `in`, `gt`, `gte`, `lt`, `lte`, `contains`, `startsWith`, `isNull`, `between` |
| `filter[<field>]=<value>` | `eq`. Le texte avant le premier deux-points n'est un opérateur que s'il en est le nom : `filter[title]=10:30 review` est un `eq`, et une valeur qui commence comme un opérateur s'écrit `eq:in:the morning` |
| plusieurs `filter[...]` | reliés par ET ; le même champ peut être répété : `filter[seats]=gte:2&filter[seats]=lte:4` |
| `in:<a>,<b>,<c>` | une liste, séparée par des virgules. Une virgule dans une valeur s'écrit `\,`, une barre oblique inverse `\\` ; un deux-points ne demande rien |
| `between:<from>,<to>` | deux valeurs, bornes comprises |
| `isNull:true`, `isNull:false`, `isNull` | sans valeur, ou avec une valeur ; `isNull` seul veut dire `true` |
| `contains:<text>`, `startsWith:<text>` | le texte tel quel, virgules comprises ; sensible à la casse |
| `filter[or][<field>]=...` | les conditions écrites sous `or` sont des alternatives ; sous `not`, les lignes qui les satisfont toutes sont refusées ; `and` existe par symétrie |
| `filter[or][0][<field>]=...&filter[or][0][<other>]=...&filter[or][1][<field>]=...` | un indice tient plusieurs conditions ensemble dans un groupe : `or(and(...), ...)`. Il compte pour un niveau de profondeur de plus, que la définition autorise ou non (`maxDepth`, 1 par défaut) |
| `sort=-startsAt,id` | séparés par des virgules ou répétés, un `-` en tête pour l'ordre décroissant, parmi les champs déclarés triables et le champ de départage |
| `limit`, `offset`, `cursor` | la page, lue par les fonctions de « Pagination » avec les limites de la définition |

Une valeur est lue selon le type que déclare son champ : un nombre en chiffres simples (sans
exposant), `true` ou `false`, un décimal gardé tel qu'il est écrit, un instant en ISO 8601 avec
son fuseau (`2026-10-01T08:00:00Z`, `2026-10-01T10:00:00+02:00`) ou une date seule, prise à
minuit UTC. L'encodage en pourcentage relève du transport : un `+` dans un fuseau s'envoie
`%2B`. `and`, `or`, `not` et les nombres sont des noms réservés : un champ qui porte l'un de ces
noms ne peut pas être filtré. Les deux façons dont un framework remet une chaîne de requête sont
lues : les clés telles qu'écrites (`'filter[status]'`, Express 5 et Fastify par défaut) et déjà
imbriquées (`filter: { status }`, un analyseur `qs`).

Tout ce que la définition ne déclare pas est refusé avec le *problem* 422 du pipeline, une
erreur par faute, aucune ne citant une valeur :

| `path` | `code` |
|---|---|
| `query.filter.<field>` | `unknown_field`, `operator_not_allowed`, `invalid_value`, `in_list_too_long`, `invalid_filter` (pas écrit `filter[<field>]=<operator>:<value>`) |
| `query.filter` | `too_deep`, `empty_group`, `too_many_filters`, `invalid_filter` |
| `query.sort` | `unsortable_field`, `invalid_sort` |
| `query.limit`, `query.offset`, `query.cursor` | `invalid_limit`, `invalid_offset`, `invalid_cursor`, `offset_with_cursor` |

| Fonction | Fait |
|---|---|
| `criteriaQuerySchema(definition, { kind? })` | la lecture sous forme de `Schema`, pour une route dont toute la chaîne de requête est faite des critères |
| `criteriaFrom(query, definition, { kind? })` | la même lecture dans un gestionnaire, pour une route dont le schéma de chaîne de requête contient aussi d'autres paramètres ; lève la `ValidationError` du pipeline |
| `criteriaParameters(definition)` | le JSON Schema de la chaîne de requête, un paramètre OpenAPI par propriété : `filter[<field>]` pour chaque champ qui a un opérateur, avec les opérateurs dans sa description et dans `x-filter-operators`, son type dans `x-filter-type` ; `sort` comme la liste des valeurs qu'il accepte ; `limit`, `offset` et `cursor` |

Le périmètre d'accès de l'acteur n'est pas un paramètre : le gestionnaire de la requête l'ajoute
avec `scoped`, et rien dans une chaîne de requête ne peut le retirer.

## Représentations : JSON, XML, CSV

Une route continue de répondre une valeur typée que vérifie son schéma de réponse ; une
`Representation` la transforme en texte d'un type de média, choisi pour chaque requête HTTP par
l'en-tête `Accept` parmi ceux que la route déclare. L'application enregistre ses représentations
une fois et donne le même ensemble aux adaptateurs et au générateur du contrat :

![Un gestionnaire répond une valeur typée ; le schéma de réponse la vérifie ; l'accès aux champs écarte ce que l'appelant ne peut pas lire ; la négociation sur Accept choisit JSON, XML ou CSV parmi ce que produit la route, ou refuse par un 406 quand aucun n'est en commun](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/representations-and-forms-one-value.fr.svg)

```ts
import { Representations, type ExecuteOptions } from '@ddd-ts-kit/http';

const representations = Representations.standard(); // JSON, XML et CSV
const options: ExecuteOptions = { ...boundary, representations };
const document = generateOpenApi({ info, routes, errorMapper, representations });
```

Une route dit dans quoi elle répond en plus de JSON (`produces`) et dans quoi elle lit un corps en
plus de JSON (`consumes`), sur `@Controller` comme sur `defineRoute` :

```ts
@Controller({
  group: PartnerRoutes, method: 'GET', path: '/:practiceId/appointments', summary: 'Export appointments',
  params, response: { status: 200, body: streamSchemaOf(line) },
  produces: ['text/csv', 'application/xml'],
})
```

| Type de média | Répond | Lit | Remarques |
|---|---|---|---|
| `application/json` | toujours, et en premier : ce que reçoit une requête HTTP sans `Accept` | toujours | comme avant ; un grand entier est écrit en chaîne |
| `application/problem+json` | un refus, sauf si XML a été négocié | | RFC 9457, comme avant |
| `application/xml` | `XmlRepresentation` | `XmlRepresentation`, quand la route le `consumes` | la convention ci-dessous |
| `application/problem+xml` | un refus d'une requête HTTP qui a négocié XML | | `<problem xmlns="urn:ietf:rfc:7807">` |
| `text/csv` | `CsvRepresentation`, pour une page ou une liste de lignes plates | jamais | diffusé en flux ; RFC 4180 |

- **Négociation** (RFC 9110) : le type de média de plus haute qualité parmi ceux que la route
  offre, la plage la plus précise de l'en-tête décidant, l'ordre `application/json` puis
  `produces` départageant les égalités. Aucun acceptable : `406 NOT_ACCEPTABLE` en
  `application/problem+json`, avant que le gestionnaire ne s'exécute. Une route qui en offre plus
  d'un répond avec `Vary: accept`, ajouté au `Vary` de sa politique de cache ou à celui que pose
  son gestionnaire, et documenté dans le contrat. Une route qui ne déclare de schéma de corps
  dans aucune réponse (un fichier, une redirection, aucun contenu) n'est jamais refusée par un
  406 : sa réponse lui appartient, et un `Readable` ou des octets partent tels que le
  gestionnaire les a écrits, sous son type de contenu.
- **Corps** : un corps envoyé dans un type de média que la route consomme est lu par sa
  représentation en la valeur que produit le chemin JSON, puis validé par le même schéma ; un
  corps envoyé dans un type de média que la route ne lit pas est refusé par
  `415 UNSUPPORTED_MEDIA_TYPE`. `mountExpress` installe un analyseur de texte sur chaque route qui
  consomme un autre type de média, `mountFastify` un analyseur de type de contenu, `mountHono` le
  lit comme du texte sous sa `bodyLimit` : rien à ajouter à l'application.
- **Flux** : un gestionnaire qui répond un `AsyncIterable` sous une réponse `streamSchemaOf(item)`
  est écrit élément par élément dans chaque représentation (un seul tableau JSON, une seule
  racine XML, une ligne CSV par ligne), en respectant la contre-pression du client et en
  s'arrêtant quand il s'en va. Chaque élément est lu dans la portée d'exécution de la requête
  HTTP, comme l'a été le gestionnaire. Le premier élément est lu avant l'envoi du statut : un
  curseur qui ne peut pas s'ouvrir reçoit une réponse sous forme de *problem*. Un échec après cela
  coupe court la réponse et est signalé à `onError` avec la corrélation de la requête HTTP et
  `interrupted: true`, pour compter comme une faute du serveur.
- **Une liste en flux lue à travers le bus** : construisez-la avec `everyPage((cursor) =>
  this.queries.execute(new SearchQuery(actor, ..., pageAt(cursor))))`, une requête par page.
  Chaque page passe alors par les *middlewares* du bus : l'autorisation, l'unité de travail et
  sa session de *tenant* limitée à la transaction (la sécurité au niveau des lignes de
  `@ddd-ts-kit/knex` et de `@ddd-ts-kit/drizzle`), le délai d'expiration, le traçage, les
  métriques, la remontée des erreurs. Un gestionnaire de requête qui répond un `AsyncIterable`
  paresseux est lu après le retour du bus, hors de tous ces *middlewares* : ses lectures n'ont ni
  transaction, ni session de *tenant*, ni *span*. L'échéance de la requête HTTP
  (`requestTimeoutMs`) compte depuis son arrivée, si bien qu'un long export a besoin d'une route à
  lui avec une échéance plus longue, ou d'un *job* qui écrit un fichier.
- **Vérifications au montage** : un type de média qu'aucune représentation enregistrée ne
  fournit, une réponse CSV dont les lignes contiennent une liste ou un objet, et un type de média
  consommé que rien ne lit sont refusés par une `DeclarationError` quand les routes sont montées ;
  de même pour une route qui déclare `produces` ou `consumes` quand aucune `representations`
  n'est montée. Un corps dans un type de média consommé qu'un autre analyseur (un *plugin*, un
  *middleware*) a déjà transformé en objet est un défaut, qui reçoit un 500.
- **Le contrat** suit les représentations qu'on lui donne, qui doivent être celles avec lesquelles
  le serveur est monté (`generateOpenApi({ representations })`) : chaque type de média dans
  lequel répond une route est listé sous sa réponse, chaque type de média qu'elle lit sous son
  corps de requête, les types de *problem* sous chaque refus, `406` sur chaque route dont une
  représentation écrit la réponse et `415` sur chaque route qui lit un corps, déclarés dans
  `produces` et `consumes` ou non. Sans `representations`, le contrat ne dit que JSON et aucun
  des deux statuts, comme répond le serveur.
- **Sans `representations`**, rien ne change : chaque réponse est en JSON, quoi que la requête
  HTTP accepte. Avec elles, une réponse dans le JSON du kit reste une valeur dans la
  `RouteResponse` (une *spec* qui appelle `executeRoute` la lit comme avant) ; une autre
  représentation donne des octets dans `body`, ou des morceaux dans `stream`.

### Les règles de sérialisation, les mêmes dans chaque représentation

| Valeur | Écrite comme |
|---|---|
| un instant (`Date`) | ISO 8601 en UTC, `2026-10-13T07:05:00.000Z` |
| un décimal | une chaîne, `decimalText(value)` : `'12.30'`, jamais un nombre binaire qu'un client arrondit |
| un montant | `money(amount, currency)` : `{ amount: '12.30', currency: 'EUR' }`, le code ISO 4217 toujours à côté du montant |
| un identifiant | une chaîne ; un `bigint` est écrit en entier |
| un vocabulaire fermé | son code, la valeur de l'objet `as const` qui le déclare |
| une liste | l'enveloppe de page `{ items, total?, nextCursor? }` de `pageResponse`, ou une liste en flux |

`standard-serialization.spec.ts` tient les trois représentations à cette table.

### La convention XML

Une seule convention, celle par défaut de l'objet XML d'OpenAPI, pour que le contrat décrive le
XML sans rien ajouter :

- l'élément racine est `xml.name` du schéma de réponse, sinon l'identifiant d'opération de la
  route (`<getAppointment>`), et déclare `xmlns:xsi` ;
- une propriété est un élément de son nom, dans l'ordre du schéma ; `xml.name` le renomme,
  `xml.attribute: true` fait d'un scalaire un attribut ; un nom qui ne peut pas être un nom
  d'élément s'écrit `<entry key="two words">` ;
- une liste est dépliée : un élément par item, nommé d'après la propriété (ou `items.xml.name`) ;
  `xml.wrapped: true` les place dans un élément de la propriété, chacun nommé `items.xml.name`
  ou `item` ; une liste à la racine contient des éléments `<item>` ;
- `null` est un élément vide avec `xsi:nil="true"` ; une valeur absente n'est aucun élément ;
- un scalaire est le texte que contiendrait le JSON : un instant en ISO 8601 UTC, `true` ou
  `false`, un nombre tel que JavaScript l'écrit ; un caractère que XML 1.0 ne peut pas porter
  devient U+FFFD.

La lecture suit le schéma : le texte devient un nombre ou un booléen là où le schéma le dit, des
éléments répétés une liste, un élément que le schéma ne déclare pas reste dans la valeur pour
que le schéma le refuse comme il refuse une propriété JSON inconnue. L'analyseur est celui du
*package* et lit les éléments, les attributs, les CDATA, les commentaires, les instructions de
traitement, les entités prédéfinies et les références de caractères ; il refuse une déclaration
de type de document, si bien qu'aucun corps ne peut déclarer d'entité (pas de XXE, pas de bombe
d'expansion), et imbrique au plus 64 éléments de profondeur.

### CSV

Une ligne d'en-tête avec les propriétés d'une ligne dans l'ordre du schéma, puis une ligne par
ligne de données, `\r\n` à la fin de chacune. Une cellule qui contient une virgule, un guillemet,
un saut de ligne ou des espaces autour est mise entre guillemets ; un texte qui commence par `=`,
`+`, `-`, `@`, une tabulation ou un retour chariot est préfixé par `'`, pour qu'un tableur ne
l'exécute pas comme une formule (un nombre ne l'est jamais). `null` et une valeur absente sont
une cellule vide. CSV n'est jamais lu : un import est une route à part, avec son propre schéma de
corps.

### Une représentation à vous

```ts
class YamlRepresentation implements Representation {
  readonly mediaType = 'application/yaml';
  readonly problemMediaType = undefined; // les refus restent en application/problem+json

  write(body: unknown, shape: BodyShape): RepresentedBody { ... }
}

const representations = Representations.of(new XmlRepresentation(), new YamlRepresentation());
```

`write` reçoit la valeur et sa forme (le JSON Schema de la réponse et l'identifiant
d'opération) ; `read`, quand il est présent, retransforme un corps en valeur ; `refuses`, quand
il est présent, dit au montage pourquoi une forme ne peut pas être écrite. Une représentation
donnée pour `application/json` remplace celle par défaut.

## Champs réservés à certains appelants

Un schéma de réponse ou de requête HTTP marque un champ comme exigeant une permission ou une
politique ; le *pipeline* fait le reste, pour chaque représentation, au lieu d'un `if (admin)`
dans un gestionnaire :

```ts
import { fieldDeciderOf, withFieldAccess } from '@ddd-ts-kit/http';

const answer = withFieldAccess(classSchema(AppointmentAnswer), {
  internalNote: {
    read: { permission: schedulingPermissions['appointment.note.read'] },
    write: { policy: notesOfTheirOwnCalendars }, // une politique de @ddd-ts-kit/auth convient telle quelle
    subject: (row) => ({ type: 'calendar', id: row.calendarId }), // l'élément sur lequel porte l'exigence
  },
});

const options: ExecuteOptions = { ...boundary, fieldAccess: fieldDeciderOf({ access: app.resolve(Access), clock }) };
```

| Où | Un champ que l'acteur ne peut pas lire | Un champ que l'acteur peut lire mais pas poser |
|---|---|---|
| une réponse (JSON, XML, CSV, une liste en flux) | écarté ; en CSV la colonne reste, ses cellules vides | gardé |
| un corps de requête HTTP | refusé par `403 FORBIDDEN`, en nommant le chemin (`body.internalNote`) | refusé de la même façon |
| un formulaire décrit par le serveur | absent | en lecture seule |
| le contrat | `x-field-access: { read: { permission }, write: { policy } }` sur la propriété, qui n'est plus listée dans `required` | la même chose |

- `read` absent : quiconque peut appeler la route voit le champ ; `write` absent : quiconque le
  voit peut le poser. Un champ laissé hors d'un corps n'est jamais jugé.
- Une permission est décidée par `access.decideOn(question)` de `@ddd-ts-kit/auth` (sinon
  `access.decide`), les politiques de la permission puis l'autorisateur, comme pour un cas
  d'usage ; une politique nommée sur le champ est interrogée directement, avec l'heure de
  `clock`. `subject` nomme l'élément : omis, l'exigence ne porte sur rien, ce à quoi répond une
  attribution de rôle et pas une relation.
- **Ce qui est enregistré** : un champ posé dans un corps est un acte, et sa décision va au
  journal d'audit (`onDecision`) avec qui a demandé et la corrélation ; un champ montré ou écarté
  d'une réponse ou d'un formulaire ne fait que la façonner, et sa décision n'est pas
  enregistrée. Le cas d'usage continue d'enregistrer sa propre décision.
- **Coût** : chaque exigence est décidée une fois par élément et par requête HTTP, dans la portée
  d'exécution de la requête. Une exigence qui ne porte sur aucun élément est demandée une fois ;
  une page de cent lignes du même agenda demande une fois. Un export en flux dont la règle nomme
  un sujet par ligne demande une décision par ligne distincte (une évaluation des politiques et
  de l'autorisateur, une recherche de relations pour un modèle par relations) ; le juge retient
  les 256 derniers éléments par exigence, si bien que sa mémoire reste bornée quelle que soit la
  longueur de l'export. Pour un long export, préférez une règle sans sujet, ou un modèle de
  lecture qui ne contient déjà que ce que l'appelant peut lire.
- `pageSchemaOf(item)` et `streamSchemaOf(item)` portent les champs restreints de leur élément.
  Un schéma partagé les porte dans un ordre comme dans l'autre :
  `withFieldAccess(sharedSchema('Note', schema), rules)`,
  `withFieldAccess(classSchema(NoteDto, { shared: true }), rules)` et
  `sharedSchema('Note', withFieldAccess(schema, rules))` marquent la définition partagée et
  filtrent la réponse de la même façon.
- **Une politique de cache publique** : une réponse avec un champ que certains appelants ne
  peuvent pas lire diffère selon l'appelant. Quand les routes sont montées, une politique
  `public` sur une telle route est refusée à moins que son `vary` ne nomme `Authorization` ou
  `Cookie`, quel que soit qui peut appeler la route (voir « Cache HTTP »). Les règles
  s'appliquent aux propriétés du schéma donné à `withFieldAccess` ; un objet imbriqué se
  restreint en enveloppant son propre schéma.
- Sans `fieldAccess` dans les options, un champ restreint est écarté de chaque réponse et refusé
  dans chaque corps : rien n'est montré par omission.
- La règle `authz/fields-by-schema` du *checker* et du *plugin* ESLint refuse l'alternative
  écrite à la main, un test sur les rôles de l'acteur sous `application/queries/` ;
  `authz/in-application` en refuse déjà une dans `presentation/`.

## Formulaires décrits par le serveur

Une route qui déclare `form` est décrite comme un formulaire, à partir de ce qu'elle déclare
déjà : son schéma de corps de requête, les champs restreints de ce schéma, et quelques
indications de présentation. `formRoutes` sert un `GET /forms/<operationId>` par route de ce
genre, monté et documenté comme toute route :

![Le schéma du corps de la réservation réserve la note interne ; la route du formulaire demande la permission de réserver et interroge Access à propos de l'agenda ; le praticien titulaire du bureau peut poser chaque champ, un assistant sur un bureau délégué voit la note en lecture seule, un patient qui réserve pour lui-même ne la voit pas, et un assistant sans délégation est refusé par un 403](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/representations-and-forms-one-form-per-caller.fr.svg)

```ts
// presentation/http/appointments/book-appointment/book-appointment.controller.ts, à côté de ses schémas
const form = defineForm<Infer<typeof body>>({
  groups: [{ name: 'when', fields: ['startsAt', 'appointmentTypeId'] }],
  fields: {
    appointmentTypeId: { lookup: 'searchAppointmentTypes' }, // des options venues d'une route GET
    reason: { widget: 'textarea', visibleWhen: { field: 'kind', equals: AppointmentKind.consultation } },
  },
});

@Controller({ ..., body, form })

// la racine de composition
const routes = defineRoutes(appRoutes, formRoutes(appRoutes, { fieldAccess }));
```

`GET /forms/bookAppointment?calendarId=c-1` répond **JSON Forms** (le choix par défaut) :
`schema`, `uischema` et `data`, que chaque moteur de rendu de JSON Forms prend tels quels.
`?format=blocks` répond l'**arbre de blocs neutre** pour un front-end qui a son propre moteur :

```json
{ "type": "form", "operation": "bookAppointment", "method": "POST", "path": "/appointments", "label": "bookAppointment",
  "blocks": [
    { "type": "group", "name": "when", "label": "bookAppointment.when", "blocks": [
      { "type": "field", "name": "startsAt", "label": "bookAppointment.startsAt", "widget": "datetime", "required": true,
        "constraints": { "format": "date-time" } } ] },
    { "type": "field", "name": "internalNote", "label": "bookAppointment.internalNote", "widget": "textarea",
      "required": false, "readOnly": true } ] }
```

| Quoi | Tiré de | Dans l'arbre | Dans JSON Forms |
|---|---|---|---|
| les champs, leur ordre, `required` | le schéma de la requête HTTP | des blocs `field` | `schema` |
| les contraintes | `minLength`, `maxLength`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`, `pattern`, `format`, `minItems`, `maxItems` | `constraints` | les mêmes mots-clés dans `schema` |
| les options | un `enum` du schéma (un vocabulaire fermé), sinon `options` de l'indication | `options`, chacune avec une clé de traduction | `enum` |
| une consultation | `lookup: '<operationId>'` d'une route `GET` | `lookup: { operation, method, path }` | `options.lookup` du contrôle |
| le *widget* | l'indication, sinon le schéma : `select` pour une énumération, `checkbox`, `number`, `datetime`, `date`, `time`, `email`, `list`, `text` | `widget` | le contrôle, `options.multi` pour `textarea`, `options.format: 'radio'` |
| les groupes | `groups` des indications, imbriqués ; un objet imbriqué du corps est un groupe à lui | des blocs `group` | des éléments `Group` |
| un champ montré sous condition | `visibleWhen: { field, equals }` ou `{ field, in }` | `visibleWhen` | une règle `SHOW` |
| un champ exigé sous condition | `requiredWhen` | `requiredWhen` | `allOf` de `if`/`then` dans `schema` |
| les libellés | `<operationId>`, `<operationId>.<group>`, `<operationId>.<field>`, `<operationId>.<field>.<option>` ; `label` d'une indication en remplace un | `label` | `i18n` |
| les valeurs connues d'avance | la chaîne de requête : `?calendarId=c-1`, typée par le schéma | `value` | `data` |

**La description respecte l'appelant.** Un formulaire nomme la permission du cas d'usage qu'il
décrit, demandée comme la demande son `@Requires`, à partir des valeurs de la chaîne de requête :

```ts
const form = defineForm<Infer<typeof body>>({
  requires: {
    permission: schedulingPermissions['appointment.book'],
    subject: (values) => (values.calendarId === undefined ? undefined : { type: 'calendar', id: values.calendarId }),
    context: (values, actor) => ({ selfService: (values.patientId ?? actor.id) === actor.id }),
  },
});
```

Un appelant qui ne peut pas exécuter le cas d'usage est refusé par un 403 (enregistré comme une
décision) et n'apprend rien des champs ; sans `fieldAccess`, personne ne reçoit un formulaire qui
déclare `requires`. Un formulaire sans `requires` est donné à quiconque peut appeler la route.
Ensuite, un champ que l'acteur ne peut pas lire (`withFieldAccess`) est absent, un champ qu'il
peut lire mais pas poser est `readOnly` (`readOnly` dans `schema`, `options.readonly` sur le
contrôle), avec chacun des champs qu'il contient quand c'est un objet, chacun demandé à propos de
l'élément que son `subject` nomme à partir des valeurs de la chaîne de requête ; une valeur de la
chaîne de requête pour un champ que l'appelant ne voit pas n'est pas rendue dans `data`. Le
formulaire d'une route qui n'est pas publique refuse l'appelant anonyme par un 401. Le serveur
valide toujours le corps quand il est envoyé, refuse par un 403 un champ que l'appelant ne peut
pas poser, et le cas d'usage applique toujours ses règles : un formulaire porte la forme et la
présentation, jamais une règle métier.

Des indications qui nomment un champ que le corps ne contient pas, ou une consultation qui n'est
pas une route `GET`, arrêtent `formRoutes` avec une `DeclarationError`, tout comme une propriété
dont le nom contient un point, puisqu'un champ est nommé par son chemin. `formDocumentsOf(routes)`
donne chaque formulaire en entier, dans les deux formats, pour la documentation : un projet
généré par la CLI les écrit dans `openapi/forms/<operationId>.json` à côté de son contrat.

## Express 5

<!-- checked sample -->
```ts
import express from 'express';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import type { Logger } from '@ddd-ts-kit/kernel';
import { mountExpress, problemErrorHandler, problemNotFoundHandler } from '@ddd-ts-kit/http/express';

declare const routes: readonly Route[]; // defineRoutes(...), controllerRoutes(...)
declare const options: ExecuteOptions;
declare const logger: Logger;

const app = express();
app.use(express.json()); // obligatoire : l'adaptateur n'analyse pas les corps
mountExpress(app, routes, options); // un express.Router() convient aussi
app.use(problemNotFoundHandler({ logger })); // après les routes : un chemin qu'aucune ne sert
app.use(problemErrorHandler({ logger })); // en dernier : ce qu'Express refuse avant une route
app.listen(3000);
```

`problemErrorHandler` répond sous forme de *problem* à ce qui atteint Express avant une route du
kit : un corps que `express.json()` ne sait pas analyser reçoit un 400 `MALFORMED_BODY`, un corps
au-delà de sa limite (100 ko par défaut) un 413 `BODY_TOO_LARGE`, une autre erreur porteuse d'un
statut (`status` ou `statusCode`, 4xx ou 5xx) ce statut, avec le code que le kit lui donne
(`UNAUTHORIZED`, `VALIDATION_FAILED` pour 422, `SERVICE_UNAVAILABLE` pour le 503 d'un stockage
en panne) et les en-têtes qu'elle porte pour son client (`WWW-Authenticate`, `Allow`,
`Retry-After`), et toute autre erreur qu'un middleware passe à `next` un 500 `INTERNAL_ERROR`,
sans rien de son message. Un corps vide atteint la route comme absent (`undefined`), comme sur
chaque framework, pour que sa validation décide. Sans lui, le gestionnaire final d'Express répond une page HTML, avec la pile
hors production, et écrit l'erreur sur stderr, corps cité compris. Le gestionnaire écrit dans
`logger` le type de l'erreur (`entity.parse.failed`), le statut et l'identifiant de la requête,
jamais le message ni le corps : un refus comme avertissement, une panne comme erreur.
`problemNotFoundHandler`, après les routes, répond à un chemin qu'aucune route ne sert un 404
`NOT_FOUND` sous forme de *problem*, journalisé en `info` (pas un avertissement par sonde d'un scanner), au lieu de la page HTML
`Cannot GET /path` d'Express.

## Fastify 5

<!-- checked sample -->
```ts
import Fastify from 'fastify';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import type { Logger } from '@ddd-ts-kit/kernel';
import { fastifyRoutes, mountFastify, problemErrorHandler, problemNotFoundHandler } from '@ddd-ts-kit/http/fastify';

declare const routes: readonly Route[];
declare const options: ExecuteOptions;
declare const logger: Logger;

const app = Fastify();
app.setErrorHandler(problemErrorHandler({ logger })); // en premier : ce que Fastify refuse avant une route
app.setNotFoundHandler(problemNotFoundHandler({ logger })); // un chemin qu'aucune route ne sert
mountFastify(app, routes, options);
// ou, comme plugin :
await app.register(fastifyRoutes(routes, options), { prefix: '/api' });
```

`problemErrorHandler` de `@ddd-ts-kit/http/fastify` fait sur Fastify ce que fait celui
d'Express : un corps que son analyseur refuse reçoit un 400 `MALFORMED_BODY`, un corps au-delà de
`bodyLimit` (1 Mio par défaut) un 413 `BODY_TOO_LARGE`, un type de média qu'aucun analyseur ne
lit un 415 `UNSUPPORTED_MEDIA_TYPE`, un hook qui lève une erreur le statut qu'elle porte ou un
500 `INTERNAL_ERROR`, ses en-têtes gardés comme sur Express, au lieu
de `{ statusCode, code, error, message }`, qui porte au client le message d'une erreur
inattendue. Installez-le avant de monter les routes. L'analyseur de Fastify refuse un corps JSON
vide, qu'Express et Hono transmettent comme absent : `mountFastify` enregistre les routes dans un
contexte à elles où un corps vide les atteint comme absent, tout autre corps lu par l'analyseur
JSON de Fastify. `problemNotFoundHandler` répond à un chemin qu'aucune route ne sert un 404
`NOT_FOUND` sous forme de *problem*, au lieu de `{ message, error, statusCode }`.

## Hono 4

<!-- checked sample -->
```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import type { Logger } from '@ddd-ts-kit/kernel';
import { mountHono, problemErrorHandler, problemNotFoundHandler } from '@ddd-ts-kit/http/hono';

declare const routes: readonly Route[];
declare const options: ExecuteOptions;
declare const logger: Logger;

const app = new Hono();
app.onError(problemErrorHandler({ logger })); // un middleware qui lève une erreur, répondu en problem
app.notFound(problemNotFoundHandler({ logger })); // un chemin qu'aucune route ne sert, répondu 404 en problem
mountHono(app, routes, { ...options, bodyLimit: 2 * 1024 * 1024 }); // bodyLimit : 1 Mio par défaut
serve({ fetch: app.fetch, port: 3000 });
```

L'adaptateur lit lui-même le corps JSON, morceau par morceau et jusqu'à `bodyLimit` octets
(1 Mio par défaut, comme Fastify ; Express s'arrête à 100 ko) : un corps plus grand reçoit un 413
sous forme de *problem* (`BODY_TOO_LARGE`), un corps qui n'est pas du JSON un 400
(`MALFORMED_BODY`), les deux avant le pipeline et sans garder le corps en entier. Un corps dans
un type de média que la route consomme (`consumes`) est lu comme du texte sous la même limite,
pour sa représentation ; un autre type de média n'est pas lu, et le pipeline répond 415 quand des
représentations sont montées. Un téléversement et un corps brut sont lus depuis le flux de la
requête HTTP, avec les limites que déclare leur route, et une réponse en flux ou une liste en flux
est envoyée en flux. Un middleware placé devant les routes qui lève une erreur reçoit sa réponse
sous forme de *problem* de `problemErrorHandler`, un 500 `INTERNAL_ERROR` ou le statut d'une
`HTTPException` avec les en-têtes de sa réponse, journalisé comme sur Express, au lieu d'un texte
avec l'erreur écrite sur stderr, et un chemin qu'aucune route ne sert reçoit un 404 `NOT_FOUND`
de `problemNotFoundHandler`, au lieu du texte `404 Not Found`. Une requête HTTP porte `HonoRaw`
comme requête brute (ses en-têtes sous forme d'objet, que lisent les authentificateurs du kit,
et le `Context` de Hono), et un paramètre de chaîne de requête répété est une liste, comme sur
Express et Fastify. L'adaptateur n'importe rien de Hono à l'exécution, et `node:stream` pour les
flux : le kit prouve Node avec `@hono/node-server`, pas Bun, Deno ni un environnement *edge*.

## NestJS

Pas de décorateur par route : un module monte les routes sur le serveur HTTP sous-jacent à
l'initialisation du module, que Nest tourne sur Express ou sur Fastify. Les gestionnaires
reçoivent leurs dépendances par fermeture (closure).

<!-- checked sample: legacy-decorators -->
```ts
import { Module } from '@nestjs/common';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { createRoutesModule } from '@ddd-ts-kit/http/nest';

/** Un jeton de l'application Nest, exporté par OrdersModule. */
abstract class OrderQueries {}

declare class OrdersModule {}
declare function orderRoutes(orders: OrderQueries): readonly Route[];
declare const options: ExecuteOptions;

@Module({
  imports: [
    createRoutesModule(
      { inject: [OrderQueries], useFactory: (orders: OrderQueries) => orderRoutes(orders) },
      { ...options, imports: [OrdersModule] }, // les modules qui exportent les jetons injectés
    ),
  ],
})
export class AppModule {}
```

Un simple tableau convient aussi : `createRoutesModule(routes, options)`. Ces routes
contournent les pipes, les guards, les intercepteurs, les filtres d'exceptions et le préfixe
global de Nest : la validation et la correspondance des erreurs sont celles décrites plus haut.
Utilisez `prefixRoutes` pour un préfixe.

Ce qui atteint Nest avant une route du kit, un corps que son analyseur refuse, un chemin
qu'aucune route ne sert, un middleware en échec, reçoit sa réponse du filtre d'exceptions de
Nest, `{ statusCode, message }`, un message qui peut citer le corps, et est journalisé en entier.
`ProblemExceptionFilter` y répond plutôt sous forme de *problem*, sur Express comme sur Fastify,
et le journalise comme `problemErrorHandler` :
`app.useGlobalFilters(new ProblemExceptionFilter(app.getHttpAdapter(), { logger }))`. Un corps
trop grand reçoit un 413 `BODY_TOO_LARGE`, un chemin qu'aucune route ne sert un 404 `NOT_FOUND`,
un corps qui n'est pas du JSON un 400 `MALFORMED_BODY` comme sur les autres frameworks : Nest
enveloppe l'erreur de son analyseur dans une exception à lui avant tout filtre, que le filtre
reconnaît à son statut, à son message et à une requête JSON dont le corps n'a jamais été lu.

### Contrôleurs Nest servis par le kit

Un projet qui écrit des contrôleurs Nest les garde : `@Controller`, `@Get`, `@Post` et les autres
méthodes, `@Param`, `@Query`, `@Headers`, `@Body` avec une classe DTO, `@HttpCode`, l'injection par
constructeur et les modules. Chaque méthode qui porte un décorateur de route de Nest est une route
du kit, nommée d'après la méthode (`issueInvoice`, résumé `Issue invoice` ; renommer la méthode
renomme la route, sa procédure et la fonction de son client), derrière les *guards* de `@KitRoutes`
sur la classe. `@KitRoute` sur une méthode, facultatif, ajoute ce que Nest ne dit pas :
un autre nom, ses propres *guards*, les refus qu'elle répond, sa réponse. C'est le kit, et non le
routeur de Nest, qui sert la méthode : c'est une route du kit, avec ses *guards*, sa validation, ses
documents *problem*, son traçage et son contrat, et une procédure sur `/rpc` et `/trpc` comme toute
route.

<!-- checked sample: legacy-decorators -->
```ts
import { Body, Controller, Inject, Module, Param, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import type { Actor } from '@ddd-ts-kit/kernel';
import { Authenticated, type ExecuteOptions } from '@ddd-ts-kit/http';
import { createControllersModule, CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';

declare const options: ExecuteOptions;

/** What the controller sends its use case through: here a port of the application. */
abstract class Invoicing {
  abstract issue(invoiceId: string, customerId: string, actor: Actor): Promise<void>;
}

declare const invoicing: Invoicing;

class IssueInvoiceBody {
  @IsString()
  @MinLength(1)
  declare customerId: string;
}

@Controller('invoices')
@KitRoutes({ guards: [Authenticated], tags: ['Invoices'] })
export class InvoicesController {
  constructor(@Inject(Invoicing) private readonly invoicing: Invoicing) {}

  @Post(':invoiceId/issue')
  @KitRoute({ errors: ['INVOICE_ALREADY_ISSUED'] }) // named issueInvoice, after the method
  async issue(
    @Param('invoiceId') invoiceId: string,
    @Body() body: IssueInvoiceBody,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    await this.invoicing.issue(invoiceId, body.customerId, actor);
  }
}

@Module({
  imports: [
    createControllersModule([InvoicesController], {
      ...options,
      providers: [{ provide: Invoicing, useValue: invoicing }],
      schemaOfClass: classSchema,
    }),
  ],
})
export class AppModule {}
```

- `createControllersModule(controllers, options)` enregistre les contrôleurs comme *providers*,
  pour que Nest les construise avec ce qu'ils injectent, et monte chaque méthode portant
  `@KitRoute` sur le serveur HTTP sous Nest. Un contrôleur listé aussi dans les `controllers` d'un
  module Nest est refusé au démarrage : Nest le servirait une seconde fois, par son propre pipeline.
- `@KitRoutes({ guards, tags, errors })` sur la classe est ce que toutes ses routes partagent, comme
  un groupe de routes ; les `guards` de `@KitRoute` passent après. Une route sans *guard* ni d'un
  côté ni de l'autre est refusée : `[Public]` dit qu'elle est ouverte.
- `@CurrentActor()` donne à la méthode l'appelant que l'authentification a résolu
  (`resolvePrincipal`), jamais un appelant construit par le contrôleur ; `@RouteContext()` le
  contexte de la requête (`expectedVersion` sous `ifMatch`) ; `@Upload()` le fichier que déclare
  `upload` de `@KitRoute`, lu en flux et vérifié par le kit contre sa taille et ses types de média,
  jamais analysé par Nest (une méthode qui le prend sans `upload` déclaré est refusée à la
  construction des routes).
- `@KitRoute` porte aussi ce qu'un contrôleur du kit déclare en plus de sa route : `upload`,
  `form` (`defineForm(...)`, servi à `GET /forms/<operationId>`), `produces` et `consumes`,
  `cache`, `ifMatch`.
- Un paramètre qui prend une partie entière est validé par sa classe, lue par `schemaOfClass`
  (`classSchema` de class-validator) : la classe que nomme `withSignatures`, sinon celle que
  TypeScript a enregistrée sous `emitDecoratorMetadata`, que tsx et esbuild n'écrivent pas ; une partie nommée une à une (`@Param('invoiceId')`) est un texte ; `request` de
  `@KitRoute` donne à la place un schéma de n'importe quelle bibliothèque. `response.body` est un
  schéma ou une classe DTO. Une méthode ne répond un corps que si `response.body` le déclare, comme
  le dit le contrat : une méthode qui rend une valeur sans lui est refusée, à la construction des
  routes si TypeScript a enregistré son type de retour, sinon à l'appel (une 500, signalée à
  `onError`), jamais répondue vide.
- `nestControllerRoutes(controllers, { schemaOfClass })` donne les mêmes routes sans le conteneur
  de Nest, pour `generateOpenApi`, `orpcRouter` et `trpcRouter` ; `nestControllerRoute` l'unique
  route d'un contrôleur, pour sa spec.
- Une application qui compose ses routes avant le démarrage de Nest prend
  `nestControllers(controllers, { providers, schemaOfClass })` : ses `routes` rejoignent les autres
  routes de l'application, et `provideControllers(served)` dans le module Nest construit les
  contrôleurs avec ce qu'ils injectent (les bus, comme `{ provide: CommandBus, useValue: commands }`)
  et donne aux routes leurs instances au démarrage. `ddd-ts-kit init --http nest` écrit cette
  composition (`--routes nest`, la valeur par défaut d'un projet Nest sur class-validator).
- `@KitRoutes({ group })` nomme un groupe de routes du kit (`@RouteGroup`) : son préfixe précède les
  chemins de Nest, ses tags, *guards* et codes précèdent ceux de la classe.
- Ce qu'une méthode prend et répond, c'est sa signature : TypeScript efface `Promise<IssuedInvoice>`,
  et n'enregistre les classes des paramètres que sous `emitDecoratorMetadata`, donc
  `withSignatures(controller, { issueInvoice: { body: IssueInvoiceBody, answer: IssuedInvoice } })`
  le dit au pont : la classe DTO de chaque partie qu'un paramètre prend entière (`params`, `query`,
  `headers`, `body`), et la réponse, une classe DTO, un schéma ou `null` pour aucun corps ;
  `request` et `response` de `@KitRoute` l'emportent toujours. Sous `--routes nest`, `ddd-ts-kit`
  lit les signatures et écrit ces appels dans le fichier généré `<context>.controllers.ts`, que le
  module du contexte liste.
- Refusés quand les routes sont construites, parce que le pipeline du kit ne les exécuterait pas :
  `@UseGuards`, `@UsePipes`, `@UseInterceptors`, `@UseFilters`, `@Header`, `@Redirect`, `@Render`,
  `@Sse`, `@Version`, un *pipe* sur un paramètre, `@Req`, `@Res` et les autres paramètres de Nest. Le
  kit lit ce qu'enregistrent les décorateurs de Nest (`@nestjs/common/constants`) ; la forme en est
  vérifiée à chaque lecture, et un test du kit la tient sur la version de Nest avec laquelle il est
  publié : une version de Nest qui la changerait est refusée au démarrage plutôt que lue de travers.

## Procédures oRPC

Une seconde porte vers les mêmes routes, pour un client TypeScript qui appelle des procédures
plutôt que des chemins. `orpcRouter` fait de chaque route une procédure oRPC nommée par son
`operationId`, que `RPCHandler` de `@orpc/server` (1.15 ou plus récent, pair optionnelle) sert
sous un préfixe, à côté des routes elles-mêmes. Chaque appel passe par `executeRoute` avec les
options données à l'adaptateur HTTP : les gardes, le principal, le tenant, la validation, les
permissions du cas d'usage, `onError` et `around` voient un appel sur `/rpc` comme ils voient une
requête.

<!-- checked sample -->
```ts
import express from 'express';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { mountExpress } from '@ddd-ts-kit/http/express';
import { orpcRouter } from '@ddd-ts-kit/http/orpc';
import { RPCHandler } from '@orpc/server/node';

declare const routes: readonly Route[];
declare const options: ExecuteOptions;

const app = express();
const rpc = new RPCHandler(orpcRouter(routes, options));

app.use(express.json()); // oRPC lit le corps qu'Express a déjà analysé
app.use('/rpc', (request, response, next) => {
  const context = { headers: request.headers, raw: request };

  void rpc.handle(request, response, { prefix: '/rpc', context }).then(({ matched }) => {
    if (!matched) {
      next();
    }
  }, next);
});
mountExpress(app, routes, options);
```

Le `context` d'un appel est un `OrpcContext` : les en-têtes de la requête RPC, qui portent les
identifiants, les identifiants de requête et de corrélation et le tenant, et `raw`, ce que lit
`resolvePrincipal` (`{ headers }` quand il est omis, ce que lit `principalResolver` de
`@ddd-ts-kit/auth`). Fastify (`@orpc/server/fastify`), Hono (`@orpc/server/fetch`) et NestJS sur
Express (`@orpc/server/node`) le montent de la même façon ; `ddd-ts-kit init --rpc orpc` écrit le
montage pour le framework du projet, et `ddd-ts-kit sdk` donne à chaque client le contrat oRPC de
son document, sous `<client>/orpc`.

| | Sur `/rpc` |
|---|---|
| Entrée | `{ path, query, header, body }`, l'entrée de l'opération dans le client généré ; `header` passe par-dessus les en-têtes de la requête RPC |
| Réponse | le corps du succès, tel que JSON l'écrit (une date est son texte, comme le dit le contrat) ; un corps binaire est un `Blob` |
| Refus | une `ORPCError` : le `code` et le `status` du *problem*, son `detail` (ou son `title`) comme `message`, le document *problem* comme `data`. C'est une erreur définie quand la route déclare son code (ses codes et ceux de ses gardes, `VALIDATION_FAILED`, les préconditions), avec le statut que lui donne le correspondant d'erreurs de l'application. Un refus que le gestionnaire répond lui-même, sans document *problem*, est `HTTP_<statut>` avec son corps comme `data` |
| `If-Match` | envoyé dans `header`, vérifié comme sur la route |
| En-têtes de la réponse | non rendus : ni `ETag`, ni politique de cache, ni `Location`. Un cache partagé ne garde rien de `/rpc` et n'a rien à purger |
| Représentations | aucune : JSON seulement, donc ni 406 ni 415 pour un type de média |
| Téléversement, corps brut | pas une procédure : seule la route HTTP reçoit un fichier |
| Fichier, liste lue au fil de l'eau | refusés en 406 (`NOT_ACCEPTABLE`, son *problem* comme `data`) et fermés, sans rien lire de plus : ils sont envoyés en flux parce qu'ils peuvent ne pas tenir en mémoire |

Deux routes d'un même `operationId` sont refusées, comme `mountExpress` les refuse : une
procédure cacherait l'autre.

## Procédures tRPC

La même porte pour un client tRPC. `trpcRouter` fait de chaque route une procédure tRPC nommée
par son `operationId`, une *query* pour une route `GET` et une *mutation* pour les autres
méthodes, que les adaptateurs de `@trpc/server` (11.10 ou plus récent, pair optionnelle) servent
sous un point d'entrée comme `/trpc`. Chaque appel passe par `executeRoute` avec les options de
l'adaptateur HTTP, comme un appel d'`orpcRouter`.

<!-- checked sample -->
```ts
import express from 'express';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { mountExpress } from '@ddd-ts-kit/http/express';
import { trpcRouter } from '@ddd-ts-kit/http/trpc';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

declare const routes: readonly Route[];
declare const options: ExecuteOptions;

const app = express();

app.use(express.json()); // tRPC lit le corps qu'Express a déjà analysé
app.use(
  '/trpc',
  createExpressMiddleware({
    router: trpcRouter(routes, options),
    createContext: ({ req }) => ({ headers: req.headers, raw: req }),
  }),
);
mountExpress(app, routes, options);
```

Le contexte d'un appel est un `TrpcContext`, le même qu'`OrpcContext`. Fastify
(`@trpc/server/adapters/fastify`), Hono (`@trpc/server/adapters/fetch`) et NestJS sur Express
(`@trpc/server/adapters/standalone`) le montent de la même façon ; `ddd-ts-kit init --rpc trpc`
écrit le montage pour le framework du projet, et `ddd-ts-kit sdk` donne à chaque client le type du
routeur, sous `<client>/trpc`. Montez-le comme un routeur à part, sans le fusionner dans un autre :
tRPC met en forme une erreur avec le formateur du routeur qu'il sert, et c'est celui de
`trpcRouter` qui place le document *problem* dans `data.problem`.

| | Sur `/trpc` |
|---|---|
| Procédure | une *query* pour une route `GET` (`client.getOrder.query(input)`), une *mutation* pour les autres méthodes (`client.placeOrder.mutate(input)`) |
| Entrée | `{ path, query, header, body }`, comme sur `/rpc` |
| Réponse | le corps du succès, tel que JSON l'écrit |
| Refus | une `TRPCError` du code que tRPC a pour le statut (`UNAUTHORIZED` pour 401, `NOT_FOUND` pour 404, `CONFLICT` pour 409, `UNPROCESSABLE_CONTENT` pour 422 ; `BAD_REQUEST` ou `INTERNAL_SERVER_ERROR` pour un statut sans code), le `detail` (ou le `title`) du *problem* comme `message`, et le document *problem* comme `data.problem`. tRPC a une liste fixe de codes : c'est le `code` du *problem*, celui du kit, qui permet à un client de distinguer les refus. `data.problem` vaut `null` pour un refus que le gestionnaire répond lui-même, sans document *problem* (son message est `HTTP_<statut>`), et pour une erreur de tRPC lui-même, comme une procédure inconnue. La pile d'appels que tRPC ajoute en développement est retirée |
| `If-Match`, en-têtes de la réponse, représentations, téléversements et corps bruts | comme sur `/rpc` |
| Fichier, liste lue au fil de l'eau, corps binaire | refusés en 406 (`NOT_ACCEPTABLE` dans `data.problem`) et fermés : tRPC ne répond qu'en JSON |

## OpenAPI 3.1

<!-- checked sample -->
```ts
import { readFileSync, writeFileSync } from 'node:fs';
import type { ErrorMapper, Route } from '@ddd-ts-kit/http';
import { checkOpenApiDrift, generateOpenApi, stringifyOpenApi } from '@ddd-ts-kit/http/openapi';

declare const routes: readonly Route[]; // la liste même que monte le serveur
declare const errorMapper: ErrorMapper;

const document = generateOpenApi({
  info: { title: 'Orders', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com' }],
  routes,
  securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
  errorMapper, // celui avec lequel tourne le serveur
});

writeFileSync('openapi/openapi.json', stringifyOpenApi(document));

// En CI : régénérer, et échouer sur une différence.
if (checkOpenApiDrift(document, readFileSync('openapi/openapi.json', 'utf8')).drift) {
  process.exit(1);
}
```

`stringifyOpenApi` écrit du JSON indenté de deux espaces. Un projet généré par la CLI versionne
plutôt le contrat en YAML, `openapi/openapi.yaml`, par `stringifyContract(document, 'yaml')` de
`ddd-ts-kit/dist/contracts.js` dans son `scripts/openapi.ts` (`openapi.format` de sa
configuration choisit), et compare le texte qu'il écrit à celui qui est versionné.

Ce qui est généré : des chemins `{param}`, un paramètre par propriété des schémas params, query
et headers, le corps de la requête HTTP, les réponses déclarées, la `security` de chaque
opération (une liste vide pour une route publique), une réponse `application/problem+json` par
statut des `errors` déclarées (les codes listés dans la description et dans `x-error-codes`), un
422 dès que la route valide une entrée, un schéma `Problem` partagé. Les `$defs` locaux des
schémas sont déplacés dans `components.schemas`. Les chemins, les statuts et les clés de
composants sont triés : la sortie ne dépend pas de l'ordre des routes, et le fichier versionné
donne donc des diffs propres.

### Schémas partagés

Un schéma qu'utilisent plusieurs routes est déclaré une fois et arrive une fois dans
`components.schemas` ; chaque route y pointe par `$ref`, qu'elle l'utilise en entier ou à
l'intérieur d'un autre schéma. Un schéma est partagé quand son JSON Schema est une référence à
l'une de ses propres définitions, ce que chaque adaptateur de `@ddd-ts-kit/validation` sait
produire :

| Bibliothèque | Partagé par |
|---|---|
| zod | `.meta({ id: 'Slot' })` sur le schéma zod, utilisé en entier ou imbriqué |
| class-validator | `classSchema(SlotDto, { shared: true })` ; une classe imbriquée est toujours un composant |
| TypeBox | `{ $id: 'Slot' }` dans les options du schéma, utilisé en entier ou imbriqué |
| Standard Schema | les identifiants propres de la bibliothèque par Standard JSON Schema, ou `sharedSchema('Slot', schema)` |
| tout `Schema` | `sharedSchema(name, schema)` de `@ddd-ts-kit/validation` |

Une partie d'un schéma partagé (`slot.pick(...)`, `pickClass(SlotDto, [...])`) est une nouvelle
forme : elle est écrite là où elle est utilisée, sauf si elle est partagée sous un nom qui lui
est propre. Deux formes différentes sous un même nom reçoivent des composants distincts
(`Slot`, `Slot_2`) : pour zod, le côté entrée et le côté sortie d'un schéma à valeurs par défaut
sont deux formes, si bien qu'une réponse reçoit un identifiant qui lui est propre.

La plateforme partage trois schémas qui lui sont propres :

| Schéma | Composant | Pour |
|---|---|---|
| `acceptedSchema` | `Accepted`, `{ id }` | la réponse de chaque route de commande qui renvoie l'identifiant de ce qu'elle a créé ou modifié |
| `pageSchemaOf(item)` | `<Item>Page` quand l'élément est partagé | l'enveloppe d'une réponse de recherche (`items`, `total`, `nextCursor`) |
| le document *problem* | `Problem` | chaque refus, RFC 9457 avec le `code` stable |

Une partie partagée de la requête HTTP (`params`, `query`, `headers`) donne toujours un paramètre
par propriété. Les champs réservés par `withFieldAccess` restent réservés, quel que soit celui des
deux qui enveloppe l'autre.

## Servir le contrat et sa page

<!-- checked sample -->
```ts
import type { Route } from '@ddd-ts-kit/http';
import { openApiDocsRoutes } from '@ddd-ts-kit/http/docs';
import type { OpenApiDocument } from '@ddd-ts-kit/http/openapi';

declare const orderRoutes: readonly Route[];
declare const document: OpenApiDocument; // generateOpenApi(...) de orderRoutes

export const routes = [...orderRoutes, ...openApiDocsRoutes(document, { ui: 'scalar' })];
```

Deux routes publiques (`security: false`), montées à côté des routes de l'application et
absentes du contrat qu'elles affichent :
le document JSON (`jsonPath`, `/openapi.json` par défaut) et une page interactive (`uiPath`,
`/docs` par défaut) rendue par `ui` : `swagger` (par défaut), `scalar` ou `redoc`. La page charge
les ressources de l'interface depuis un CDN public épinglé sur une version majeure ; `assetsUrl`
la fait pointer vers des fichiers auto-hébergés quand elle doit fonctionner hors ligne ou sous
une politique de sécurité du contenu stricte. Un projet généré par la CLI les monte dans
`src/platform/http/with-documentation.ts`, avec l'interface choisie par `--docs-ui`, sauf si sa
configuration désactive la documentation.

## Un contrat découpé en documents

<!-- checked sample -->
```ts
import type { Route } from '@ddd-ts-kit/http';
import { openApiDocumentsRoutes } from '@ddd-ts-kit/http/docs';
import { generateOpenApi, routesByDocument } from '@ddd-ts-kit/http/openapi';

declare const routes: readonly Route[];

const documents = routesByDocument(routes, [
  { name: 'public', title: 'Booking API', groups: ['AppointmentRoutes'] },
  { name: 'back-office', title: 'Back office', tags: ['audit'], operations: ['openPractice'] },
]).map(({ name, title, routes: selected }) => ({
  name,
  document: generateOpenApi({ info: { title: title ?? 'API', version: '1.0.0' }, routes: selected }),
}));

export const served = [...routes, ...openApiDocumentsRoutes(documents, { ui: 'swagger' })];
```

`routesByDocument` donne à chaque document les routes de ses groupes de routes (une route de
contrôleur porte dans `groups` les noms de classe de son groupe et de chaque groupe au-dessus),
de ses tags et de ses opérations ; une route peut figurer dans plusieurs documents, et une route
qui ne figure dans aucun est refusée avec une `DeclarationError` qui la nomme. Chaque document
est généré à part, et contient donc chaque schéma qu'il utilise. `openApiDocumentsRoutes` sert
chacun à `/openapi/<name>.json` avec une page à `/docs/<name>`, et sur `/docs` Swagger UI avec
un sélecteur entre eux (Scalar et Redoc montrent un document à la fois : `/docs` liste leurs
pages) ; un document seul est servi comme le sert `openApiDocsRoutes`. Un projet généré lit les
documents dans `openapi.documents` de `ddd-ts-kit.config.json`, par
`src/platform/http/openapi-documents.ts`.

## Téléversements et fichiers

Un contrôleur qui reçoit un fichier le déclare, et la déclaration est le contrat : le champ, le
poids maximal et les types de média autorisés, que le document OpenAPI énonce
(`multipart/form-data`, `x-max-bytes`, `x-media-types`, les refus 413, 415 et 422).

<!-- checked sample -->
```ts
import { z } from 'zod';
import { AuthorizedCommand, FileUpload, type Actor, type CommandBus, type ReceivedFile } from '@ddd-ts-kit/kernel';
import {
  acceptedSchema,
  Authenticated,
  Controller,
  RouteGroup,
  type Accepted,
  type HttpRequest,
  type IncomingFile,
} from '@ddd-ts-kit/http';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

/** La commande porte le fichier : le bus le dépose avant l'ouverture de la transaction. */
class AttachDocument extends AuthorizedCommand<string> {
  readonly document: FileUpload;

  constructor(
    actor: Actor,
    readonly appointmentId: string,
    file: ReceivedFile,
  ) {
    super(actor);
    this.document = new FileUpload(file, 'appointment-documents');
  }
}

@RouteGroup({ prefix: '/appointments', guards: [Authenticated] })
export class AppointmentRoutes {}

const params = zodSchema(z.object({ appointmentId: z.string().min(1) }));
const body = zodSchema(z.object({ note: z.string().max(200).optional() })); // les champs texte, envoyés avant le fichier

@Controller({
  group: AppointmentRoutes,
  method: 'POST',
  path: '/:appointmentId/document',
  summary: 'Attach a document to an appointment',
  params,
  body,
  upload: { field: 'document', maxBytes: 10_000_000, mediaTypes: ['application/pdf', 'image/*'] },
  response: { status: 201, body: acceptedSchema },
})
export class AttachDocumentController {
  constructor(private readonly commands: CommandBus) {}

  async handle({
    params,
    upload,
    actor,
  }: HttpRequest<{ params: { appointmentId: string }; upload: IncomingFile }>): Promise<Accepted> {
    await this.commands.execute(new AttachDocument(actor, params.appointmentId, upload));

    return { id: params.appointmentId };
  }
}
```

Les routes sont montées avec un lecteur de téléversements, `multipartUploads()` de
`@ddd-ts-kit/http/uploads` (sur busboy, une *peer dependency* facultative : `npm i busboy`) :

<!-- checked sample -->
```ts
import type { Express } from 'express';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { mountExpress } from '@ddd-ts-kit/http/express';
import { multipartUploads } from '@ddd-ts-kit/http/uploads';

declare const app: Express;
declare const routes: readonly Route[];
declare const options: ExecuteOptions;

mountExpress(app, routes, { ...options, uploads: multipartUploads() });
```

Le fichier atteint `handle` pendant qu'il est encore en flux, jamais gardé en entier : la
commande l'enveloppe dans un `FileUpload` du kernel, que `fileUploadsMiddleware` du bus de
commandes dépose avant l'ouverture de la transaction. En chemin, le contenu est
compté, et refusé avec `FILE_TOO_LARGE` (413) au-delà de `maxBytes` ; ses premiers octets doivent
prouver le type de média que le client a déclaré, et ce type doit être accepté, sinon il est
refusé avec `UNSUPPORTED_MEDIA_TYPE` (415), avant qu'un seul octet atteigne le stockage. Une
requête HTTP qui annonce un corps bien plus grand que le fichier permis est refusée avant d'être
lue ; un formulaire sans le fichier, 422. Les champs texte envoyés après le fichier ne sont pas
lus. `fileName` est montré aux personnes, jamais utilisé comme clé : la clé est générée sur le
serveur.

Pour un gros fichier, le client téléverse plutôt directement vers le stockage : une commande
signe un lien de téléversement (`FileStaging.uploadUrl`) et enregistre sur l'agrégat
l'autorisation qu'il renvoie, le client envoie le fichier au lien, et une deuxième commande
confirme à partir de cette autorisation (`FileStaging.confirm(pending)`, qui contrôle la taille
et le type de média de ce qui est arrivé). Un client qui coupe la connexion en cours de route
fait échouer le flux du fichier, si bien qu'un gestionnaire qui l'attend est rejeté au lieu
d'attendre sans fin.

`signedFileRoutes(storage, { prefix: '/files' })` répond aux liens signés d'un stockage que
l'application sert elle-même, le répertoire local du développement ou la mémoire des tests :
`GET /files?token=` télécharge (en pièce jointe, `nosniff`, `no-store`), `PUT /files?token=`
téléverse, refusé avec 413 au-delà de la taille pour laquelle le lien a été signé. Ces routes
sont publiques, le jeton étant l'autorisation, et ne font pas partie du contrat. Avec
Express, montez-les avant `express.json()` : cet analyseur lit d'abord un corps JSON. Un
stockage objet répond à ses propres liens et n'a besoin d'aucune route.

Un gestionnaire peut répondre un flux (`Readable`) comme corps : il est envoyé dans la réponse,
avec son propre `content-type`, quelles que soient les `representations` avec lesquelles les
routes sont montées : aucune représentation n'écrit un fichier, et une route qui ne déclare aucun
schéma de corps n'est jamais refusée par un 406.

## Limites

- Sur Express, Fastify et NestJS, un corps que le framework refuse lui-même (JSON mal formé,
  charge trop grande) est refusé avant que le pipeline s'exécute : il reçoit un *problem* une fois
  `problemErrorHandler` ou `ProblemExceptionFilter` installé, la réponse du gestionnaire
  d'erreurs du framework sinon. L'adaptateur Hono lit lui-même le corps et répond aux deux cas
  par des *problems* (voir « Hono 4 »).
- Les routes sont d'abord JSON. Un gestionnaire peut répondre un texte, des octets ou un flux en
  fixant son propre en-tête `content-type`, auquel aucune représentation ne touche. Un corps de
  requête HTTP n'est reçu en flux que comme téléversement déclaré ou comme corps brut
  (`rawBody`) : les server-sent events et les WebSockets s'écrivent nativement dans le
  framework.
- XML est un rendu fidèle du modèle JSON, pas un outil de conception de vocabulaires XML : aucun
  espace de noms hormis celui par défaut de la racine, pas de contenu mixte, pas de XML Schema.
  Un format de partenaire doté de son propre schéma est une couche anticorruption avec son
  propre *mapper*.
- Une liste en flux ne peut plus être refusée une fois son premier élément écrit : la connexion
  est coupée, le client voit un corps tronqué, et `onError` est prévenu. Les éléments d'un flux
  ne sont pas vérifiés un par un par `validateResponses`.
- CSV est écrit, jamais lu, et ne contient que des lignes plates.
- Une procédure oRPC ou tRPC ne répond que son corps : ce qu'une route dit dans ses en-têtes (un
  `ETag`, une politique de cache, un `Location`) reste à la route HTTP, comme les téléversements,
  les corps bruts, les fichiers, les listes lues au fil de l'eau et les représentations autres que
  JSON (voir « Procédures oRPC ») ; sur tRPC, les corps binaires aussi, et un refus porte le code
  que tRPC a pour son statut, celui du kit étant dans `data.problem`.
- Un formulaire décrit des scalaires, des objets imbriqués et des listes d'un vocabulaire fermé ;
  une liste d'objets est un champ `list` sans détail. La mise en page au-delà des groupes et de
  l'ordre revient au front-end. Une consultation nomme la route des options ; la façon dont le
  front-end l'appelle et libelle ses éléments lui appartient.
- L'accès aux champs juge les champs qu'un schéma déclare, pas les lignes : quelles lignes un
  acteur peut lire est le périmètre d'accès de la requête. Une exigence sur un élément est une
  décision par élément de la réponse, non enregistrée ; il n'y a pas de décision groupée sur
  plusieurs éléments à la fois.
- Un formulaire n'est réservé à qui peut exécuter son cas d'usage que lorsqu'il déclare
  `requires` ; les valeurs de sa chaîne de requête nomment l'élément et le contexte, que
  l'appelant choisit, comme il le ferait dans le corps qu'il envoie.
