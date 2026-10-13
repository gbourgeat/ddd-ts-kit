[English](http-frameworks.md) · **Français**
<!-- translation-of: http-frameworks.md sha256:6407a74f980e7b6a -->

# Frameworks HTTP : Express, Fastify, Hono, NestJS

**Résumé.** Dans ce kit, une route est déclarée une fois, comme des données plus un
gestionnaire (handler), et montée sur Express 5, Fastify 5, Hono 4 (sur Node) ou NestJS par un
adaptateur de `@ddd-ts-kit/http`. Les quatre passent par le même *pipeline* (validation,
gestionnaire, traduction des erreurs), si bien que le framework décide de la façon dont le
serveur est exploité, pas de la façon dont on atteint un cas d'usage. Quel framework va avec
quelle bibliothèque de validation, chiffres mesurés à l'appui, se trouve dans
[paires de contrat](contract-pairs.fr.md). Le choix repose donc sur les habitudes de l'équipe,
l'écosystème dont elle a besoin et la part du framework qu'elle est prête à laisser inutilisée.
Avec NestJS, le prix de routes indépendantes du framework est le plus élevé : elles contournent
l'essentiel de ce qui fait d'un contrôleur Nest un contrôleur Nest.

## Ce qu'on demande ici au framework

La couche présentation est mince par règle (`layer/presentation-no-infrastructure`,
`authz/in-application` dans [ARCHITECTURE.md](../ARCHITECTURE.fr.md)) : une route valide la
forme de son entrée, construit une commande ou une requête portant l'acteur, l'envoie sur un bus
et traduit la réponse. Dans le domaine fil rouge :

