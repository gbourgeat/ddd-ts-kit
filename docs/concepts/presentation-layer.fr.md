[English](presentation-layer.md) · **Français**
<!-- translation-of: presentation-layer.md sha256:67312a59c09cf6ef -->

# La couche présentation : contrôleurs, groupes de routes, gardes

**Résumé.** Une route est une classe avec une méthode, `handle`, dont le décorateur est l'unique
déclaration de la route : méthode, chemin, schémas, réponse, codes d'erreur. Un groupe de routes
donne à un ensemble de routes un préfixe, une étiquette et des gardes. Une garde est un contrôle à
la bordure ; une permission reste sur le cas d'usage. Un *mapper* de requête HTTP et un
sérialiseur sont les deux endroits facultatifs qui traduisent. Les règles sont dans la
[référence d'architecture](../ARCHITECTURE.fr.md) (`presentation/*`, `authz/declared`), l'API
dans [`@ddd-ts-kit/http`](../../packages/http/README.fr.md).

## Une classe par route

```ts
// presentation/http/appointments.routes.ts
import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';

@RouteGroup({ prefix: '/appointments', tags: ['scheduling'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class AppointmentsRoutes {}
```

```ts
// presentation/http/appointments/book-appointment/book-appointment.controller.ts
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { BookAppointmentBody } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.body';
import type { BookAppointmentMapper } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.mapper';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';

const body = classSchema(BookAppointmentBody);

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/',
  summary: 'Book appointment',
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: [
    'UNKNOWN_CALENDAR',
    'UNKNOWN_APPOINTMENT_TYPE',
    'OUTSIDE_AVAILABILITY',
    'OFF_GRID',
    'BOOKING_TOO_LATE',
    'BOOKING_TOO_FAR',
    'SLOT_TAKEN',
    'PATIENT_LIMIT_REACHED',
  ],
})
export class BookAppointmentController {
  constructor(
    private readonly commands: CommandBus,
    private readonly mapper: BookAppointmentMapper,
  ) {}

  async handle(request: HttpRequest<{ body: BookAppointmentBody }>): Promise<Accepted> {
    const id = await this.commands.execute(this.mapper.map(request));

    return { id };
  }
}
```

```ts
// presentation/http/appointments/book-appointment/book-appointment.mapper.ts
import { RequestMapper, type HttpRequest } from '@ddd-ts-kit/http';
import { BookAppointmentCommand } from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.command';
import type { BookAppointmentBody } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.body';

/** Le seul endroit qui transforme la requête HTTP de réservation et son acteur en commande. */
@RequestMapper()
export class BookAppointmentMapper
  implements RequestMapper<HttpRequest<{ body: BookAppointmentBody }>, BookAppointmentCommand>
{
  map({ actor, body }: HttpRequest<{ body: BookAppointmentBody }>): BookAppointmentCommand {
    const { calendarId, appointmentTypeId, startsAt, patientId } = body;
    // Sans patient désigné, l'appelant réserve pour lui-même.
    const wish = { patientId: patientId ?? actor.id, appointmentTypeId, startsAt: new Date(startsAt) };

    return new BookAppointmentCommand(actor, calendarId, wish);
  }
}
```

Ces trois fichiers viennent de l'application d'exemple
([`examples/scheduling`](../../examples/scheduling)). `acceptedSchema` et son type `Accepted`
(`{ id: string }`) sont la réponse d'une écriture qui rend un identifiant, fournis par
`@ddd-ts-kit/http` pour qu'aucun contexte ne les déclare à nouveau.

Le décorateur déclare, le *pipeline* de la requête HTTP valide avec les mêmes schémas, et le
contrat OpenAPI est généré à partir d'eux : rien ne répète la route. Le constructeur indique les
dépendances, comme pour toute classe déclarée ; le fichier généré du contexte enregistre
`injected(BookAppointmentController, [CommandBus, BookAppointmentMapper])` à partir de la
signature, et la racine de composition monte chaque contrôleur déclaré avec
`controllerRoutes(resolve(DeclaredEdges).of('controller'), { resolve })`. Un contrôleur ne
connaît aucun *framework* : il devient une `Route`, qu'Express, Fastify, Hono et NestJS montent
comme ils montent n'importe quelle route, si bien que la validation, les documents *problem*, le
*mapper* d'erreurs et le *span* de la requête HTTP sont ceux d'une route fonction.

### La même forme, en un seul module

L'exemple lit ses schémas depuis des classes `class-validator`. Toute bibliothèque de validation
donne la même valeur `Schema<T>` ; voici une route entière avec `zod`, le groupe, le contrôleur et
la commande qu'il envoie dans un seul module, pour qu'elle se lise d'un coup (un projet garde un
fichier par rôle) :

