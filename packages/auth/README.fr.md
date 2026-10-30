[English](README.md) · **Français**
<!-- translation-of: README.md sha256:453b70e1b25ee3ea -->

# @ddd-ts-kit/auth

L'authentification et l'autorisation derrière des ports : qui appelle, ce qu'il a le droit de
faire, et sur quel élément, sans test de rôle dans un contrôleur ni `if (user.isAdmin)` dans le
domaine. Le modèle d'autorisation (rôles, politiques sur des attributs, relations à la manière
de Google Zanzibar) est le choix du projet, derrière un seul port.

```
npm i @ddd-ts-kit/auth
npm i jose            # seulement pour @ddd-ts-kit/auth/jwt
```

| Entrée | Contient | Importe |
|---|---|---|
| `@ddd-ts-kit/auth` | les permissions, `requires`, `AuthorizationMap`, `authorizationMiddleware`, les ports `Authorizer`, `Access`, `Authenticator` et `SessionAuthenticator`, les politiques et `PolicyAccess`, `RoleBasedAuthorizer`, `PolicyBasedAuthorizer`, le raccordement HTTP | le noyau seulement |
| `@ddd-ts-kit/auth/rebac` | le DSL de schéma, les tuples de relation, `RelationTupleStore`, `RelationBasedAuthorizer` | le noyau seulement |
| `@ddd-ts-kit/auth/jwt` | `JwtAuthenticator`, `keycloakAuthenticator` | `jose` (dépendance *peer* optionnelle), le seul fichier qui l'importe |
| `@ddd-ts-kit/auth/passport` | `passportPrincipal` : une stratégie de Passport comme `resolvePrincipal` de la frontière HTTP | rien : il exécute la stratégie qu'on lui donne |
| `@ddd-ts-kit/auth/di` | `authorizationModule`, `authorizationMapOf`, et de nouveau les classes que le module lie : `Authorizer`, `Authenticator`, `Access`, `AuthorizationMap` | `@ddd-ts-kit/di` (dépendance *peer* optionnelle) |
| `@ddd-ts-kit/auth/testing` | `anActor()` et son `ActorBuilder`, `holdersOf()`, `AllowAll`, `DenyAll`, `RecordingAuthorizer`, `FakeAuthenticator`, les deux suites de contrat | `@ddd-ts-kit/testing` (dépendance *peer* optionnelle), le *runner* que vous passez |

Le modèle de l'acteur vit dans `@ddd-ts-kit/kernel` : `Actor`, `anonymousActor()`,
`systemActor(name)`, `AuthorizedCommand`, `AuthorizedQuery`, le port `ActorContext` et ses deux
implémentations.

## Trois responsabilités, trois endroits

| Responsabilité | Question | Où elle vit | Avec quoi |
|---|---|---|---|
| Authentification | qui appelle ? | la plateforme, à la frontière (`src/platform/auth`, les routes, les consommateurs) | un adaptateur de `Authenticator` vérifie le justificatif et produit un `Actor`, et un `SessionAuthenticator` la `Session` entière : de simples données, jamais le jeton |
| Autorisation | cet acteur a-t-il le droit de faire ceci, sur ceci ? | la couche application de chaque contexte (`application/authorization/`) | des permissions déclarées comme des données, une exigence par cas d'usage vérifiée par un *middleware* du bus, des politiques pour les règles qui ont besoin d'un état chargé, le tout à travers le port `Authorizer` |
| Invariants | est-ce un état valide du métier ? | le domaine | les agrégats et les `DomainError`. « Une facture ne peut pas être payée deux fois » n'est pas une permission |