![Quatre adaptateurs, un seul pipeline : Express, Fastify, Hono et NestJS confient chacun la requête HTTP brute à executeRoute, qui résout le principal, valide les parties de la requête HTTP, construit le contexte d'exécution, exécute le gestionnaire qui envoie la commande sur le bus, et répond ; un refus à n'importe quelle étape passe par le mapper d'erreurs et reçoit pour réponse un problème RFC 9457](../assets/diagrams/http-frameworks-one-pipeline.fr.svg)

La route est écrite une fois, comme des données plus un gestionnaire, et ne connaît aucun
framework :

<!-- checked sample -->
```ts
// contexts/scheduling/presentation/http/book-appointment.route.ts
import { z } from 'zod';
import { acceptedSchema, defineRoute, defineRoutes } from '@ddd-ts-kit/http';
import { AuthorizedCommand, type Actor, type CommandBus } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

// application/commands/book-appointment/book-appointment.command.ts (déclarée ici pour l'exemple)
declare class BookAppointment extends AuthorizedCommand<string> {
  constructor(actor: Actor, practitionerId: string, startsAt: Date);
}

const body = zodSchema(z.object({ practitionerId: z.uuid(), startsAt: z.iso.datetime() }));

export const appointmentRoutes = (commands: CommandBus) =>
  defineRoutes(
    defineRoute(
      {
        method: 'POST',
        path: '/appointments',
        operationId: 'bookAppointment',
        summary: 'Book an appointment',
        tags: ['scheduling'],
        request: { body },
        responses: { 201: { description: 'Booked; the body carries its identifier.', body: acceptedSchema } },
        errors: ['SLOT_TAKEN'],
        security: ['bearer'],
      },
      // body est typé par son schéma : { practitionerId: string; startsAt: string }
      async ({ body: { practitionerId, startsAt }, context }) => {
        const id = await commands.execute(new BookAppointment(context.execution.actor, practitionerId, new Date(startsAt)));

        return { status: 201, body: { id } };
      },
    ),
  );
```

Le framework ne fait que monter cette liste. Chaque adaptateur est un sous-chemin de
`@ddd-ts-kit/http`, et les trois montages ci-dessous servent les mêmes routes avec le même
comportement :

<!-- checked sample -->
```ts
// platform/http/start-http-server.ts : l'un d'eux, choisi par `stack.http`
import { serve } from '@hono/node-server';
import express from 'express';
import Fastify from 'fastify';
import { Hono } from 'hono';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { mountExpress } from '@ddd-ts-kit/http/express';
import { fastifyRoutes } from '@ddd-ts-kit/http/fastify';
import { mountHono } from '@ddd-ts-kit/http/hono';

declare const routes: readonly Route[]; // appointmentRoutes(commands), et les routes des autres contextes
declare const options: ExecuteOptions; // resolvePrincipal, executionScope, errorMapper...

export function onExpress(): void {
  const app = express();
  app.use(express.json()); // l'adaptateur n'analyse pas les corps
  mountExpress(app, routes, options);
  app.listen(3000);
}

export async function onFastify(): Promise<void> {
  const app = Fastify();
  await app.register(fastifyRoutes(routes, options));
  await app.listen({ port: 3000 });
}

export function onHono(): void {
  const app = new Hono();
  mountHono(app, routes, options); // lit lui-même le corps JSON, jusqu'à bodyLimit
  serve({ fetch: app.fetch, port: 3000 });
}
```

Ce qu'une route du kit remplace, c'est un gestionnaire écrit contre le framework. Au lieu de :

```ts
// presentation/http/book-appointment.ts : un gestionnaire Express à lui
app.post('/appointments', async (req, res) => {
  if (typeof req.body.startsAt !== 'string') {
    return res.status(400).json({ error: 'startsAt is required' }); // un format à lui, absent du contrat
  }
  try {
    const id = await commands.execute(new BookAppointment(req.user, req.body.practitionerId, new Date(req.body.startsAt)));
    res.status(201).json({ id });
  } catch (error) {
    res.status(409).json({ message: (error as Error).message }); // chaque échec est un 409, et son message fuit
  }
});
```

écrivez la déclaration ci-dessus : le schéma valide et documente le corps, le gestionnaire ne
fait que transformer la requête HTTP en commande, et un refus du cas d'usage (`SLOT_TAKEN`)
reçoit pour réponse un problème avec le statut que le *mapper* d'erreurs donne à son code, sur
chaque framework de la même façon.

Ce qui reste au framework : l'écoute, l'analyse des corps, les *plugins* ou *middlewares*
placés devant les routes (compression, CORS, limitation de débit), et sa propre réponse à un
corps qu'il refuse avant que le *pipeline* ne s'exécute (sur Hono, l'adaptateur lit le corps, et
répond à ces refus par des problèmes).

## Comparaison

Versions et chiffres vérifiés le 2026-10-10 auprès du registre npm.

| | Express | Fastify | Hono | NestJS |
|---|---|---|---|---|
| Version majeure actuelle | 5 (5.3.0 ; 4.x toujours publié sous `latest-4`) | 5 (5.12.5) | 4 (4.13.13, avec `@hono/node-server` 2.1.4 sur Node) | 12 (12.1.2 ; 11.x sous `legacy`) |
| Licence | MIT | MIT | MIT | MIT |
| Node exigé par le *package* | 18 ou plus récent | non vérifié | 16.9 ou plus récent (`hono`) | 20 ou plus récent |
| Téléchargements par semaine | environ 141 millions | environ 15 millions | non vérifié | environ 16 millions (`@nestjs/core`) |
| Nature | routeur minimal et chaîne de *middlewares* | routeur avec schémas, *hooks*, *plugins* encapsulés, un *logger* (pino) | routeur sur les `Request` et `Response` du standard Web, pour Node, Bun, Deno et les environnements edge | framework applicatif : modules, conteneur d'injection, décorateurs, au-dessus d'Express ou de Fastify |
| Validation propre | aucune | JSON Schema par route | *middlewares* de validation | *pipes*, en général class-validator |
| Injection propre | aucune | aucune (décorateurs sur l'instance) | aucune | oui, au cœur du framework |
| Décorateurs | aucun | aucun | aucun | partout ; mode legacy des décorateurs dans les projets générés par ce kit |
| Ce que les routes du kit en utilisent | le routeur | le routeur, comme routes ou comme *plugin* avec un préfixe | le routeur ; l'adaptateur lit lui-même le corps JSON | le seul serveur HTTP sous-jacent |

Les chiffres de téléchargement disent à quel point chacun est installé, rien de son adéquation.
Les performances sont mesurées dans [paires de contrat](contract-pairs.fr.md) : le *pipeline*
du kit coûte environ une microseconde par requête HTTP, plus la validation, les débits des
quatre frameworks sont restés dans le bruit d'une machine partagée, et seul le démarrage à froid
de Nest s'est démarqué. Dans un service qui parle à une base de données, le framework est
rarement là où passe le temps.

## Critères de choix

1. **Ce que l'équipe exploite déjà.** La connaissance opérationnelle (*middlewares*, *plugins*,
   gestion des erreurs, arrêt propre) est le vrai coût d'un framework.
2. **Ce qui entoure les routes.** Rendu côté serveur, WebSockets, GraphQL : cela vit hors de
   `@ddd-ts-kit/http` et vient de l'écosystème du framework. Les téléversements de fichiers, non :
   un contrôleur déclare son téléversement, lu de la même façon sur les trois frameworks (voir
   [stockage de fichiers](file-storage.fr.md)).
3. **Le *logger*.** Fastify parle pino ; le kit a un adaptateur pino de son port `Logger`
   ([outils d'observabilité](observability.fr.md)).
4. **Un second conteneur est-il acceptable ?** NestJS apporte le sien ; voir
   [injection de dépendances](dependency-injection.fr.md).
5. **Mode des décorateurs.** NestJS et class-validator imposent le mode legacy à tout le
   programme. Les décorateurs propres au kit fonctionnent dans les deux modes : cela contraint
   d'autres bibliothèques, pas le kit.

## Ce que coûtent, avec Nest, des « routes indépendantes du framework »

`createRoutesModule` monte les routes sur le serveur HTTP qui se trouve sous Nest, à
l'initialisation du module, que Nest tourne sur Express ou sur Fastify. Aucun décorateur par
route ; les gestionnaires reçoivent leurs dépendances par fermeture :

<!-- checked sample: legacy-decorators -->
```ts
// platform/http/app.module.ts
import { Module } from '@nestjs/common';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { createRoutesModule } from '@ddd-ts-kit/http/nest';

declare const routes: readonly Route[]; // la même liste qu'Express, Fastify ou Hono monteraient
declare const options: ExecuteOptions;

@Module({ imports: [createRoutesModule(routes, options)] })
export class AppModule {}
```

Le README du *package* est explicite sur la conséquence : ces routes **contournent les pipes,
les gardes, les intercepteurs, les filtres d'exception et le préfixe global de Nest**. En
pratique :

![Le cycle de vie des requêtes HTTP d'un contrôleur Nest natif (gardes, intercepteurs, pipes, méthode du contrôleur, filtres d'exception) en haut, et en bas ce qui remplace chacun pour une route du kit : le résolveur du principal et le middleware d'autorisation du bus, les middlewares du bus et les aspects, le schéma de la route, le gestionnaire de la route, et le mapper d'erreurs](../assets/diagrams/http-frameworks-nest-bypass.fr.svg)

| Fonction de Nest | Pour une route du kit |
|---|---|
| `ValidationPipe` et autres *pipes* | non exécutés ; la validation est le `Schema` de la route |
| gardes (`@UseGuards`, stratégies Passport) | non exécutées ; l'authentification est `resolvePrincipal`, l'autorisation le *middleware* du bus |
| intercepteurs (journalisation, cache, transformation) | non exécutés ; utilisez les *middlewares* du bus et les aspects |
| filtres d'exception | non exécutés ; les erreurs deviennent des problèmes RFC 9457 par le *mapper* d'erreurs |
| `setGlobalPrefix` | ignoré ; utilisez `prefixRoutes` |
| `@nestjs/swagger` | ne voit pas ces routes ; le contrat est généré par le kit |

Trois autres coûts découlent du choix de Nest dans ce kit :

- **Le câblage est celui de Nest.** `--http nest` et `--di nest` vont ensemble : la CLI refuse
  l'un sans l'autre, et refuse le style déclaré avec `--di nest`. Les contextes sont écrits dans
  le style explicite, sous la forme d'un `<context>.module.ts` qui est une fonction de la
  plateforme, et `@Injectable()` est tenu hors de `domain/` et `application/`.
- **Décorateurs legacy.** Le `tsconfig.json` généré active `experimentalDecorators` (et
  `emitDecoratorMetadata`) pour Nest.
- **Deux façons de tout faire.** Une équipe qui écrit aussi des contrôleurs Nest natifs a deux
  chemins de validation, deux formats d'erreur et deux contrats à garder cohérents. Choisissez-en
  un pour l'API des contextes délimités (bounded contexts).

Ce que Nest donne encore : son système de modules pour les parties qui ne sont pas des cas
d'usage (santé, passerelles WebSocket, GraphQL, files d'attente), sa CLI et son vivier de
recrutement. Si c'est pour cela que Nest a été choisi, le coût est juste. Si Nest a été choisi
pour ses contrôleurs, ses gardes et ses *pipes*, les routes du kit retirent exactement cela, et
Express ou Fastify font le même travail avec moins de machinerie.

## Ce que ce kit prend en charge et a vérifié

D'après [`packages/http/README.md`](../../packages/http/README.fr.md) et
[`packages/cli/README.md`](../../packages/cli/README.fr.md) :

- Des adaptateurs pour Express 5, Fastify 5, Hono 4 et NestJS, tous par un seul *pipeline*
  (`executeRoute`) ; une suite de tests prouve que le comportement des routes est le même sur les
  quatre, et les téléversements et les liens signés de fichiers sont prouvés sur Express, Fastify
  et Hono.
- Des erreurs renvoyées en `application/problem+json` (RFC 9457) par un seul *mapper*
  d'erreurs ; une erreur inattendue reçoit une réponse 500 sans détail.
- `security` est obligatoire sur chaque route ; une route n'est jamais publique par omission
  (`authz/declared`).
- OpenAPI 3.1 généré à partir des mêmes déclarations, déterministe, avec une vérification de
  dérive pour la CI.
- Chaque requête HTTP s'exécute dans la portée d'exécution avec son identifiant de corrélation
  quand la portée est donnée dans les options.
- Les preuves de bout en bout de la CLI installent et exécutent des projets générés :
  `proven-stacks.spec.ts` huit d'entre eux, sept sur Express et un sur Fastify (avec
  `--di manual`), et `contract-pairs.spec.ts` un par paire de
  [paires de contrat](contract-pairs.fr.md), Express, Fastify, Hono sur Node et NestJS (avec
  `--di nest` et class-validator), chacun tenu à zéro constat, à ses *specs*, à ses *specs* de
  bout en bout et à un contrat à jour.