<!-- checked sample -->
```ts
import { z } from 'zod';
import { acceptedSchema, Authenticated, Controller, RouteGroup, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import { AuthorizedCommand, type Actor, type CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

// application/commands/cancel-appointment/cancel-appointment.command.ts (déclarée ici pour l'exemple)
declare class CancelAppointmentCommand extends AuthorizedCommand<string> {
  constructor(actor: Actor, appointmentId: string, reason: string);
}

// presentation/http/appointments.routes.ts
@RouteGroup({ prefix: '/appointments', tags: ['scheduling'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class AppointmentsRoutes {}

// presentation/http/appointments/cancel-appointment/cancel-appointment.controller.ts
const params = zodSchema(z.object({ appointmentId: z.string().min(1) }));
const body = zodSchema(z.object({ reason: z.string().min(1) }));

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/:appointmentId/cancellation',
  summary: 'Cancel appointment',
  params,
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['APPOINTMENT_NOT_FOUND', 'APPOINTMENT_ENDED'],
})
export class CancelAppointmentController {
  constructor(private readonly commands: CommandBus) {}

  // Les parties lues sont typées d'après les schémas : Infer<typeof params> vaut { appointmentId: string }.
  async handle(request: HttpRequest<{ params: Infer<typeof params>; body: Infer<typeof body> }>): Promise<Accepted> {
    const { actor, params: { appointmentId }, body: { reason } } = request;
    const id = await this.commands.execute(new CancelAppointmentCommand(actor, appointmentId, reason));

    return { id };
  }
}
```

La route répond à `POST /appointments/:appointmentId/cancellation` : le préfixe du groupe, puis le
chemin du contrôleur. Son contrat liste `UNAUTHORIZED` (venu d'`Authenticated`), `FORBIDDEN` (venu
du groupe) et les deux codes du contrôleur.

## Ce qui arrive à une requête HTTP

![Le chemin d'une requête HTTP par une route de contrôleur : l'adaptateur HTTP, la validation par les schémas, le contexte d'exécution, les gardes, le contrôleur, son mapper de requête HTTP, le bus de commandes qui vérifie la permission, le gestionnaire, puis le sérialiseur et la réponse ; un refus à n'importe quelle étape devient un document problem](../assets/diagrams/presentation-layer-request-path.fr.svg)

1. **L'adaptateur HTTP** du *framework* (Express, Fastify, Hono ou NestJS) passe la requête HTTP
   brute au *pipeline* de `@ddd-ts-kit/http`, qui identifie l'appelant. Les gardes qui décident
   sur l'appelant seul (`Authenticated`, `HasRole`, `HasScope`, l'appelant anonyme de
   `TenantMember`) le refusent dès ici, par 401 ou 403, avant que rien de la requête HTTP ne soit
   lu : un appelant refusé pour ce qu'il est n'apprend jamais ce que la route attend, et son
   téléversement n'est jamais reçu.
2. **Chaque partie déclarée passe par son schéma** (`params`, `query`, `headers`, `body`) ; tous
   les problèmes sont signalés ensemble, en un seul problème `VALIDATION_FAILED` (422).
3. **Le contexte d'exécution** de la requête HTTP est construit : son acteur, sa session, son
   *tenant*, son identifiant de corrélation. Un *tenant* que la requête nomme et auquel un
   appelant authentifié n'appartient pas est refusé dès cette étape (403), et signalé comme un
   refus de garde. Tout ce qui suit s'exécute à l'intérieur.
4. **Les gardes s'exécutent dans l'ordre** : celles du groupe parent, du groupe, puis du
   contrôleur. La première qui lève une erreur répond 401 ou 403, et le contrôleur n'est jamais
   appelé. Une garde qui lit le chemin s'exécute ici, sur des paramètres validés.
5. **Le contrôleur** : `handle` reçoit les parties validées et l'acteur. Il ne décide de rien et
   passe la requête HTTP plus loin.