![La place du package dans une application : la plateforme transforme le jeton bearer en une Session et son Actor avec principalResolver et un Authenticator ; la route met l'acteur dans la commande ; la garde du bus de commandes refuse un cas d'usage non déclaré et interroge l'Authorizer avant le gestionnaire ; le gestionnaire charge l'élément et interroge Access, qui applique les politiques puis l'Authorizer ; l'agrégat n'importe rien du package ; quatre classes implémentent le port unique Authorizer](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/auth-package-place.fr.svg)

Rien n'est accessible par défaut. Une commande ou une requête qui ne déclare ni une permission
ni qu'elle est publique est refusée, à l'exécution par le *middleware* et, si vous le
demandez, à la création de l'application.

Les gardes ne sont pas un quatrième endroit. Une garde de `@ddd-ts-kit/http` (`Authenticated`,
`HasRole(..)`, une garde du projet) est un contrôle en bordure sur un ensemble de routes : elle
lit l'appelant et la requête HTTP, et refuse avant que le contrôleur ne s'exécute. Elle ne
remplace jamais la permission d'un cas d'usage, qu'un *job*, un gestionnaire d'événement ou un
autre transport atteint sans passer par aucune garde, et elle ne charge jamais un élément pour
décider. La règle est `presentation/guard-at-the-edge`.

## Le plus petit exemple qui fonctionne

Avant l'exemple complet, le mécanisme en un seul fichier, sans conteneur et sans HTTP : une
permission, une commande qui porte son acteur, l'exigence, un modèle par rôles et la garde sur
un bus de commandes du noyau. Exécutez-le tel quel : les commentaires disent ce qu'il affiche.

<!-- checked sample -->
```ts
import {
  AuthorizationMap,
  ForbiddenError,
  RoleBasedAuthorizer,
  UnauthenticatedError,
  authorizationMiddleware,
  definePermissions,
  requires,
  type DecisionRecord,
} from '@ddd-ts-kit/auth';
import { AuthorizedCommand, InMemoryCommandBus, anonymousActor, type Actor } from '@ddd-ts-kit/kernel';

// 1. Les permissions du contexte, comme des données.
const billingPermissions = definePermissions('billing', {
  'invoice.void': { description: 'Void an issued invoice' },
});

// 2. Un cas d'usage qui porte son acteur.
class VoidInvoice extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly invoiceId: string,
  ) {
    super(actor);
  }
}

// 3. Ce que chaque cas d'usage exige. Un message absent de la carte est refusé.
const map = AuthorizationMap.of(requires(VoidInvoice, billingPermissions['invoice.void']));

// 4. Le modèle : ici, des rôles. Seul un `controller` peut annuler.
const authorizer = new RoleBasedAuthorizer({
  roles: { controller: [billingPermissions['invoice.void']], clerk: [] },
});

// 5. La garde s'exécute sur le bus, avant le gestionnaire.
const decisions: DecisionRecord[] = [];
const commands = new InMemoryCommandBus()
  .use(authorizationMiddleware({ authorizer, map, onDecision: (record) => void decisions.push(record) }))
  .register(VoidInvoice, { execute: async (command) => console.log(`voided ${command.invoiceId}`) });

const grace: Actor = { id: 'grace', type: 'user', roles: ['controller'], attributes: {} };
const bob: Actor = { id: 'bob', type: 'user', roles: ['clerk'], attributes: {} };

await commands.execute(new VoidInvoice(grace, 'inv-1')); // affiche "voided inv-1"

const refused = await commands.execute(new VoidInvoice(bob, 'inv-1')).catch((error: unknown) => error);
console.log(refused instanceof ForbiddenError && refused.reason); // NO_MATCHING_ROLE, traduit en 403

const nobody = await commands.execute(new VoidInvoice(anonymousActor(), 'inv-1')).catch((error: unknown) => error);
console.log(nobody instanceof UnauthenticatedError && nobody.code); // UNAUTHORIZED, traduit en 401

console.log(decisions.map(({ actorId, decision }) => `${actorId}: ${decision.allowed}`));
// [ 'grace: true', 'bob: false', 'anonymous: false' ]
```

Le gestionnaire (handler) n'a vu ni `bob` ni l'appelant anonyme, et ne contient aucun `if` sur
les rôles. Chaque pièce a sa place dans un vrai projet : les permissions dans
`application/authorization/`, la commande à côté de son gestionnaire, l'exigence sur le message
ou dans le module, le modèle et la garde dans la racine de composition, où `authorizationModule`
les installe pour vous. L'exemple complet ci-dessous met chacune à sa place.

## Un exemple complet

### 1. Les permissions, déclarées par le contexte qui les possède

<!-- checked sample -->
```ts
// contexts/billing/billing.permissions.ts
import { definePermissions } from '@ddd-ts-kit/auth';

export const billingPermissions = definePermissions('billing', {
  'invoice.issue': { description: 'Issue an invoice to a customer' },
  'invoice.read': { description: 'Read invoices' },
  'invoice.void': { description: 'Void an issued invoice' },
});
// billingPermissions['invoice.issue'].id === 'billing:invoice.issue', typé comme ce littéral
```

`PermissionRegistry.of(billingPermissions, catalogPermissions)` les liste toutes (`all()`,
`contexts()`, `inContext(name)`, `find(id)`) : la documentation et les écrans d'administration
sont générés à partir de lui, jamais écrits à la main. Les noms sont vérifiés à leur
déclaration : un nom de contexte est un mot en minuscules, un nom de permission des mots en
minuscules séparés par des points (chaque mot commence par une lettre ; chiffres et tirets
permis). Tout le reste lève
`AuthorizationSetupError` au chargement du fichier, tout comme `PermissionRegistry.of` pour un
identifiant déclaré deux fois : une erreur trouvée au démarrage, jamais un refus découvert en
production.

### 2. Des cas d'usage qui portent leur acteur

<!-- checked sample -->
```ts
// contexts/billing/application/commands/void-invoice/void-invoice.command.ts
import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';

export class VoidInvoice extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly invoiceId: string,
  ) {
    super(actor);
  }
}
```

L'acteur est le premier argument du constructeur : un site d'appel ne peut pas l'oublier, et le
compilateur refuse `requires` sur un message qui n'en a pas. `Command` et `Query` restent pour
les cas d'usage publics.

### 3. L'exigence, sur le message ou à côté de l'enregistrement du gestionnaire

Un projet généré par la CLI utilise par défaut le style déclaré : l'exigence s'écrit sur le
message avec `@Requires` ou `@Public`, montré plus bas, et il n'y a pas de fichier de module.
Le style explicite l'écrit dans `<context>.module.ts` :

```ts
// contexts/billing/billing.module.ts
import { Access } from '@ddd-ts-kit/auth';
import { defineContextModule } from '@ddd-ts-kit/di';
import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';

export const billingModule = defineContextModule({
  name: 'billing',
  register(builder) {
    builder
      .command(IssueInvoice)
      .requires(billingPermissions['invoice.issue'])
      .handledBy(IssueInvoiceHandler, [InvoiceRepository, IdGenerator]);
    builder
      .command(VoidInvoice)
      .requires(billingPermissions['invoice.void'], {
        resource: (command) => ({ type: 'invoice', id: command.invoiceId }),
      })
      .handledBy(VoidInvoiceHandler, [InvoiceRepository, Access, Clock]);
    builder.query(GetCatalog).public().handledBy(GetCatalogHandler, [Catalog]);
  },
});
```

Le gestionnaire ne vérifie rien pour la permission : la garde du bus la décide avant qu'il
s'exécute. Il ne demande `Access` que lorsqu'une politique affine cette permission, une fois
l'élément chargé (section 4). `resource` nomme l'élément sur lequel porte le droit,
`context` transmet les faits du message dont l'autorisateur peut avoir besoin (le *tenant*
qu'il vise).

La même exigence dite sur le message lui-même, avec les déclarations du noyau, pour un contexte
déclaré :

```ts
// contexts/billing/application/commands/void-invoice/void-invoice.command.ts
import { Requires } from '@ddd-ts-kit/kernel/declarations';

@Requires(billingPermissions['invoice.void'], {
  resource: (command: VoidInvoice) => ({ type: 'invoice', id: command.invoiceId }),
})
export class VoidInvoice extends AuthorizedCommand { /* ... */ }

// void-invoice.handler.ts : Access vient de '@ddd-ts-kit/auth', que la couche application peut importer
@CommandHandler(VoidInvoice)
export class VoidInvoiceHandler implements CommandHandler<VoidInvoice> { /* ... */ }
```

`@Public()` est le pendant de `.public()`. Les deux formes alimentent la même carte des
autorisations et le même contrôle `authorization: 'required'` ; écrite sur le *builder*, une
exigence l'emporte sur celle du message. Une classe de politique déclarée avec
`@Policy(permission, { name: 'invoice.only-issuer-voids' })` (une méthode
`allows(actor, subject, { now })`, et `appliesTo(subject)` quand elle doit distinguer ses
sujets) est évaluée par `Access` à côté des politiques données à `authorizationModule`.

Les ports de ce package sont des classes abstraites, et la classe est ce que nomment un
paramètre de constructeur, une liaison ou un test : `Authorizer`, `Access`, `Authenticator`,
`SessionAuthenticator` et `ResourceAttributes` de `@ddd-ts-kit/auth`, `RelationTupleStore` de
`@ddd-ts-kit/auth/rebac`. Un adaptateur `implements` son port et ne l'étend jamais ; un simple
objet doté des mêmes méthodes le remplace dans un test.

### 4. Une politique, pour une règle qui a besoin de l'élément chargé

<!-- checked sample -->
```ts
// contexts/billing/application/authorization/only-issuer-voids-same-day.policy.ts
import { definePolicy, type PermissionSet } from '@ddd-ts-kit/auth';

declare const billingPermissions: PermissionSet<'billing', 'invoice.void'>;
declare class Invoice {
  readonly issuedBy: string;
  readonly issuedAt: Date;
}
declare function isSameDay(left: Date, right: Date): boolean;

export const onlyIssuerVoidsSameDay = definePolicy<Invoice>({
  name: 'invoice.only-issuer-voids-same-day',
  permission: billingPermissions['invoice.void'],
  appliesTo: (subject): subject is Invoice => subject instanceof Invoice,
  allows: (actor, invoice, { now }) => actor.id === invoice.issuedBy && isSameDay(invoice.issuedAt, now),
});
```

```ts
// contexts/billing/application/commands/void-invoice/void-invoice.handler.ts
export class VoidInvoiceHandler {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  async execute(command: VoidInvoice): Promise<void> {
    const invoice = await this.invoices.findById(command.invoiceId);
    if (invoice === undefined) {
      throw new NotFoundError('Invoice not found');
    }
    await this.access.authorize(command.actor, billingPermissions['invoice.void'], invoice);
    invoice.void(this.clock.now());
    await this.invoices.save(invoice);
  }
}
```

`Access.authorize` interroge chaque politique de la permission, puis l'autorisateur, et lève
`ForbiddenError` avec un code de raison : le nom de la politique qui a renvoyé `false`, le code
donné par la politique ou par l'autorisateur, ou `SUBJECT_MISMATCH` quand le sujet n'est pas de
ceux qu'accepte `appliesTo`. L'acteur anonyme est refusé avant qu'aucune politique ne soit
interrogée, avec `UnauthenticatedError` (401), comme sur le bus. Une politique est un simple
objet : sa *spec* appelle `onlyIssuerVoidsSameDay.allows(actor, invoice, { now })` et n'a
besoin de rien d'autre.

Un cas d'usage protégé rencontre deux points de contrôle. La garde du bus décide de l'action,
avant le gestionnaire et avant toute transaction ; `Access` décide de l'élément, une fois que le
gestionnaire l'a chargé. Chaque refus a son erreur, son code et son statut HTTP :

![Les deux points de contrôle. La garde du bus : un message non déclaré échoue avec UndeclaredUseCaseError, un message public s'exécute sans contrôle, un message protégé sans acteur échoue avec MissingActorError, l'acteur anonyme est refusé avec UnauthenticatedError (401), et un refus de l'Authorizer est une ForbiddenError (403) avec sa raison ; autorisé, l'unité de travail s'ouvre et le gestionnaire s'exécute. Access dans le gestionnaire : l'acteur anonyme est refusé avec UnauthenticatedError, chaque politique de la permission est interrogée, puis l'Authorizer sur la ressource ; autorisé, l'agrégat change. Les deux transmettent chaque décision à onDecision](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/auth-package-two-checkpoints.fr.svg)

`UndeclaredUseCaseError` et `MissingActorError` ne sont pas des refus : elles disent que le code
est faux, font échouer le premier test qui envoie le message, et ne sont jamais traduites en
403.

`Access` est le port dont dépend le gestionnaire ; `PolicyAccess` est son implémentation, que
lie `authorizationModule`. `PolicyAccessOptions.resourceOf` dit comment un sujet nomme sa
ressource (`invoice => ({ type: 'invoice', id: invoice.id })`) quand l'autorisateur décide
élément par élément. Par défaut, seul un simple `{ type, id }` est pris pour une référence de
ressource. Un `PolicyAccess` construit à la main sans autorisateur refuse, avec `NO_POLICY`, une
permission à laquelle aucune politique ne répond : le refus par défaut tient là aussi.

### 5. La racine de composition

```ts
// main.ts
import { createApplication, kernelModule } from '@ddd-ts-kit/di';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { JwtAuthenticator } from '@ddd-ts-kit/auth/jwt';

const app = createApplication({
  modules: [
    kernelModule(),
    billingModule,
    authorizationModule({
      authorizer: new RoleBasedAuthorizer({
        roles: {
          admin: ['*'],
          accountant: [billingPermissions['invoice.issue'], billingPermissions['invoice.read']],
          controller: ['billing:*'],
        },
        inherits: { controller: ['accountant'] },
      }),
      authenticator: new JwtAuthenticator({
        jwksUri: config.oidc.jwksUri,
        issuer: config.oidc.issuer,
        audience: 'billing-api',
      }),
      policies: [onlyIssuerVoidsSameDay],
      onDecision: (record) => auditTrail.append(record),
    }),
  ],
  authorization: 'required',
});
```

Le module lie `Authorizer`, `Access` (un `PolicyAccess` sur l'autorisateur, les politiques et
le `Clock` de l'application), l'`AuthorizationMap` construite à partir de ce que les cas
d'usage ont déclaré et, quand il est fourni, `Authenticator`. Chacun se résout par sa classe :

```ts
const authorizer = app.resolve(Authorizer);
const declared = app.resolve(AuthorizationMap).declarations(); // pour la documentation et les écrans d'administration
```

Un authentificateur qui a ses propres dépendances est lié par un module de la plateforme au
lieu d'être donné en option :

```ts
// platform/auth/auth.module.ts
import { Authenticator } from '@ddd-ts-kit/auth';
import { defineContextModule } from '@ddd-ts-kit/di';

export const authModule = defineContextModule({
  name: 'auth',
  register(builder) {
    builder.bind(Authenticator).toClass(SessionCookieAuthenticator, [SessionStore]);
  },
});
```

`authorizationModule` lie la garde que les bus de commandes et de requêtes de `kernelModule()`
exécutent avant tout le reste, unité de travail comprise : une commande refusée n'ouvre aucune
transaction. Un bus à vous, fourni par `kernelModule({ commandBus })`, doit exécuter la garde
lui-même : `.use((message, next, info) => resolve(UseCaseGuard).check(message, next, info))`,
`UseCaseGuard` étant le port de `@ddd-ts-kit/di` que le module lie.

Quand une politique affine la permission d'un cas d'usage, la garde enveloppe aussi son
gestionnaire, en dernier sur le bus et à l'intérieur de l'unité de travail : un gestionnaire qui
rend la main sans interroger `Access` sur cette permission voit son résultat refusé par
`PolicyNotAskedError` et sa modification annulée, puisque la règle de la politique n'a jamais été
appliquée ; celui dont la dernière question sur elle n'a pas été accordée, et qui poursuit
quand même, par `PolicyDenialIgnoredError`. Un bus à vous exécute cette partie autour de son gestionnaire, avec
`.aroundHandler((message, next, info) => resolve(UseCaseGuard).within?.(message, next, info) ?? next())`.
Sans le conteneur, `policiesAskedMiddleware({ map, refined })` fait la même vérification. Seules
les questions posées à `PolicyAccess` sont vues : un projet qui lie son propre `Access` passe
`policiesAsked: false`.
`authorization: 'required'` fait lever à `createApplication` une `WiringError`
(`UNDECLARED_AUTHORIZATION`) qui nomme chaque commande et chaque requête qui n'a ni
`.requires(...)` ni `.public()`, et une autre (`AUTHORIZATION_NOT_ENFORCED`) quand aucun module
ne lie de garde. La valeur par défaut est `'optional'` pour l'instant, pour que les modules
existants continuent de fonctionner ; avec elle, un cas d'usage non déclaré est tout de même
refusé à son envoi, avec `UndeclaredUseCaseError`, dès que `authorizationModule` est listé.

`onDecision` est le *hook* d'audit. Il reçoit `{ actorId, permissionId, resource?, decision,
useCase?, kind? }` (`kind` vaut `command` ou `query`, comme le dit le bus) pour chaque décision,
autorisée ou refusée, et un *hook* qui lève une erreur refuse la requête : aucune décision
n'échappe à l'enregistrement.

Sans `@ddd-ts-kit/di`, les mêmes pièces s'assemblent à la main :

```ts
const map = AuthorizationMap.of(
  requires(IssueInvoice, billingPermissions['invoice.issue']),
  requires(VoidInvoice, billingPermissions['invoice.void'], {
    resource: (command) => ({ type: 'invoice', id: command.invoiceId }),
  }),
  publicUseCase(GetCatalog),
);
const guard = authorizationMiddleware({ authorizer, map, onDecision });
const commandBus = new InMemoryCommandBus().use(guard).use(unitOfWorkMiddleware(unitOfWork));
const queryBus = new InMemoryQueryBus().use(guard);
```

### 6. Une route

```ts
// contexts/billing/presentation/http/void-invoice.route.ts
import { actorOf } from '@ddd-ts-kit/auth';

export const voidInvoiceRoute = (commandBus: CommandBus) =>
  defineRoute(
    {
      method: 'POST',
      path: '/invoices/:invoiceId/void',
      operationId: 'voidInvoice',
      summary: 'Void an invoice',
      responses: { 204: { description: 'Voided' } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'],
      security: ['bearer'],
    },
    async ({ params, context }) => {
      await commandBus.execute(new VoidInvoice(actorOf(context.principal), params.invoiceId));
      return { status: 204 };
    },
  );
```

```ts
// platform/http/server.ts
import { Authenticator, principalResolver } from '@ddd-ts-kit/auth';
import { ExecutionScope } from '@ddd-ts-kit/kernel';

const options = {
  resolvePrincipal: principalResolver(app.resolve(Authenticator)), // renvoie une Session
  executionScope: app.resolve(ExecutionScope),
};
// passées à l'adaptateur de @ddd-ts-kit/http : mountExpress(server, routes, options)
```

La route traduit une requête HTTP en commande, et rien d'autre. Elle ne contient ni rôle, ni
test de propriété, ni code de statut pour un refus : `UnauthenticatedError` et
`InvalidCredentialError` portent le code `UNAUTHORIZED`, `ForbiddenError` porte `FORBIDDEN`,
les codes auxquels la correspondance d'erreurs par défaut de `@ddd-ts-kit/http` répond par 401
et 403.

`principalResolver` lit `Authorization: Bearer <token>` dans la requête HTTP du *framework* ;
un en-tête présent qui n'est pas un justificatif *bearer* bien formé est refusé, jamais traité
comme un appel anonyme. Il renvoie une `Session` du noyau (la session anonyme sans justificatif),
que le *pipeline* met, avec son acteur, dans le contexte d'exécution de la requête HTTP, et que
l'option `executionScope` rend ambiante pour l'infrastructure : l'`ActorContext` de
`kernelModule()` lit son acteur dans cette portée (voir « L'acteur courant »). Un gestionnaire
d'événement d'intégration et un *job* planifié n'ouvrent rien eux-mêmes : `@ddd-ts-kit/di`
exécute chaque événement dans un contexte d'exécution d'origine `event` dont l'acteur est
`systemActor('<consumer name>')`, et le planificateur exécute chaque *job* dans un contexte
d'origine `schedule` dont l'acteur est `systemActor('<context>.<job-name>')`. Le gestionnaire
ou le *job* met ce même acteur dans la commande qu'il envoie :
`commands.execute(new SendReminders(systemActor('billing.send-reminders'), execution.scheduledAt))`.

| Lecture | Donne |
|---|---|
| `actorOf(context.principal)` | l'acteur, anonyme quand il n'y en a pas ; accepte aussi le contexte lui-même |
| `sessionOf(context)` | la session : qui, depuis quand, jusqu'à quand, comment l'acteur s'est authentifié, `impersonatedBy` |
| `context.execution` | le contexte d'exécution entier : identifiant de corrélation, *tenant*, langue, échéance |

`inActorContext(actorContext, handler)` continue de fonctionner pour un projet qui a un
`ActorContext` et pas de portée d'exécution : il exécute le gestionnaire dans
`ActorContext.run`.

## Authentification

### Acteurs et sessions

`Authenticator` renvoie un `Actor`. `SessionAuthenticator` l'étend avec
`authenticateSession(credential): Promise<Session>`, pour un adaptateur dont le justificatif en
sait plus que qui : l'identifiant de session, quand elle a été émise et quand elle expire, la
méthode et la force de l'authentification, qui se fait passer pour l'utilisateur. Un port
séparé plutôt qu'une méthode obligatoire, pour qu'un adaptateur qui ne connaît que des acteurs
(une table de clés d'API, un en-tête de développement) reste en trois lignes ; la frontière ne
se soucie pas de celui qu'elle reçoit :

```ts
import { resolveSession } from '@ddd-ts-kit/auth';

const session = await resolveSession(authenticator, credential);
// un SessionAuthenticator renvoie sa propre session ; pour un simple Authenticator, la session
// est dérivée de l'acteur et ne dit que ce qui est connu : l'identifiant de l'acteur comme
// identifiant de session, pas d'instant d'émission (l'epoch), pas d'expiration, méthode `token`
```

### JSON Web Tokens

`JwtAuthenticator` vérifie la signature, l'émetteur, l'audience, l'expiration et l'algorithme
(familles asymétriques seulement sauf indication contraire ; `alg: none` est toujours refusé),
et c'est un `SessionAuthenticator`. Rien du jeton n'est conservé dans l'acteur ni dans la
session. La clé de vérification, qui peut être un secret partagé, n'est pas une propriété de
l'authentificateur : journaliser ou sérialiser l'objet ne montre aucune clé.

| Champ de la session | *Claim* |
|---|---|
| `id` | `sid`, sinon `jti`, sinon le sujet et l'instant d'émission |
| `issuedAt`, `expiresAt` | `iat`, `exp` |
| `authenticationMethod` | `password` quand `amr` liste `pwd`, sinon `token` ; ou l'option `authenticationMethod`, une valeur ou une fonction des *claims* |
| `authenticationStrength` | `mfa` quand `amr` liste `mfa` (RFC 8176), `assuranceLevel` à partir de `acr` |
| `impersonatedBy` | le `sub` du *claim* `act` (RFC 8693), ou le *claim* nommé par `impersonatorClaim` : l'identifiant lui-même, ou un objet qui le porte sous `sub` ou `id` |
| `locale`, `timeZone` | `locale`, `zoneinfo` |
| `scopes` | `scope`, la liste séparée par des espaces d'OAuth 2.0, sinon `scp` sous forme de liste ; absent quand le jeton n'en accorde aucun. `HasScope` de `@ddd-ts-kit/http` les lit en bordure |
| `extensions` | ce que renvoie `toSessionExtensions(claims)` |

```ts
import { JwtAuthenticator } from '@ddd-ts-kit/auth/jwt';

new JwtAuthenticator({
  jwksUri: 'https://id.example.com/realms/shop/protocol/openid-connect/certs', // ou key: publicKey
  issuer: 'https://id.example.com/realms/shop',
  audience: 'shop-api',
  algorithms: ['RS256'],        // par défaut DEFAULT_JWT_ALGORITHMS : RS256, PS256, ES256, EdDSA
  clockTolerance: 5,            // en secondes, 0 par défaut
  requireExpiry: true,          // la valeur par défaut : un jeton sans exp est refusé
  tenantClaim: 'tenant_id',     // la valeur par défaut
  toActor: (claims) => actor,   // remplace la correspondance par défaut
});
```

La correspondance par défaut prend le sujet comme acteur, ses rôles (ci-dessous), le *claim* de
*tenant* (un *claim* texte est le *tenant* ; une liste nomme le *tenant* quand elle en contient
un seul, et forme l'attribut `tenants` d'un acteur qui en a plusieurs, parmi lesquels une
requête HTTP nomme celui dans lequel elle travaille), et les *claims* standard d'OpenID Connect
comme attributs : `username` (`preferred_username`), `email`, et `emailVerified`
(`email_verified`), que lit un cas d'usage qui fait confiance à l'adresse (une invitation qui y
est envoyée).

`authenticate(undefined)` renvoie l'acteur anonyme. Un jeton expiré, sans `exp`, pas encore
valide, destiné à une autre audience ou à un autre émetteur, signé avec une autre clé, altéré,
non signé (`alg: none`), ou utilisant un algorithme hors de la liste autorisée lève
`InvalidCredentialError` (code `UNAUTHORIZED`) avec un code de raison : `TOKEN_EXPIRED`,
`NO_EXPIRY`, `CLAIM_MISMATCH`, `BAD_SIGNATURE`, `ALGORITHM_NOT_ALLOWED`, `UNKNOWN_KEY`,
`MALFORMED_TOKEN`, `UNSUPPORTED_TOKEN`, `NO_SUBJECT`. Un jeu de clés impossible à récupérer n'est
pas un refus : l'erreur est laissée telle quelle et aboutit à une réponse 5xx.

Un jeton doit porter `exp` : un jeton qui n'expire jamais sert à qui le vole jusqu'à ce que sa
clé soit révoquée. `requireExpiry: false` l'accepte, un choix délibéré pour un émetteur dont les
jetons n'expirent jamais ; un `exp` présent est vérifié de la même façon. `DEFAULT_JWT_ALGORITHMS`,
exporté par l'entrée principale, est la liste autorisée quand `algorithms` n'est pas donné.

La correspondance par défaut pour OIDC : `id` à partir de `sub` (obligatoire), `type: 'user'`,
`tenantId` à partir du *claim* du *tenant* quand c'est une chaîne, aucun attribut, et `roles` à
partir de `realm_access.roles` (rôles du *realm*) quand il est présent, sinon de `roles` (une
liste ou des mots séparés par des espaces), jamais fusionnés. Les *scopes* ne sont jamais des
rôles : un *scope* qu'un client a demandé ne doit pas passer pour un rôle, donc un jeton qui ne
porte que `scope` donne un acteur sans rôle, ses *scopes* dans `session.scopes` pour `HasScope`.
Un fournisseur dont les jetons ne portent que des *scopes* fait correspondre ses rôles avec
`toActor`. L'acteur ne garde rien du jeton. Faites correspondre les comptes de service à
`type: 'service'` avec `toActor`.

### Keycloak

```ts
import { keycloakAuthenticator } from '@ddd-ts-kit/auth/jwt';

const authenticator = keycloakAuthenticator({
  baseUrl: 'https://id.example.com', // sans le realm
  realm: 'shop',
  audience: 'shop-api',              // ce que le claim `aud` doit nommer
  clientId: 'shop-api',              // optionnel : ses rôles de client rejoignent les rôles du realm
  tenantClaim: 'organization',       // optionnel, `tenant_id` par défaut
  requireExpiry: true,               // la valeur par défaut : un jeton sans exp est refusé
});
```

Il dérive l'émetteur (`<baseUrl>/realms/<realm>`) et le jeu de clés
(`<issuer>/protocol/openid-connect/certs`, récupéré et mis en cache, rotation des clés suivie),
et fait correspondre un jeton d'accès comme suit :

| Champ | *Claim* |
|---|---|
| `actor.id` | `sub` |
| `actor.type` | `service` quand `preferred_username` commence par `service-account-` (un client qui utilise le *grant* client credentials), sinon `user` |
| `actor.roles` | `realm_access.roles`, plus `resource_access.<clientId>.roles` quand `clientId` est fourni, chacun une seule fois |
| `actor.attributes` | `username` à partir de `preferred_username`, `email`, `emailVerified` à partir de `email_verified`, `groups` à partir du *claim* `groups` (ou `groupsClaim`), et `tenants` quand le *claim* de *tenant* en nomme plusieurs |
| `actor.tenantId` | le *claim* nommé par `tenantClaim` : un *claim* texte, ou le *claim* `organization` (une liste d'alias, ou un objet indexé par alias) quand il nomme exactement une organisation ; plusieurs forment l'attribut `tenants` |
| `session.id` | `sid`, la session du *realm* ; `jti` pour un compte de service, qui n'en a pas |
| `session.authenticationMethod` | `sso` pour une personne, `service` pour un compte de service |
| `session.authenticationStrength` | `assuranceLevel` à partir de `acr` |
| `session.impersonatedBy` | le *claim* nommé par `impersonatorClaim` (`act` par défaut) |

Ce qu'il faut configurer dans le *realm* pour que ces *claims* figurent dans le jeton d'accès :

1. **Un client pour l'API** (`shop-api`) : authentification du client activée, aucun flux
   activé (il ne fait que recevoir des jetons : ce qu'on appelait autrefois bearer-only). Il
   porte les rôles de client, si vous les utilisez.
2. **Un *mapper* d'audience.** Par défaut, l'`aud` d'un jeton d'accès ne nomme pas votre API
   (elle vaut `account`, ou est absente), et le jeton est refusé avec `CLAIM_MISMATCH`. Sur le
   client par lequel les utilisateurs se connectent (le *front end*), ou dans un *client scope*
   qu'il a par défaut : ajoutez un *mapper* de type *Audience*, *Included Client Audience*
   `shop-api`, *Add to access token* activé.
3. **Les *mappers* de rôles.** Le *client scope* intégré `roles`, *scope* par défaut de chaque
   client, écrit déjà `realm_access.roles` (*mapper* *realm roles*) et
   `resource_access.<client>.roles` (*mapper* *client roles*). Vérifiez que le client du
   *front end* l'a conservé, et que *Full scope allowed* est activé, ou que les rôles attendus
   sont dans ses *scope mappings* : Keycloak n'écrit que les rôles qui sont dans le *scope* du
   client qui a demandé le jeton.
4. **Les groupes**, si vous autorisez sur eux : un *mapper* de type *Group Membership*,
   *Token Claim Name* `groups`, *Add to access token* activé. *Full group path* choisit entre
   `/finance/europe` et `europe` ; l'attribut contient ce que le *mapper* écrit.
5. **Le *tenant***, au choix : un *mapper* de type *User Attribute* qui écrit `tenant_id` à
   partir d'un attribut de l'utilisateur ; ou, avec Organizations activé dans le *realm*, le
   *client scope* `organization` demandé par le *front end*, et `tenantClaim: 'organization'`.
   Un utilisateur qui appartient à plusieurs organisations n'obtient aucun *tenant* par défaut
   de ce *claim* : elles sont les `tenants` de l'acteur, et chaque requête HTTP nomme celui dans
   lequel elle travaille (`x-tenant-id`, que l'adaptateur HTTP refuse par un 403 pour un *tenant*
   que l'acteur ne détient pas).
6. **L'emprunt d'identité** (impersonation), si le support se fait passer pour des
   utilisateurs depuis la console d'administration : Keycloak garde l'administrateur dans les
   notes de session de la session qui emprunte l'identité. Un *mapper* de type *User Session Note*,
   *User Session Note* `IMPERSONATOR_ID`, *Token Claim Name* `impersonator_id`, avec
   `impersonatorClaim: 'impersonator_id'`, le place dans `session.impersonatedBy`, que
   `logFieldsOf` reporte sur chaque ligne de journal.

`preferred_username` et `email` viennent des *scopes* intégrés `profile` et `email`. Le
préréglage n'appelle jamais Keycloak au-delà du jeu de clés : une session révoquée est refusée
quand son jeton d'accès expire, donc gardez courte la durée de vie du jeton d'accès.

### Passport

Un projet qui authentifie avec une stratégie de Passport la garde : `passportPrincipal` exécute la
stratégie sur chaque requête, comme le fait `passport.authenticate`, et répond la session que le
pipeline place dans le contexte d'exécution. Les gardes des routes et les permissions des cas
d'usage décident ensuite, sur chaque porte, comme avec les authentificateurs ci-dessus.

```ts
import { passportPrincipal } from '@ddd-ts-kit/auth/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

const strategy = new Strategy(
  { jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: settings.jwtSecret },
  (payload, done) => done(null, payload),
);

const resolvePrincipal = passportPrincipal(strategy, {
  // Ce que le callback de vérification a passé à `done`, lu comme un mapper lit ce qui entre.
  actorOf: (user) => accountActorOf(user),
});
```

Une classe écrite avec `PassportStrategy` de `@nestjs/passport` est aussi une stratégie : ce que
répond son `validate` est l'utilisateur que lit `actorOf`. Nest peut la construire avec ce qu'il
injecte ; donnez alors à `passportPrincipal` une fonction qui répond l'instance une fois Nest
démarré.

Il refuse par défaut :

| La stratégie | L'appel |
|---|---|
| réussit | continue avec l'acteur que répond `actorOf` |
| échoue sur une requête qui présente un identifiant | est refusé, 401 (`InvalidCredentialError`) |
| échoue sur une requête qui n'en présente aucun | continue anonyme, les gardes de la route décident |
| passe (`pass`) | continue anonyme |
| échoue sur une erreur, ou lève | est refusé, l'erreur signalée comme toute autre |
| redirige (une connexion OAuth) | est refusé : un parcours de connexion est servi par la plateforme, pas par l'authentification d'un appel |
| ne répond rien avant `timeoutMs` (10 s) | est refusé |

Un identifiant est présenté quand la requête porte un en-tête `Authorization` ; une stratégie qui
lit un cookie dit où avec `presented: (raw) => ...`. L'`InvalidCredentialError` d'un refus porte
la raison avec laquelle la stratégie a échoué quand c'est un code (`fail({ message:
'NO_EXPIRY' })`, en majuscules séparées par des tirets bas), et `refused-by-strategy` sinon : le
message d'une bibliothèque (`invalid signature`) n'est pas un code.

`passportAuthenticator(strategy, { actorOf })` est la même stratégie derrière le port
`Authenticator` : l'identifiant bearer est remis à la stratégie comme `Authorization: Bearer
<identifiant>`, de sorte que les procédures, les scripts et les tests de bout en bout
s'authentifient aussi par elle. `actorOfClaims(claims)` lit les *claims* d'un jeton comme
`JwtAuthenticator`, pour l'`actorOf` d'une stratégie qui transmet sa charge utile.
`ddd-ts-kit init --authn passport` écrit cette plateforme : une stratégie de `passport-jwt` sur le
jeu de clés de l'émetteur (`jwks-rsa`), son `actorOf`, et les identifiants de bout en bout signés
pour elle. Elle vérifie des jetons bearer, comme `--authn jwt`, avec la stratégie dans le code du
projet : elle refuse un jeton sans `exp` sauf si on lui donne `requireExpiry: false`, et accepte
`DEFAULT_JWT_ALGORITHMS` sauf EdDSA, que `jsonwebtoken` (sous `passport-jwt`) ne sait pas
vérifier : un émetteur qui signe en EdDSA a besoin de `--authn jwt`. Une autre stratégie qui lit un jeton bearer
(des jetons opaques par `passport-http-bearer`, une introspection) prend sa place dans
`bearer-strategy.ts`. Une stratégie
qui lit un cookie ou une session ne passe pas par le port `Authenticator`, qui ne reçoit qu'un
identifiant : donnez-la à `passportPrincipal`, qui reçoit la requête elle-même, comme
`resolvePrincipal` de la frontière, et déclarez son schéma de sécurité dans le contrat.

## Choisir un modèle

Les trois autorisateurs implémentent le même port `Authorizer` et passent la même suite de
contrat.

| | Rôles (RBAC) | Politiques sur des attributs (ABAC) | Relations (ReBAC) |
|---|---|---|---|
| Classe | `RoleBasedAuthorizer` | `PolicyBasedAuthorizer` | `RelationBasedAuthorizer` (`/rebac`) |
| La question à laquelle il répond | l'un des rôles de l'acteur accorde-t-il cette action ? | les attributs de l'acteur, de la ressource et du moment satisfont-ils une règle ? | existe-t-il un chemin de relations stockées entre cet élément et l'acteur ? |
| Le choisir quand | les droits suivent les fonctions et portent sur des actions, les mêmes pour chaque élément | les droits dépendent de propriétés : service, montant, statut, heure de la journée, avec des refus explicites | les droits sont par élément et partagés : propriété, équipes, dossiers, « quiconque peut modifier le parent » |
| Granularité | l'action, plus un contrôle du *tenant* | l'élément, à travers les attributs que vous fournissez | l'élément, par construction |
| Données à maintenir | une table de rôles dans le code, les rôles dans le jeton | un port `ResourceAttributes` (projection ou cache) | des tuples de relation, écrits quand les agrégats sont créés ou partagés |
| Coût d'un contrôle | constant, aucune E/S | une lecture d'attributs | plusieurs lectures de tuples, bornées par une limite de profondeur |
| Lister (`listAccessible`) | `all`, `none`, ou un `filter` sur le *tenant* : constant | non disponible : un prédicat n'est pas une requête | `ids`, par expansion inverse : croît avec ce que l'acteur peut atteindre |
| Raisons de refus typiques | `NO_MATCHING_ROLE`, `TENANT_MISMATCH` | `NO_MATCHING_POLICY`, `EXPLICIT_DENY` | `NO_RELATION`, `RESOURCE_REQUIRED`, `UNMAPPED_PERMISSION`, `DEPTH_EXCEEDED` |
| Le pourquoi, en mots (`explain`) | les rôles de l'acteur et ce que chacun accorde, puis où la demande peut agir | ce que l'on sait de l'élément, puis chaque politique qui porte sur la permission et si elle a tenu | chaque question posée aux tuples, chaque voie visitée |

**Ce qui change quand vous passez de l'un à l'autre.** L'adaptateur donné à
`authorizationModule`, et les données dont il a besoin. De RBAC à ReBAC : ajoutez `resource:`
aux `requires` des cas d'usage qui n'en nommaient pas (une relation porte toujours sur quelque
chose), nommez chaque permission dans les `derived` du type de son élément, et commencez à
écrire des tuples. Une recherche sur plusieurs éléments nomme une ressource englobante, le contexte
(`{ type: 'context', id: 'docs' }`, ce qu'écrit le générateur) ou le *tenant* de l'acteur, et
`Access.scope` sur le type des éléments restreint ce qu'elle lit. Les permissions, commandes, requêtes, gestionnaires, politiques, routes et tests des
gestionnaires ne changent pas. Les modèles peuvent aussi se superposer : `Access` interroge les
politiques d'instance puis l'autorisateur, donc « des rôles pour les actions, des politiques
pour les quelques règles par élément » ne demande aucun magasin de tuples, et c'est par là qu'il
faut commencer.

Chaque autorisateur refuse l'acteur anonyme (`ANONYMOUS`), et un acteur de type `system` n'a
aucun droit à moins que le modèle ne lui en donne un.

**Pourquoi ce refus.** Chaque autorisateur du kit répond à `explain` par la même décision que
`check` et une trace en mots, une ligne par question qu'il a posée en chemin ; `traceText` met
les lignes en page, `x` devant ce qui n'a pas tenu. Pour une spec ou une console, quand une
décision surprend ; jamais dans une réponse ni dans un journal. `explain` est facultatif sur le
port, comme `listAccessible` : un autorisateur à vous l'ajoute quand il sait dire plus que sa
raison.

<!-- checked sample -->
```ts
import { traceText, type Authorizer, type CheckRequest } from '@ddd-ts-kit/auth';

declare const authorizer: Authorizer;
declare const request: CheckRequest;

export async function why(): Promise<string> {
  const explained = await authorizer.explain?.(request);

  return explained === undefined ? 'this model does not explain itself' : traceText(explained.trace);
}
```

**Ce que toute personne connectée peut faire.** Certaines permissions appartiennent à quiconque
s'est connecté, quoi qu'en dise le modèle : provisionner son propre compte, ouvrir une
organisation, accepter une invitation qui lui est adressée. Les politiques du contexte décident
ensuite sur l'élément. `SignedInGrantsAuthorizer` y répond avant le modèle, quel que soit le
modèle :

```ts
new SignedInGrantsAuthorizer({
  grants: ['identity:*'],                        // les mêmes attributions qu'un rôle : permissions, identifiants, <context>:*, *
  otherwise: new RoleBasedAuthorizer({ roles }), // décide de tout le reste, listes comprises
});
```

Seul un acteur de type `user` détient ces attributions : un système, un service et l'acteur
anonyme vont au modèle. Ce qu'elles couvrent liste `all` ; une autre liste relève du modèle, et
un modèle qui ne sait pas lister la fait échouer avec `ListingNotSupportedError`. Le *preset*
d'identité de la CLI écrit cette enveloppe dans `createAuthorizer` et son attribution dans
`signed-in-grants.ts`.

Une permission de ces attributions liste `all` quel que soit le modèle, avant que le modèle soit
interrogé : toute personne connectée lit tous les éléments. Ce n'est donc jamais le moyen de
faire passer le bus à une recherche que le modèle refuse : attribuez-y la permission de lancer la
recherche (`document.search`), et restreignez la recherche par la portée d'une autre permission
(`document.view`), dont le modèle décide.

### Rôles

<!-- checked sample -->
```ts
import { RoleBasedAuthorizer, tenantOfContext, type PermissionSet } from '@ddd-ts-kit/auth';

declare const billingPermissions: PermissionSet<'billing', 'invoice.read' | 'invoice.void'>;

export const authorizer = new RoleBasedAuthorizer({
  roles: {
    admin: ['*'],
    controller: ['billing:*'],
    clerk: [billingPermissions['invoice.read']],
    automation: [billingPermissions['invoice.read']],
  },
  inherits: { controller: ['clerk'] },          // un controller a tout ce qu'a un clerk
  tenantOf: tenantOfContext,                    // active le contrôle du tenant
  crossTenantRoles: ['admin'],                  // peut agir dans tous les tenants
  systemRole: 'automation',                     // le rôle de systemActor(...), aucun par défaut
});
```

Le rôle système n'est détenu que par un acteur système : parmi les rôles d'un utilisateur ou d'un
service, qu'écrit un jeton ou un en-tête, il est écarté, donc un utilisateur dont les rôles
nomment `automation` ne détient pas ce que détient le système, et `explain` le dit
(`automation is the role of the system, held by a system actor only`). Un rôle qui hérite du rôle
système, directement ou par un autre rôle, est refusé à la construction : par lui, un utilisateur
détiendrait ce que détient le système. Le rôle système peut hériter d'autres rôles.

Un droit accordé est une permission, son identifiant, `<context>:*` ou `*`. Un droit qui ne
pourrait jamais correspondre, un rôle hérité inconnu et un cycle dans la hiérarchie sont refusés
à la construction, de même qu'un rôle multi-*tenant* ou un rôle système qu'aucun rôle ne déclare,
et `crossTenantRoles` sans `tenantOf` : chacun ne ferait rien, sans le dire.

Avec `tenantOf`, le *tenant* que vise une requête est lu dans le `context` de l'exigence :
`requires(X, permission, { context: (command) => ({ tenantId: command.tenantId }) })`. Elle est
refusée quand l'acteur n'y appartient pas (son `tenantId`, ou ses `tenants` pour un acteur de
plusieurs), quand ce n'est pas un identifiant de *tenant*, et quand c'est un autre *tenant* que
celui où s'exécute le travail. La garde du bus et `Access` donnent à l'autorisateur ce *tenant* du
travail (`workTenantId`), lu dans la portée d'exécution, ce que `authorizationModule` câble de
lui-même. Un acteur système appartient au *tenant* où s'exécute son travail (une tâche par
*tenant*, l'événement d'un *tenant*) et à aucun en dehors. Une requête qui ne vise aucun *tenant*
passe : les dépôts la limitent au *tenant* du travail (voir
[Multitenancy](../../docs/concepts/multitenancy.fr.md)).

Une liste est filtrée sur le *tenant* du travail quand l'acteur y appartient, sinon sur le seul
*tenant* d'un acteur qui n'en a qu'un ; un acteur de plusieurs *tenants* hors du travail d'un
*tenant* ne liste rien.

`explain` dit quel rôle accorde, et à travers quel rôle inclus, puis où la demande peut agir.
Pourquoi un commis qui porte aussi un rôle que personne n'a déclaré ne peut pas annuler une
facture, et pourquoi un contrôleur peut en lire une dans le *tenant* acme :

```text
  billing:invoice.void asked of the roles clerk, intern
x   clerk grants billing:invoice.read
x   intern is not a declared role
```

```text
  billing:invoice.read asked of the roles controller
    controller grants billing:*, which covers billing:invoice.read
  the actor belongs to acme, the tenant the request targets
```

### Politiques sur des attributs

<!-- checked sample -->
```ts
import {
  PolicyBasedAuthorizer,
  allOf,
  forbid,
  not,
  permit,
  type Condition,
  type PermissionSet,
  type ResourceAttributes,
} from '@ddd-ts-kit/auth';
import type { Clock } from '@ddd-ts-kit/kernel';

declare const billingPermissions: PermissionSet<'billing', 'invoice.read' | 'invoice.void'>;
declare const clock: Clock;
declare const invoiceAttributes: ResourceAttributes;

const sameDepartment: Condition = ({ actor, attributes }) => actor.attributes['department'] === attributes['department'];
const isLarge: Condition = ({ attributes }) => Number(attributes['amount']) > 10_000;
const secondApproval: Condition = ({ context }) => context['secondApproval'] === true;

export const authorizer = new PolicyBasedAuthorizer({
  clock,                                         // le temps vient du port Clock
  attributes: invoiceAttributes,                 // ResourceAttributes : of(resource) => attributs
  policies: [
    permit('invoice.read-own-department', [billingPermissions['invoice.read']], sameDepartment),
    permit('invoice.managers-void', ['billing:invoice.void'], ({ actor }) => actor.attributes['manager'] === true),
    forbid('invoice.no-large-void', [billingPermissions['invoice.void']], allOf(isLarge, not(secondApproval))),
  ],
});
```

Un `forbid` qui correspond l'emporte sur tous les `permit` ; sans `permit` qui corresponde, la
réponse est non. Les conditions se composent avec `anyOf`, `allOf` et `not`, et voient
`{ actor, permission, resource?, attributes, context, now }`. Un élément que le port ne tient pas
ne répond aucun attribut, et une règle qui en compare un avec rien peut le laisser passer :
`known('amount')` tient quand le port a répondu chaque attribut nommé, de sorte qu'un `forbid`
refuse un élément dont il ne sait rien
(`forbid('invoice.no-void-of-an-unknown-invoice', [voiding], not(known('amount')))`) et qu'un
`permit` exige ce qu'il lit.

`explain` nomme ce que l'on sait de l'élément, par nom d'attribut et jamais par valeur, puis
chaque politique qui porte sur la permission et si elle a tenu. Pourquoi un responsable ne peut
pas annuler une grosse facture :

```text
  invoice:inv-2 is known by department, amount, status
  permit invoice.managers-void holds
  forbid invoice.no-large-void holds, and refuses
```

### Relations

Le schéma dit trois choses, au même endroit : qui est quoi pour quel élément (les relations
stockées), qui compte comme quoi (les relations dérivées), et quelle permission chacune accorde.
Une relation dérivée nommée d'après l'identifiant d'une permission accorde cette permission sur
son type ; il n'y a pas de correspondance à tenir à côté du schéma.

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { InMemoryRelationTupleStore, RelationBasedAuthorizer, defineSchema, via } from '@ddd-ts-kit/auth/rebac';

export const docsPermissions = definePermissions('docs', {
  'document.edit': { description: 'Change a document' },
  'document.view': { description: 'Read a document' },
  'folder.view': { description: 'Read a folder' },
});

const viewFolder = docsPermissions['folder.view'].id;
const editDocument = docsPermissions['document.edit'].id;

const schema = defineSchema({
  user: {},
  group: { relations: { member: ['user', 'group#member'] } },
  folder: {
    relations: { owner: ['user'], viewer: ['user', 'group#member'], parent: ['folder'] },
    derived: {
      edit: { anyOf: ['owner', via('parent', 'edit')] },
      [viewFolder]: { anyOf: ['edit', 'viewer', via('parent', viewFolder)] },
    },
  },
  document: {
    relations: { owner: ['user'], editor: ['user', 'group#member'], banned: ['user'], parent: ['folder'] },
    derived: {
      [editDocument]: { anyOf: ['owner', 'editor', via('parent', 'edit')], butNot: ['banned'] },
      [docsPermissions['document.view'].id]: { anyOf: [editDocument, via('parent', viewFolder)] },
    },
  },
});

export const tupleStore = new InMemoryRelationTupleStore(); // un magasin SQL en production

export const authorizer = new RelationBasedAuthorizer({ schema, store: tupleStore });
```

Chaque ligne se lit comme une phrase. Une relation stockée nomme ce qui peut se trouver à son
autre bout : un type (`'user'`, `'folder'`), ou `'group#member'`, un groupe qui vaut pour ses
membres. Une relation dérivée se détient d'une façon (`edit: 'owner'`, `run: via('desk', 'run')`)
ou de plusieurs : l'une de `anyOf`, chacune de `allOf`, aucune de `butNot`. Un nom est une
relation ou une relation dérivée du même élément ; `via('parent', 'edit')` désigne quiconque
détient `edit` sur les éléments vers lesquels mène la relation `parent`. Ce sont les mots du
langage de modélisation d'OpenFGA, `or`, `and`, `but not` et `from`, sans imbrication : un
ensemble intérieur reçoit un nom à lui, comme `edit` d'un dossier.

| Zanzibar et OpenFGA | Ici |
|---|---|
| tuple de relation `object#relation@subject` | `{ object: 'document:1', relation: 'editor', subject: 'user:ada' }` |
| *userset* comme sujet, `group:eng#member` | `subject: 'group:eng'` : le tuple nomme le groupe ; la relation qui accepte `'group#member'` dit ce qu'il représente |
| *userset* calculé | un nom : `edit: 'owner'`, `anyOf: ['edit', 'viewer']` |
| *tuple to userset*, `edit from parent` | `via('parent', 'edit')` |
| union, intersection, exclusion | `anyOf`, `allOf`, `butNot` |
| Check | `authorizer.check({ actor, permission, resource })` |
| Expand | `authorizer.explain({ actor, permission, resource })` : la décision et une trace en mots |
| recherche inverse | `authorizer.listAccessible({ actor, permission, resourceType })` |

Trois faits stockés suffisent pour voir un droit dérivé. Ada est membre du groupe finance, les
membres de finance voient le dossier reports, et reports est le parent du document q3 :

<!-- checked sample -->
```ts
import type { PermissionSet } from '@ddd-ts-kit/auth';
import type { InMemoryRelationTupleStore, RelationBasedAuthorizer } from '@ddd-ts-kit/auth/rebac';
import type { Actor } from '@ddd-ts-kit/kernel';

// le schéma, le magasin et l'autorisateur du bloc précédent
declare const docsPermissions: PermissionSet<'docs', 'document.edit' | 'document.view' | 'folder.view'>;
declare const tupleStore: InMemoryRelationTupleStore;
declare const authorizer: RelationBasedAuthorizer;

const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };

await tupleStore.write([
  { object: 'group:finance', relation: 'member', subject: 'user:ada' },
  { object: 'folder:reports', relation: 'viewer', subject: 'group:finance' },
  { object: 'document:q3', relation: 'parent', subject: 'folder:reports' },
]);

const q3 = { type: 'document', id: 'q3' };

await authorizer.check({ actor: ada, permission: docsPermissions['document.view'], resource: q3 });
// { allowed: true } : voir q3 inclut voir son parent, qui inclut les lecteurs de reports
await authorizer.check({ actor: ada, permission: docsPermissions['document.edit'], resource: q3 });
// { allowed: false, reason: 'NO_RELATION' } : aucun chemin ne mène à un propriétaire ou à un éditeur
await authorizer.listAccessible({ actor: ada, permission: docsPermissions['document.view'], resourceType: 'document' });
// { kind: 'ids', ids: ['q3'] }
```

Aucun tuple ne dit « ada peut voir q3 » : le droit est dérivé, donc déplacer q3 dans un autre
dossier ou retirer ada de finance le change aussitôt, avec un seul tuple écrit ou supprimé.

`defineSchema` valide à la définition du schéma : un type inconnu, un *userset* d'une relation
qui n'existe pas, une relation qui accepte un même type à la fois comme lui-même et comme
*userset* (un tuple qui nomme un groupe ne saurait dire lequel), une voie qui nomme quelque chose
de non déclaré, un `via` sur quelque chose qui n'est pas une relation vers des éléments ou vers
un type dépourvu du nom demandé, un même nom utilisé pour une relation et une relation dérivée,
une relation dérivée sans aucune voie pour la détenir, et une qui ne lit aucun tuple et ne
pourrait jamais se terminer (`edit: 'view'`, `view: 'edit'`). Une boucle qui passe par des tuples
(des dossiers dans des dossiers, des groupes dans des groupes) est légitime : elle est coupée à
l'exécution par la protection contre les cycles et par `maxDepth` (16 par défaut). Quand la
limite de profondeur coupe une évaluation, la réponse est `DEPTH_EXCEEDED`, jamais une
supposition.

Un acteur est le sujet `<type>:<id>` (`user:ada`, `service:billing-worker`) ; `subjectOf`
change cela. `SchemaCheckedTupleStore` enveloppe un magasin et refuse, à l'écriture, un tuple que
le schéma ne décrit pas : une relation inconnue, un sujet d'un type que la relation n'accepte
pas, un sujet écrit avec un *userset* (`group:eng#member`) là où l'élément seul est attendu.

`explain` répond à « pourquoi est-ce autorisé, ou non » pour le débogage : la décision, et une
ligne par question posée en chemin, en mots. `traceText` met les lignes en page ; `x` marque ce
qui n'a pas tenu et `!` ce qu'un cycle ou la limite de profondeur a coupé. Pourquoi ada ne peut
pas modifier q3 :

```text
  document:q3 docs:document.edit = any of: owner, editor, edit via parent; but not: banned
x   nobody is owner of document:q3
x   nobody is editor of document:q3
    folder:reports edit (parent of document:q3) = any of: owner, edit via parent
x     nobody is owner of folder:reports
x     folder:reports has no parent
```

Et pourquoi elle peut le voir. Une vérification s'arrête à la première voie qui tient ; une
explication parcourt chaque voie, pour que chaque raison se voie :

```text
  document:q3 docs:document.view = any of: docs:document.edit, docs:folder.view via parent
    document:q3 docs:document.edit = any of: owner, editor, edit via parent; but not: banned
x     nobody is owner of document:q3
x     nobody is editor of document:q3
      folder:reports edit (parent of document:q3) = any of: owner, edit via parent
x       nobody is owner of folder:reports
x       folder:reports has no parent
    folder:reports docs:folder.view (parent of document:q3) = any of: edit, viewer, docs:folder.view via parent
      folder:reports edit = any of: owner, edit via parent
x       nobody is owner of folder:reports
x       folder:reports has no parent
      the members of group:finance are viewer of folder:reports
        user:ada is member of group:finance: the actor
x     folder:reports has no parent
```

**Le coût du listage, honnêtement.** `listAccessible` renvoie `{ kind: 'ids' }` par expansion
inverse : en partant de l'acteur, il lit les tuples de chaque sujet qu'il peut atteindre
(l'acteur, ses groupes, les éléments auxquels ils mènent), ce qui coûte une lecture du magasin
par sujet atteint, puis exécute un contrôle par élément du type demandé qu'il a rencontré. Cela
convient à un acteur qui atteint jusqu'à quelques milliers de tuples. Ce n'est pas un index de
recherche : au-delà de `listLimit` sujets atteints (10000 par défaut), il lève
`ReverseExpansionLimitError` plutôt que de renvoyer une liste partielle. Une application avec de
grandes hiérarchies partagées devrait déléguer le listage à un service dédié, ou tenir une
projection des identifiants accessibles.

**Ce qui n'est pas implémenté de Zanzibar.**

- Pas de *zookies* ni de jetons de cohérence : chaque contrôle lit le magasin tel qu'il est à
  l'instant. La cohérence est celle de votre magasin ; le problème du « nouvel ennemi » n'est
  évité que lorsque les tuples sont écrits dans la transaction du changement qu'ils décrivent
  (voir plus bas) et lus depuis le primaire.
- Pas de *caveats* ni de tuples conditionnels. Une condition sur des attributs relève d'une
  politique.
- Pas d'évaluation distribuée, pas de cache des contrôles ni des expansions, pas de
  déduplication ni de *hedging* des requêtes, pas de parallélisation : l'évaluation est
  séquentielle, dans le processus, bornée par `maxDepth`.
- Pas de sujet joker public (`user:*`), pas de versionnement des espaces de noms ni d'outil de
  migration de schéma, pas d'API *watch* ni de journal des changements.
- `explain` est la trace d'un contrôle pour un acteur, pas l'arbre de *usersets* de l'Expand de
  Zanzibar.

**Déléguer à un service dédié.** OpenFGA et SpiceDB implémentent le modèle complet.
[`@ddd-ts-kit/openfga`](../openfga/README.fr.md) implémente les ports `RelationTupleStore` et
`Authorizer` sur OpenFGA, avec le modèle d'autorisation généré à partir du même `defineSchema`
et les deux adaptateurs tenus aux suites de contrat de ce package ; un projet passe de
`RelationBasedAuthorizer` à `OpenFgaAuthorizer` par une liaison. SpiceDB fait correspondre les
deux mêmes méthodes à `CheckPermission` et `LookupResources`, et les écritures de tuples de la
section suivante à `WriteRelationships` ; aucun adaptateur n'est fourni pour lui. Avec l'un ou
l'autre service, l'écriture d'un tuple est un appel distant qui ne peut pas partager la
transaction : elle vient après la validation (commit), avec nouvelles tentatives. Tenez un
adaptateur à `authorizerContract` dans un test d'intégration, et transportez le jeton de
cohérence que le service renvoie dans le `context` de la requête si vous avez besoin de lire vos
propres écritures.

### Garder les relations synchronisées

Le domaine et les gestionnaires n'écrivent jamais de tuples. L'application déclare un port dans
ses propres mots ; l'adaptateur connaît le modèle.

```ts
// application/ports/document-grants.port.ts
export abstract class DocumentGrants {
  abstract ownerAssigned(documentId: string, ownerId: string): Promise<void>;

  abstract sharedWithGroup(documentId: string, groupId: string): Promise<void>;
}

// application/commands/create-document/create-document.handler.ts
async execute(command: CreateDocument): Promise<string> {
  const document = Document.create(this.ids.next(), command.title);
  await this.grants.ownerAssigned(document.id, command.actor.id);
  await this.documents.save(document);
  return document.id;
}

// infrastructure/external/tuple-document-grants.ts
export class TupleDocumentGrants implements DocumentGrants {
  constructor(private readonly tuples: RelationTupleStore) {}

  ownerAssigned(documentId: string, ownerId: string): Promise<void> {
    return this.tuples.write([{ object: `document:${documentId}`, relation: 'owner', subject: `user:${ownerId}` }]);
  }
}
```

Le bus de commandes exécute le gestionnaire dans l'unité de travail, et un `RelationTupleStore`
adossé à SQL écrit dans cette transaction : le document et son tuple de propriétaire sont
validés ensemble ou pas du tout. Un gestionnaire d'événement qui réagit à un événement du
domaine de l'agrégat (`DocumentShared`) peut appeler le même port : les événements du domaine
sont distribués à la fin de l'unité de travail de la commande, avant sa validation, donc avec un
magasin adossé à SQL son tuple est lui aussi validé ou annulé avec l'agrégat. Seul un magasin
qui n'est pas dans cette transaction (un service d'autorisation distant) fait de l'écriture une
seconde étape, qui doit alors être idempotente (écrire deux fois un tuple ne change rien) et
retentée, à travers l'outbox. `test/relationship-sync.spec.ts` est la version testée de
l'écriture depuis le gestionnaire, avec le cas de l'annulation ; tenez votre magasin SQL à
`relationTupleStoreContract`.

## L'acteur courant

**Les cas d'usage le reçoivent explicitement.** C'est une donnée de la commande ou de la requête
(`command.actor`), placée là par la route ou par le consommateur. Les gestionnaires et le
domaine ne lisent jamais un acteur ambiant : un cas d'usage dit alors qui agit dans sa
signature, un test passe qui il veut, et un consommateur ou un *job* n'est pas à la merci d'un
contexte que personne n'a positionné.

**L'infrastructure lit la portée d'exécution.** Les colonnes d'audit et le cloisonnement par
*tenant* s'appliquent à chaque instruction et ne devraient pas traverser chaque méthode de
chaque *repository*. L'`ExecutionScope` du noyau est ouverte une fois par requête HTTP,
événement consommé ou exécution de *job*, à la frontière (l'option `executionScope` de
`@ddd-ts-kit/http`, les gestionnaires d'événements d'intégration et les *jobs* planifiés de
`@ddd-ts-kit/di`), et lue par les adaptateurs seulement, à travers les trois fonctions du
noyau :

```ts
// contexts/billing/infrastructure/persistence/drizzle-invoice.repository.ts
import { stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';

@Repository(InvoiceRepository)
export class DrizzleInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly context: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const [row] = await this.context
      .executor()
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantScopeOf(this.scope).tenantId)));
    return row === undefined ? undefined : toInvoice(row);
  }

  // save : { ...toRow(invoice), ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) }
  // à l'insertion, { ...toRow(invoice), ...stampUpdate(this.scope, this.clock) } à la mise à jour
}
```

Le *repository* complet, testé, est dans le README de chaque *package* d'adaptateur
(`@ddd-ts-kit/drizzle`, `knex`, `prisma`, `typeorm`). `kernelModule()` lie `ExecutionScope` à
une `AsyncLocalStorageExecutionScope`, qui suit la chaîne d'appels asynchrones pour que des
requêtes HTTP concurrentes ne se mélangent jamais, et `ActorContext` à un `ScopedActorContext`
par-dessus : l'acteur courant est l'acteur du contexte d'exécution courant, donc les deux ne
peuvent pas être en désaccord : `ActorContext` est une vue de la portée, et un adaptateur écrit
contre lui continue de fonctionner. Les nouveaux adaptateurs, et ceux que génère la CLI, nomment
`ExecutionScope`. `require()` lève `NoExecutionContextError` (ou `NoCurrentActorError`) quand
une frontière n'a rien ouvert, une erreur de câblage trouvée par le premier test, et
`tenantScopeOf` lève `NoCurrentTenantError` pour un travail qui ne nomme aucun *tenant*, répondue
par un 403. C'est de la
défense en profondeur, pas de l'autorisation : le filtre par *tenant* d'un *repository*
empêche un bug de laisser fuiter des lignes, la permission reste décidée dans la couche
application.

## Champs réservés à certains appelants

Un champ d'une réponse ou d'un corps de requête HTTP que seuls certains appelants peuvent voir ou
poser n'est pas un test de rôle dans un sérialiseur : il est marqué sur son schéma avec
`withFieldAccess` de `@ddd-ts-kit/http`, et décidé par l'`Access` de ce *package*, comme un cas
d'usage l'est : `fieldDeciderOf({ access, clock })` prend un `Access` tel qu'il est, une
permission est demandée avec `decideOn` (ses politiques, puis l'autorisateur), et une politique
écrite avec `definePolicy` peut être nommée directement sur le champ.
`Access.decideOn({ actor, permission, subject, context, recorded })` est `decide` avec ce qu'un
cas d'usage ajoute par `@Requires` (`context`), et `recorded: false` pour une décision qui ne fait
que façonner une réponse, un champ montré ou écarté, qui n'atteint alors pas `onDecision` ; un
champ posé dans un corps et un formulaire ouvert restent enregistrés. `decideOn` est facultatif
sur un `Access` du projet : le décideur demande alors `decide`, qui enregistre tout. Le mode
d'emploi est dans le README de `@ddd-ts-kit/http` (« Champs réservés à certains appelants »).

## Filtrer les listes

Une liste est filtrée par la requête, jamais en mémoire après le chargement. Une page filtrée
après sa lecture montre moins de lignes que demandé, et son total compte des lignes que l'acteur
ne peut pas voir :

![Filtrer une liste. Au lieu de lire une page de tous les tenants et de la filtrer en mémoire, ce qui montre 3 lignes au lieu de 20 et un total faux, le gestionnaire demande un AccessScope à access.scope et le port de lecture le traduit en clause WHERE : la base de données renvoie la bonne page et le bon total. Pour chaque sorte de périmètre, le port de lecture n'ajoute rien pour all, n'exécute aucune requête pour none, ajoute une égalité par entrée pour filter, et une liste id IN pour ids ; les politiques sur des attributs ne savent pas lister](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/auth-package-list-scope.fr.svg)

Le gestionnaire demande un périmètre et le remet au port de lecture :

```ts
// application/queries/search-invoices/search-invoices.handler.ts
async execute(query: SearchInvoices): Promise<readonly InvoiceSummary[]> {
  const scope = await this.access.scope(query.actor, billingPermissions['invoice.read'], 'invoice');
  return this.invoices.search(scope, query.page);
}
```

```ts
// infrastructure/persistence/drizzle-invoice-read-model.ts
function whereOf(scope: AccessScope): SQL | undefined {
  switch (scope.kind) {
    case 'all':
      return undefined;
    case 'none':
      return sql`false`;
    case 'ids':
      return inArray(invoices.id, [...scope.ids]);
    case 'filter':
      return and(...Object.entries(scope.filter).map(([column, value]) => eq(columnOf(column), value)));
  }
}
```

| `AccessScope` | Donné par | Le port de lecture |
|---|---|---|
| `{ kind: 'all' }` | RBAC quand le rôle accorde la permission ; `SignedInGrantsAuthorizer` pour ce que couvrent ses attributions, quel que soit le modèle | n'ajoute rien |
| `{ kind: 'none' }` | n'importe quel modèle, et toujours pour l'acteur anonyme | renvoie une page vide sans interroger la base |
| `{ kind: 'filter', filter }` | RBAC avec le contrôle du *tenant* : `{ tenantId }` | ajoute une égalité par entrée, sur les colonnes qu'il choisit de faire correspondre |
| `{ kind: 'ids', ids }` | ReBAC | ajoute `id IN (...)`, ou une jointure sur une table temporaire quand la liste est longue |

`Access.scope` lève `ListingNotSupportedError` quand l'autorisateur n'a pas de
`listAccessible` (politiques sur des attributs) : mieux vaut un échec bruyant qu'une liste
filtrée en silence par une supposition.

## Tester

<!-- checked sample -->
```ts
import { anActor, AllowAll, RecordingAuthorizer, authorizerContract } from '@ddd-ts-kit/auth/testing';

const accountant = anActor().named('ada').ofTenant('acme').withRole('accountant').build();
```

- **Les gestionnaires.** `createTestApplication({ modules: [billingModule] })` autorise chaque
  cas d'usage : une *spec* de gestionnaire ne porte pas sur les droits. `actor` fixe qui
  l'infrastructure voit à travers `ActorContext` (par défaut : l'utilisateur `test-user`) ;
  `app.actorContext.actAs(actor)` le change. L'acteur d'un cas d'usage est celui que le test met
  dans la commande.
- **La permission d'un cas d'usage.** `holdersOf(permission, ...autres)` donne `holder`, un
  utilisateur du rôle `holder`, et `authorizer`, qui accorde les permissions à ce rôle et à tout
  acteur système (une tâche planifiée, une réaction) et refuse tous les autres, dont un acteur
  de `anActor()` seul : `const { holder, authorizer } = holdersOf(billingPermissions['invoice.issue'])`,
  puis `authorizationModule({ authorizer })` ou `authorizationMiddleware({ authorizer, map })`.
  Les *specs* générées des gestionnaires, des requêtes et des tâches planifiées arrangent leurs
  droits avec lui.
- **Les droits d'un contexte.** Listez `authorizationModule({ authorizer })` avec le vrai
  modèle, ou avec un `RecordingAuthorizer` pour vérifier ce qui a été demandé sous forme de
  données (`authorizer.checks`) ; remplacez l'autorisateur d'une application composée par
  `fake(Authorizer, new AllowAll())`. Ajoutez `authorization: 'required'` pour qu'un cas
  d'usage sans déclaration fasse échouer la *spec* au câblage.
- **Les politiques.** De simples objets : appelez `policy.allows(actor, subject, { now })`,
  comme ci-dessous.
- **Les frontières.** `FakeAuthenticator({ 'token-of-ada': ada })` derrière
  `principalResolver` ; un justificatif peut représenter une session entière,
  `{ 'token-of-support': aSession().of(ada).impersonatedBy('support-7').build() }`.
- **Vos propres adaptateurs.** Tenez un `Authorizer` (un adaptateur OpenFGA, un modèle sur
  mesure) à `authorizerContract(runner, { name, create })` et un magasin de tuples à
  `relationTupleStoreContract(runner, { name, create })`, avec `{ describe, it, expect,
  beforeEach }` de votre *runner*.

Une *spec* de politique n'a besoin ni d'application, ni de conteneur, ni de *fake* : la
politique, deux acteurs, un sujet et un instant.

<!-- checked sample -->
```ts
// contexts/billing/application/authorization/only-issuer-voids.policy.spec.ts
import { definePermissions, definePolicy } from '@ddd-ts-kit/auth';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { describe, expect, it } from 'vitest';

const billingPermissions = definePermissions('billing', {
  'invoice.void': { description: 'Void an issued invoice' },
});

interface IssuedInvoice {
  readonly issuedBy: string;
}

const onlyIssuerVoids = definePolicy<IssuedInvoice>({
  name: 'invoice.only-issuer-voids',
  permission: billingPermissions['invoice.void'],
  allows: (actor, invoice) => actor.id === invoice.issuedBy,
});

describe('only the issuer voids an invoice', () => {
  const now = new Date('2026-01-01T09:00:00.000Z');
  const issuedByAda: IssuedInvoice = { issuedBy: 'ada' };

  it('lets the issuer void it', () => {
    expect(onlyIssuerVoids.allows(anActor().named('ada').build(), issuedByAda, { now })).toBe(true);
  });

  it('refuses anybody else, whatever their roles', () => {
    const admin = anActor().named('bob').withRole('admin').build();

    expect(onlyIssuerVoids.allows(admin, issuedByAda, { now })).toBe(false);
  });
});
```

Quand elle renvoie `false` à travers `Access`, la raison de la `ForbiddenError` est le nom de la
politique, `invoice.only-issuer-voids`.

`anActor()` renvoie un `ActorBuilder`, un `Builder` de `@ddd-ts-kit/testing`, donc il s'imbrique
dans d'autres *builders* (`anInvoice().issuedBy(anActor().named('ada'))`) et il est immuable
comme eux. `AllowAll` et `DenyAll` sont des *stubs* pour les *specs* qui ne portent pas sur les
droits ; ils ne sont pas tenus au contrat de l'autorisateur, qu'ils contredisent par
construction.

## Les raccourcis que cette conception supprime

Le plus courant d'abord. Au lieu d'une route qui décide qui peut faire quoi :

```ts
// contexts/billing/presentation/http/void-invoice.route.ts : ce que ce package supprime
async ({ params, context }) => {
  const user = context.principal as { id: string; roles: string[] };
  if (!user.roles.includes('controller')) {
    return { status: 403 };                       // un job ou un consommateur ne passe jamais ici
  }
  const invoice = await invoices.findById(params.invoiceId);
  if (invoice.issuedBy !== user.id) {
    return { status: 403 };                       // une règle que personne ne peut trouver, tester ni auditer
  }
  invoice.void(new Date());                       // et un gestionnaire contourné
  await invoices.save(invoice);
  return { status: 204 };
};
```

écrivez chaque décision là où elle a sa place : l'action sur le cas d'usage, l'élément dans une
politique nommée, et la route ne fait que construire la commande.

<!-- checked sample -->
```ts
import { definePermissions, definePolicy, requires } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';

declare class Invoice {
  readonly issuedBy: string;
}

export const billingPermissions = definePermissions('billing', {
  'invoice.void': { description: 'Void an issued invoice' },
});

export class VoidInvoice extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly invoiceId: string,
  ) {
    super(actor);
  }
}

// L'action : vérifiée par le bus pour chaque appelant, qu'il soit une route, un job ou un consommateur.
export const voidInvoiceRequirement = requires(VoidInvoice, billingPermissions['invoice.void'], {
  resource: (command) => ({ type: 'invoice', id: command.invoiceId }),
});

// L'élément : une règle nommée avec sa propre spec, interrogée par le gestionnaire une fois la facture chargée.
export const onlyIssuerVoids = definePolicy<Invoice>({
  name: 'invoice.only-issuer-voids',
  permission: billingPermissions['invoice.void'],
  appliesTo: (subject): subject is Invoice => subject instanceof Invoice,
  allows: (actor, invoice) => actor.id === invoice.issuedBy,
});
```

La route de l'[étape 6](#6-une-route) n'est alors qu'une correspondance de la requête HTTP vers
`VoidInvoice`, et les rôles vivent dans la racine de composition. Le tableau liste les autres
raccourcis et la règle qui attrape chacun d'eux.

| Raccourci | Pourquoi il n'est plus nécessaire | Attrapé par |
|---|---|---|
| un test de rôle dans un contrôleur ou une route (`if (!user.roles.includes('admin'))`) | la route ne fait que construire la commande ; le *middleware* du bus décide | `authz/in-application` |
| `if (user.isAdmin)` ou un test de propriété dans un agrégat ou un service du domaine | les droits sont des permissions et des politiques dans `application/authorization/` ; le domaine porte les invariants | `authz/in-application`, `layer/domain-purity` |
| un cas d'usage accessible parce que personne n'y a pensé | `.requires(...)` ou `.public()`, sinon l'application n'est pas créée (`authorization: 'required'`) et le message est refusé (`UndeclaredUseCaseError`) | `authz/declared` |
| un gestionnaire qui lit « l'utilisateur courant » dans une variable globale ou une portée de requête HTTP | l'acteur est le premier argument de `AuthorizedCommand` et `AuthorizedQuery` ; `requires` ne compile pas sans lui | `authz/actor-explicit` |
| un *repository* ou un adaptateur qui décide par rôle qui peut voir une ligne | l'infrastructure n'applique que le périmètre qu'on lui remet et le *tenant* de l'`ExecutionScope` | `authz/in-application` |
| `invoices.filter((invoice) => canRead(user, invoice))` après le chargement | `Access.scope` donne un `AccessScope` que le port de lecture traduit en clause `WHERE` | `authz/in-application` |
| le jeton brut transmis jusqu'à un gestionnaire ou stocké sur l'objet utilisateur | `Authenticator` renvoie un `Actor`, de simples données sans le justificatif | `authz/actor-explicit` |
| des chaînes de `if` sur la propriété et le statut dans un gestionnaire | une politique nommée avec sa propre *spec*, interrogée à travers `Access.authorize` | `authz/in-application` |
| `new Date()` dans une règle liée au temps | les politiques et les conditions reçoivent `now` du port `Clock` | `purity/no-system-clock` |
| une chaîne du modèle (`'admin'`, `'editor'`) éparpillée dans le code | les rôles et les relations n'apparaissent que dans la racine de composition et dans les adaptateurs ; le code nomme des permissions | `authz/in-application` |
| un refus renvoyé avec un message qui cite l'élément | `Decision.reason` est un code machine stable, vérifié par la suite de contrat | la suite de contrat |
| un contournement ponctuel « pour la démo » | une dérogation est enregistrée comme une décision, ou c'est un défaut | `governance/recorded-deviation` |