## Limites, et quand ne pas l'utiliser

- Un corps que le framework refuse lui-même (JSON mal formé, contenu trop volumineux) reçoit
  pour réponse celle du gestionnaire d'erreurs propre au framework sur Express
  (`express.json()`, 100 kB par défaut), Fastify (1 MiB) et NestJS, avant le *pipeline* : son
  format n'est pas le format *problem*, sauf si vous le configurez. Sur Hono, l'adaptateur lit le
  corps : un corps au-delà de `bodyLimit` (1 MiB par défaut) reçoit une réponse 413
  `BODY_TOO_LARGE` et un JSON mal formé une réponse 400 `MALFORMED_BODY`, tous deux sous forme de
  problèmes.
- Les routes sont d'abord JSON. Un gestionnaire peut renvoyer une chaîne, des octets ou un flux
  avec son propre `content-type`. Un téléversement est déclaré sur son contrôleur et arrive en
  flux au gestionnaire (`multipart/form-data`, taille et types de médias dans le contrat) ; un
  gros téléchargement passe par un lien signé du stockage. Les événements envoyés par le serveur
  (server-sent events) et les WebSockets s'écrivent nativement dans le framework, hors du contrat
  généré.
- Express a besoin d'un `express.json()` que vous installez : l'adaptateur n'analyse pas les
  corps.