6. **Le *mapper* de requête HTTP** transforme la requête HTTP et son acteur en commande ou en
   requête.
7. **Le bus** vérifie la permission que le message déclare avec `@Requires` (403 quand elle est
   refusée).
8. **Le gestionnaire** (handler) s'exécute : le cas d'usage, qui peut refuser par une erreur du
   domaine.
9. **Le sérialiseur**, quand le contrôleur en a un, transforme le résultat, revenu par le
   contrôleur, en corps de réponse.
10. **La réponse** porte le statut que la déclaration indique, et ce corps.

Un refus à n'importe quelle étape (un problème de validation, une garde, une permission, une
erreur du domaine du cas d'usage) est transformé en document *problem* (RFC 9457) par le *mapper*
d'erreurs, avec son code d'erreur ; le contrat de la route liste les codes qu'elle peut renvoyer.

## Comment le compilateur tient `handle` à la déclaration

Un décorateur ne peut pas changer le type de la classe qu'il décore, mais il peut refuser une
classe. `@Controller(spec)` est typé comme une fonction qui n'accepte qu'une classe dont `handle`
prend ce que produisent les schémas de `spec` et renvoie le corps que déclare `spec.response` :

- `handle` lit `HttpRequest<{ body: BookAppointmentBody }>` : la déclaration doit avoir un schéma
  `body` dont la sortie lui est assignable. Un contrôleur qui lit une partie que sa déclaration ne
  valide pas, ou qui la lit sous un autre type, ne compile pas.
- `handle` renvoie le type de sortie de `response.body`, ou rien quand la réponse n'a pas de
  corps.
- La requête HTTP est contravariante : `handle` ne nomme que les parties qu'il lit, et peut ne
  prendre aucun paramètre.

Au lieu d'un contrôleur qui lit un corps que sa déclaration ne valide pas :

```ts
// Refusé sur le décorateur : `handle` lit un corps, et la déclaration n'a pas de schéma `body`.
@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/:appointmentId/confirmation',
  summary: 'Confirm appointment',
  response: { status: 201, body: acceptedSchema },
})
export class ConfirmAppointmentController {
  handle({ body }: HttpRequest<{ body: { appointmentId: string } }>): Accepted {
    return { id: body.appointmentId };
  }
}
```

écrivez la partie qu'il lit dans la déclaration, et lisez-la avec le type que produit son schéma :

<!-- checked sample -->
```ts
import { z } from 'zod';
import { acceptedSchema, Authenticated, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import { AuthorizedCommand, type Actor, type CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

// application/commands/confirm-appointment/confirm-appointment.command.ts (déclarée ici pour l'exemple)
declare class ConfirmAppointmentCommand extends AuthorizedCommand<string> {
  constructor(actor: Actor, appointmentId: string);
}

const params = zodSchema(z.object({ appointmentId: z.string() }));

@Controller({
  method: 'POST',
  path: '/appointments/:appointmentId/confirmation',
  summary: 'Confirm appointment',
  guards: [Authenticated],
  params,
  response: { status: 201, body: acceptedSchema },
})
export class ConfirmAppointmentController {
  constructor(private readonly commands: CommandBus) {}

  async handle({ actor, params: { appointmentId } }: HttpRequest<{ params: Infer<typeof params> }>): Promise<Accepted> {
    const id = await this.commands.execute(new ConfirmAppointmentCommand(actor, appointmentId));

    return { id };
  }
}
```

L'erreur est signalée sur le décorateur, dans les deux modes de décorateurs (standard et
`experimentalDecorators`) et avec toute bibliothèque de validation, puisqu'un schéma est une
valeur `Schema<T>` quoi qui l'ait construit : `zodSchema(..)`, `classSchema(Class)`,
`standardSchema(..)`, `customSchema(..)`.
`packages/http/test/fixtures/controllers/controller-mistakes.ts` contient six erreurs qui ne
doivent pas compiler, construites par TypeScript 6 et 7 dans chaque mode.

Les options qui ont été comparées :

| Option | Ce qu'elle coûte | Verdict |
|---|---|---|
| un objet contrat typé partagé par le décorateur et `implements HttpController<typeof contract>` | une seconde déclaration à côté de la classe, et `implements` compare un paramètre de méthode de façon bivariante : un mauvais type de corps est accepté | rejetée |
| une classe de base ou une fabrique (factory), `extends controller(contract)` | la même seconde déclaration, de l'héritage pour une vérification de type, et une méthode qui en redéfinit une autre ne reçoit pas les types de ses paramètres | rejetée |
| l'inférence du contrat à partir de `handle` | les schémas seraient dérivés de types, qui n'existent pas à l'exécution | impossible |
| le décorateur contraint la classe | une seule déclaration ; le paramètre de `handle` est annoté à la main, avec les classes ou `Infer<typeof schema>` | retenue |

Aucune option ne donne à `handle` les types de ses paramètres sans annotation : TypeScript n'infère
les paramètres d'une méthode qu'à partir de la méthode elle-même.

## Groupes de routes et gardes

Un groupe est une classe vide portant `@RouteGroup({ prefix, tags, guards, errors, parent })`. Un
groupe enfant hérite du préfixe, des étiquettes, des gardes et des codes d'erreur de son parent et
y ajoute les siens. Un contrôleur nomme son groupe et peut ajouter des gardes. Un contrôleur sans
groupe ni garde est refusé, à la définition de sa classe et par `authz/declared` : aucune route
n'est ouverte par omission. `guards: [Public]` dit qu'une route est ouverte, et `Public` reste
seule.

<!-- checked sample -->
```ts
import { HasRole, RouteGroup, TenantMember } from '@ddd-ts-kit/http';

// Toutes les routes d'un cabinet : l'appelant appartient au tenant que nomme le chemin.
@RouteGroup({ prefix: '/practices/:practiceId', tags: ['scheduling'], guards: [TenantMember], errors: ['FORBIDDEN'] })
export class PracticesRoutes {}

// Hérite du préfixe, de l'étiquette, de TenantMember et de FORBIDDEN, puis ajoute les siens : un contrôleur
// de ce groupe au chemin '/' répond à /practices/:practiceId/agenda, derrière les deux gardes dans l'ordre.
@RouteGroup({ parent: PracticesRoutes, prefix: '/agenda', guards: [HasRole('practitioner', 'assistant')] })
export class PracticeAgendaRoutes {}
```

Une garde est `{ documents?, check(request) }` : elle rend la main pour laisser passer la requête
HTTP et lève `UnauthorizedError` ou `ForbiddenError` pour la refuser. Ce qu'elle documente (les
codes d'erreur, un schéma de sécurité qui lui est propre) rejoint le contrat de chaque route
qu'elle protège, si bien que les réponses 401 et 403 sont dites une seule fois. Le kit fournit
`Authenticated`, `Public`, `HasRole(...roles)`, `HasScope(...scopes)` et `TenantMember`, qui
lisent l'`Actor`, la `Session` et le *tenant* de la requête HTTP. Une garde qui n'a besoin de rien
est une simple valeur ; une garde du projet qui a besoin d'une dépendance est une classe déclarée,
construite par la racine de composition à partir de son constructeur :

<!-- checked sample -->
```ts
// presentation/http/guards/api-key.guard.ts
import { Guard, UnauthorizedError, type GuardRequest } from '@ddd-ts-kit/http';

// application/ports/api-keys.port.ts (déclaré ici pour l'exemple) : un port, jamais un repository.
export abstract class ApiKeys {
  abstract isActive(key: string): Promise<boolean>;
}

@Guard()
export class ApiKeyGuard implements Guard {
  readonly documents = { errors: ['UNAUTHORIZED'], security: ['apiKey'] };

  constructor(private readonly keys: ApiKeys) {}

  async check({ headers }: GuardRequest): Promise<void> {
    const key = headers['x-api-key'];

    if (typeof key !== 'string' || !(await this.keys.isActive(key))) {
      throw new UnauthorizedError('An active API key is required');
    }
  }
}
```

Une garde décide dans `check`, une fois la requête HTTP validée, et lit donc des paramètres
typés. Une garde qui décide sur l'appelant seul déclare aussi `admit(admission: GuardAdmission)`,
qui reçoit la route, les en-têtes bruts, l'acteur et la session, et s'exécute avant que la
requête HTTP soit lue : les gardes du kit qui n'ont besoin de rien d'autre (`Authenticated`,
`HasRole`, `HasScope`) le font, et `TenantMember` y refuse l'appelant anonyme. Les admissions
s'exécutent dans l'ordre des gardes, puis les contrôles, et `guards: 'skip'` laisse les deux de
côté. Une route écrite à la main, comme objet `Route`, peut déclarer `admit` elle-même.