- Les chemins sont faits de segments littéraux et de paramètres `:name` seulement, la forme
  qu'Express et Fastify partagent : pas de routes par expression régulière, pas de jokers.
- Les valeurs de la query arrivent en chaînes : convertissez-les dans le schéma.
- Avec `stack.http: none`, aucun authentificateur ni aucune frontière ne sont générés :
  l'application est pilotée par des événements, des *jobs* ou un transport à vous.

N'utilisez pas les routes du kit pour un backend-for-frontend qui sert surtout de mandataire et
de flux, ni pour une API GraphQL : la déclaration de route modélise du JSON de requête et de
réponse sur REST.

## Recommandation selon la situation

| Situation | Choix |
|---|---|
| Aucune habitude forte, une simple API JSON | Express : le défaut du kit, la plus petite surface, la connaissance la plus répandue |
| Fort volume de requêtes HTTP, pino déjà en place, encapsulation par *plugins* voulue | Fastify |
| Un service qui pourrait passer à Bun, Deno ou un environnement edge, ou une équipe à l'aise avec les requêtes du standard Web | Hono (prouvé sur Node seulement) |
| Une application Nest existante qui adopte le kit contexte par contexte | NestJS, style explicite, routes du kit pour les contextes et Nest natif pour le reste |
| Un nouveau projet, Nest choisi « parce qu'il a de la structure » | à reconsidérer : ici la structure vient de l'arborescence et des règles du kit ; Express ou Fastify avec tsyringe gardent le style déclaré |
| Aucun HTTP (*worker*, consommateur) | `none` |

Changer plus tard, c'est changer de montage dans la racine de composition et le fichier serveur
de la plateforme, pas les routes, les gestionnaires ni le contrat : voilà ce qu'achète la
déclaration. Passer d'Express à Fastify, par exemple, c'est la différence entre `onExpress` et
`onFastify` dans l'exemple de montage ci-dessus, plus les *plugins* propres au serveur ;
`appointmentRoutes` et le document OpenAPI restent tels quels.

## Sources

- Express, notes de version et guide de migration vers la version 5 : https://expressjs.com
- Hono sur Node : https://hono.dev/docs/getting-started/nodejs
- Documentation de Fastify (*hooks*, encapsulation, validation) : https://fastify.dev/docs/latest/
- Documentation de NestJS (*pipes*, gardes, intercepteurs, filtres d'exception, cycle de vie
  des requêtes HTTP) : https://docs.nestjs.com/faq/request-lifecycle
- Registre npm, `express`, `fastify`, `@nestjs/core` : versions, licences, moteurs et
  téléchargements hebdomadaires lus le 2026-10-10.
- RFC 9457, Problem Details for HTTP APIs : https://www.rfc-editor.org/rfc/rfc9457
- OpenAPI Specification 3.1 : https://spec.openapis.org/oas/v3.1.0
- Non vérifié : si NestJS 12 peut tourner sans le mode legacy des décorateurs. Aucune
  déclaration officielle n'a été trouvée ; le kit génère le mode legacy pour Nest.

## Voir aussi

- [Bibliothèques de validation](validation.fr.md)
- [Injection de dépendances](dependency-injection.fr.md)
- [Les couches et la règle de dépendance](../concepts/layers-and-dependency-rule.fr.md)
- [Invariants, permissions et validation](../concepts/invariants-permissions-validation.fr.md)
- [Authentification et autorisation](../concepts/authentication-and-authorization.fr.md)
- [Référence de l'architecture](../ARCHITECTURE.fr.md) et [configuration](../CONFIG.fr.md)