Un refus d'une garde n'atteint jamais un cas d'usage, donc le *hook* d'autorisation du bus ne le
voit pas : `onGuardRefusal` du *pipeline* est informé de chacun. `auditGuardRefusals` de
`@ddd-ts-kit/audit` écrit les refus d'un appelant identifié dans le
[journal d'audit](audit-trail.fr.md) ; un appelant qui n'a présenté aucun justificatif n'est
personne à qui demander des comptes, donc ses refus relèvent du journal d'accès et de la
limitation de débit.

**Le partage.** Une garde répond à « cet appelant peut-il seulement utiliser ces routes ? »,
à partir de l'appelant et de la requête HTTP. Une permission répond à « cet acteur peut-il faire
cela à cet élément ? », et elle se déclare sur la commande ou la requête avec `@Requires`, décidée
par le bus. Un *job*, un gestionnaire d'événement ou un autre transport qui envoie la même commande
ne passe jamais par une garde et reste tenu à la permission. Une garde ne remplace donc jamais une
permission, et ne charge jamais un agrégat (`presentation/guard-at-the-edge`).

![Trois émetteurs de la même commande : une requête HTTP passe les gardes de ses routes, puis son contrôleur ; un job planifié et un gestionnaire d'événement envoient la commande directement. Tous trois rencontrent la permission que le bus de commandes vérifie avant le gestionnaire](../assets/diagrams/presentation-layer-guard-and-permission.fr.svg)

Au lieu d'une garde qui charge le rendez-vous pour décider si l'appelant peut l'annuler :

```ts
// presentation/http/guards/own-appointment.guard.ts
import { ForbiddenError, Guard, type GuardRequest } from '@ddd-ts-kit/http';
// Refusé par presentation/guard-at-the-edge : une garde n'importe rien de domain/, ni aucun repository.
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';

// Du reste, le job qui annule les rendez-vous non confirmés ne passerait jamais par cette garde.
@Guard()
export class OwnAppointmentGuard implements Guard {
  constructor(private readonly appointments: AppointmentRepository) {}

  async check({ actor, params }: GuardRequest): Promise<void> {
    const appointment = await this.appointments.get(String(params['appointmentId']));

    if (appointment.patientId !== actor.id) {
      throw new ForbiddenError('Not your appointment');
    }
  }
}
```

écrivez le droit sur la commande, là où chaque émetteur le rencontre, et laissez une politique
(policy) de l'application le décider à partir de l'élément que vise la commande :

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';

// application/authorization/scheduling.permissions.ts
export const schedulingPermissions = definePermissions('scheduling', {
  'appointment.cancel': { description: 'Patient cancels until notice' },
});

// application/commands/cancel-appointment/cancel-appointment.command.ts
@Requires(schedulingPermissions['appointment.cancel'], {
  resource: (command: CancelAppointmentCommand) => ({ type: 'appointment', id: command.appointmentId }),
})
export class CancelAppointmentCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
    readonly reason: string,
  ) {
    super(actor);
  }
}
```

`HasScope('invoices:read')` réserve des routes à une session à laquelle chaque *scope* nommé a été
accordé : les authentificateurs JWT et Keycloak remplissent `Session.scopes` à partir du *claim*
`scope` (ou `scp`), et un projet déclare son vocabulaire en augmentant `SessionScopes`, si bien
qu'un *scope* mal orthographié ne compile pas :

```ts
declare module '@ddd-ts-kit/kernel' {
  interface SessionScopes {
    readonly 'invoices:read': true;
    readonly 'invoices:write': true;
  }
}
```

Un *scope* borne ce qu'une application cliente peut faire pour le compte de l'utilisateur, jamais
ce que l'utilisateur peut faire : la permission décide toujours. Voir
[Choisir le contrôle d'accès](../guides/choosing-access-control.fr.md).

## Mapper et sérialiseur

Les deux sont facultatifs et les deux sont des classes déclarées, si bien qu'un contrôleur les
reçoit par son constructeur. `RequestMapper<Request, Message>` a une méthode, `map` : le seul
endroit qui transforme la requête HTTP et son acteur en commande ou en requête.
`Serializer<Result, Body>` a une méthode, `serialize` : le seul endroit qui transforme un résultat
en ce que lit un client. Aucune des deux signatures ne nomme HTTP au-delà du type de la requête,
si bien qu'un autre transport ou un autre format écrit les siens à côté, et le cas d'usage ne bouge
pas. Un contrôleur qui ne fait que transmettre n'a ni l'un ni l'autre
(`presentation/controller-delegates` dit ce qu'un contrôleur peut recevoir : le bus de sa méthode,
`CommandBus` pour une écriture et `QueryBus` pour une lecture, un *mapper* et un sérialiseur).

Le *mapper* de la réservation est montré plus haut. Un sérialiseur transforme le résultat d'une
requête en corps de réponse : les instants deviennent du texte ISO 8601, et ce que le client ne
doit pas lire est laissé de côté.

<!-- checked sample -->
```ts
// presentation/http/appointments/get-appointment/get-appointment.serializer.ts
import { Serializer } from '@ddd-ts-kit/http';

// Le résultat de la requête (application) et le corps de la route (présentation), déclarés ici pour l'exemple.
interface AppointmentView {
  readonly id: string;
  readonly startsAt: Date;
  readonly status: string;
  readonly internalNote: string;
}

interface AppointmentAnswer {
  readonly id: string;
  readonly startsAt: string;
  readonly status: string;
}

@Serializer()
export class GetAppointmentSerializer implements Serializer<AppointmentView, AppointmentAnswer> {
  serialize({ id, startsAt, status }: AppointmentView): AppointmentAnswer {
    // La note interne du cabinet reste hors de la réponse.
    return { id, startsAt: startsAt.toISOString(), status };
  }
}
```

Un sérialiseur décide des champs d'un corps, jamais de qui les voit : un champ réservé à
certains appelants est marqué sur le schéma de réponse (`withFieldAccess`), et les types de média
dans lesquels une route répond sont les `produces` de sa déclaration, tous deux expliqués dans
[représentations, accès aux champs et formulaires](representations-and-forms.fr.md).

## Quand garder une route fonction

`defineRoute` reste pris en charge et les deux formes coexistent dans un même projet. Gardez une
fonction quand la route répond par plusieurs statuts de succès, pose ses propres en-têtes de
réponse (`Location`), renvoie des octets ou du texte, ou est construite à partir de données à l'exécution :
un contrôleur a une seule réponse et renvoie son corps. Les en-têtes de cache ne sont pas une
raison : un contrôleur déclare sa politique de cache, ses validateurs et ses étiquettes de cache
(`cache`), et le *pipeline* y répond ([Cache HTTP](http-caching.fr.md)).

Une route fonction indique elle-même sa `security` (il n'y a pas de groupe dont l'hériter), et son
gestionnaire lit l'acteur dans le contexte d'exécution. Ici, un `PUT` qui répond 201 avec un
`Location` quand il crée le calendrier et 200 quand le calendrier existait déjà :

<!-- checked sample -->
```ts
import { z } from 'zod';
import { defineRoute } from '@ddd-ts-kit/http';
import { AuthorizedCommand, type Actor, type CommandBus } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

// Déclarés ici pour l'exemple : la commande répond si elle a créé le calendrier.
declare class EnsureCalendarCommand extends AuthorizedCommand<boolean> {
  constructor(actor: Actor, calendarId: string);
}
declare const commands: CommandBus;

const params = zodSchema(z.object({ calendarId: z.string().min(1) }));
const calendar = zodSchema(z.object({ id: z.string() }), { io: 'output' });

export const putCalendar = defineRoute(
  {
    method: 'PUT',
    path: '/calendars/:calendarId',
    operationId: 'putCalendar',
    summary: 'Create a calendar, or keep the one there',
    request: { params },
    responses: {
      201: { description: 'Created.', body: calendar },
      200: { description: 'Already there.', body: calendar },
    },
    security: ['bearer'],
  },
  async ({ params: { calendarId }, context }) => {
    const created = await commands.execute(new EnsureCalendarCommand(context.execution.actor, calendarId));
    const body = { id: calendarId };

    return created ? { status: 201, body, headers: { Location: `/calendars/${calendarId}` } } : { status: 200, body };
  },
);
```
