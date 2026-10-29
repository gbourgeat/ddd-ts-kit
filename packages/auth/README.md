**English** · [Français](README.fr.md)

# @ddd-ts-kit/auth

Authentication and authorization behind ports: who is calling, what they may do, and on which
element, without a role test in a controller or an `if (user.isAdmin)` in the domain. The
authorization model (roles, attribute policies, relationships in the manner of Google Zanzibar)
is the project's choice, behind one port.

```
npm i @ddd-ts-kit/auth
npm i jose            # only for @ddd-ts-kit/auth/jwt
```

| Entry | Holds | Imports |
|---|---|---|
| `@ddd-ts-kit/auth` | permissions, `requires`, `AuthorizationMap`, `authorizationMiddleware`, the ports `Authorizer`, `Access`, `Authenticator` and `SessionAuthenticator`, policies and `PolicyAccess`, `RoleBasedAuthorizer`, `PolicyBasedAuthorizer`, HTTP glue | the kernel only |
| `@ddd-ts-kit/auth/rebac` | schema DSL, relation tuples, `RelationTupleStore`, `RelationBasedAuthorizer` | the kernel only |
| `@ddd-ts-kit/auth/jwt` | `JwtAuthenticator`, `keycloakAuthenticator` | `jose` (optional peer), the only file that does |
| `@ddd-ts-kit/auth/passport` | `passportPrincipal`: a strategy of Passport as the `resolvePrincipal` of the HTTP boundary | nothing: it runs the strategy it is given |
| `@ddd-ts-kit/auth/di` | `authorizationModule`, `authorizationMapOf`, and again the classes the module binds: `Authorizer`, `Authenticator`, `Access`, `AuthorizationMap` | `@ddd-ts-kit/di` (optional peer) |
| `@ddd-ts-kit/auth/testing` | `anActor()` and its `ActorBuilder`, `holdersOf()`, `AllowAll`, `DenyAll`, `RecordingAuthorizer`, `FakeAuthenticator`, the two contract suites | `@ddd-ts-kit/testing` (optional peer), the runner you pass |

The actor model lives in `@ddd-ts-kit/kernel`: `Actor`, `anonymousActor()`, `systemActor(name)`,
`AuthorizedCommand`, `AuthorizedQuery`, the `ActorContext` port and its two implementations.

## Three responsibilities, three places

| Responsibility | Question | Where it lives | With what |
|---|---|---|---|
| Authentication | who is calling? | the platform, at the boundary (`src/platform/auth`, routes, consumers) | an adapter of `Authenticator` verifies the credential and produces an `Actor`, and a `SessionAuthenticator` the whole `Session`: plain data, never the token |
| Authorization | may this actor do this, on this? | the application layer of each context (`application/authorization/`) | permissions declared as data, one requirement per use case checked by a bus middleware, policies for rules that need loaded state, all through the `Authorizer` port |
| Invariants | is this a valid state of the business? | the domain | aggregates and `DomainError`s. "An invoice cannot be paid twice" is not a permission |

![The place of the package in an application: the platform turns the bearer token into a Session and its Actor with principalResolver and an Authenticator; the route puts the actor in the command; the guard of the command bus refuses an undeclared use case and asks the Authorizer before the handler; the handler loads the element and asks Access, which runs the policies then the Authorizer; the aggregate imports nothing of the package; four classes implement the one Authorizer port](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/auth-package-place.svg)

Nothing is reachable by default. A command or a query that declares neither a permission nor
that it is public is refused, at run time by the middleware and, when you ask for it, when the
application is created.

Guards are not a fourth place. A guard of `@ddd-ts-kit/http` (`Authenticated`, `HasRole(..)`, a
guard of the project) is a control at the edge over a set of routes: it reads the caller and
the request, and refuses before the controller runs. It never replaces the permission of a use
case, which a job, an event handler or another transport meets without passing any guard, and
it never loads an element to decide. The rule is `presentation/guard-at-the-edge`.

## The smallest working example

Before the complete example, the mechanism in one file, with no container and no HTTP: a
permission, a command that carries its actor, the requirement, a role model and the guard on a
command bus of the kernel. Run it as it is: the comments say what it prints.

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

// 1. The permissions of the context, as data.
const billingPermissions = definePermissions('billing', {
  'invoice.void': { description: 'Void an issued invoice' },
});

// 2. A use case that carries its actor.
class VoidInvoice extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly invoiceId: string,
  ) {
    super(actor);
  }
}

// 3. What each use case requires. A message missing from the map is refused.
const map = AuthorizationMap.of(requires(VoidInvoice, billingPermissions['invoice.void']));

// 4. The model: here, roles. Only a controller may void.
const authorizer = new RoleBasedAuthorizer({
  roles: { controller: [billingPermissions['invoice.void']], clerk: [] },
});

// 5. The guard runs on the bus, before the handler.
const decisions: DecisionRecord[] = [];
const commands = new InMemoryCommandBus()
  .use(authorizationMiddleware({ authorizer, map, onDecision: (record) => void decisions.push(record) }))
  .register(VoidInvoice, { execute: async (command) => console.log(`voided ${command.invoiceId}`) });

const grace: Actor = { id: 'grace', type: 'user', roles: ['controller'], attributes: {} };
const bob: Actor = { id: 'bob', type: 'user', roles: ['clerk'], attributes: {} };

await commands.execute(new VoidInvoice(grace, 'inv-1')); // prints "voided inv-1"

const refused = await commands.execute(new VoidInvoice(bob, 'inv-1')).catch((error: unknown) => error);
console.log(refused instanceof ForbiddenError && refused.reason); // NO_MATCHING_ROLE, answered 403

const nobody = await commands.execute(new VoidInvoice(anonymousActor(), 'inv-1')).catch((error: unknown) => error);
console.log(nobody instanceof UnauthenticatedError && nobody.code); // UNAUTHORIZED, answered 401

console.log(decisions.map(({ actorId, decision }) => `${actorId}: ${decision.allowed}`));
// [ 'grace: true', 'bob: false', 'anonymous: false' ]
```

The handler never saw `bob` nor the anonymous caller, and holds no `if` about roles. Every
piece has its place in a real project: the permissions in `application/authorization/`, the
command next to its handler, the requirement on the message or in the module, the model and the
guard in the composition root, where `authorizationModule` installs them for you. The complete
example below puts each one there.

## A complete example

### 1. Permissions, declared by the context that owns them

<!-- checked sample -->
```ts
// contexts/billing/billing.permissions.ts
import { definePermissions } from '@ddd-ts-kit/auth';

export const billingPermissions = definePermissions('billing', {
  'invoice.issue': { description: 'Issue an invoice to a customer' },
  'invoice.read': { description: 'Read invoices' },
  'invoice.void': { description: 'Void an issued invoice' },
});
// billingPermissions['invoice.issue'].id === 'billing:invoice.issue', typed as that literal
```

`PermissionRegistry.of(billingPermissions, catalogPermissions)` lists them all (`all()`,
`contexts()`, `inContext(name)`, `find(id)`): documentation and administration screens are
generated from it, never written by hand. The names are checked when they are declared: a
context name is one lower-case word, a permission name lower-case words separated by dots
(each word starts with a letter; digits and dashes are allowed). Anything else throws `AuthorizationSetupError` when the file is
loaded, and so does `PermissionRegistry.of` for an id declared twice: a mistake found at
start-up, never a refusal found in production.

### 2. Use cases that carry their actor

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

The actor is the first constructor argument: a call site cannot forget it, and the compiler
refuses `requires` on a message that has none. `Command` and `Query` stay for public use cases.

### 3. The requirement, on the message or next to the handler registration

A project generated by the CLI uses the declared style by default: the requirement is written
on the message with `@Requires` or `@Public`, shown below, and there is no module file. The
explicit style writes it in `<context>.module.ts`:

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

The handler checks nothing for the permission: the guard of the bus decides it before the
handler runs. It asks `Access` only when a policy refines that permission, once it holds the
element (section 4). `resource` names the element the right bears on, `context` passes facts of
the message the authorizer may need (the tenant it targets).

The same requirement said on the message itself, with the declarations of the kernel, for a
declared context:

```ts
// contexts/billing/application/commands/void-invoice/void-invoice.command.ts
import { Requires } from '@ddd-ts-kit/kernel/declarations';

@Requires(billingPermissions['invoice.void'], {
  resource: (command: VoidInvoice) => ({ type: 'invoice', id: command.invoiceId }),
})
export class VoidInvoice extends AuthorizedCommand { /* ... */ }

// void-invoice.handler.ts: Access comes from '@ddd-ts-kit/auth', which the application layer may import
@CommandHandler(VoidInvoice)
export class VoidInvoiceHandler implements CommandHandler<VoidInvoice> { /* ... */ }
```

`@Public()` is the counterpart of `.public()`. Both forms feed the same authorization map and
the same `authorization: 'required'` check; written on the builder, a requirement wins over
the one of the message. A policy class declared with
`@Policy(permission, { name: 'invoice.only-issuer-voids' })` (an `allows(actor, subject, { now })`
method, and `appliesTo(subject)` when it must tell its subjects apart) is evaluated by
`Access` next to the policies given to `authorizationModule`.

The ports of this package are abstract classes, and the class is what a constructor parameter, a
binding or a test names: `Authorizer`, `Access`, `Authenticator`, `SessionAuthenticator` and
`ResourceAttributes` from `@ddd-ts-kit/auth`, `RelationTupleStore` from
`@ddd-ts-kit/auth/rebac`. An adapter `implements` its port and never extends it; a plain
object with the same methods stands for it in a test.

### 4. A policy, for a rule that needs the loaded element

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

`Access.authorize` asks every policy of the permission, then the authorizer, and raises
`ForbiddenError` with a reason code: the name of the policy that answered `false`, the code
the policy or the authorizer gave, or `SUBJECT_MISMATCH` when the subject is not one `appliesTo`
accepts. The anonymous actor is refused before any policy is asked, with `UnauthenticatedError`
(401), as on the bus. A policy is a plain object: its spec calls
`onlyIssuerVoidsSameDay.allows(actor, invoice, { now })` and needs nothing else.

A protected use case meets two checkpoints. The guard of the bus decides on the action, before
the handler and before any transaction; `Access` decides on the element, once the handler has
loaded it. Each refusal has its error, its code and its HTTP status:

![The two checkpoints. The guard of the bus: an undeclared message fails with UndeclaredUseCaseError, a public one runs with no check, a protected one without actor fails with MissingActorError, the anonymous actor is refused with UnauthenticatedError (401), and a refusal of the Authorizer is a ForbiddenError (403) with its reason; allowed, the unit of work opens and the handler runs. Access in the handler: the anonymous actor is refused with UnauthenticatedError, each policy of the permission is asked, then the Authorizer about the resource; allowed, the aggregate changes. Both hand every decision to onDecision](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/auth-package-two-checkpoints.svg)

`UndeclaredUseCaseError` and `MissingActorError` are not refusals: they say the code is wrong,
fail the first test that sends the message, and are never answered as a 403.

`Access` is the port the handler depends on; `PolicyAccess` is its implementation, which
`authorizationModule` binds. `PolicyAccessOptions.resourceOf` says how a subject names its
resource (`invoice => ({ type: 'invoice', id: invoice.id })`) when the authorizer decides per
element. By default only a plain `{ type, id }` is taken as a resource reference. A
`PolicyAccess` built by hand without an authorizer refuses, with `NO_POLICY`, a permission that
no policy answers for: deny by default holds there too.

### 5. The composition root

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

The module binds `Authorizer`, `Access` (a `PolicyAccess` over the authorizer, the policies and
the `Clock` of the application), the `AuthorizationMap` built from what the use cases declared
and, when one is given, `Authenticator`. Each is resolved by its class:

```ts
const authorizer = app.resolve(Authorizer);
const declared = app.resolve(AuthorizationMap).declarations(); // for documentation and administration screens
```

An authenticator that has dependencies of its own is bound by a module of the platform
instead of being given as an option:

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

`authorizationModule` binds the guard that the command and query buses of `kernelModule()` run
before anything else, the unit of work included: a refused command opens no transaction. A bus
of your own, given through `kernelModule({ commandBus })`, has to run the guard itself:
`.use((message, next, info) => resolve(UseCaseGuard).check(message, next, info))`, `UseCaseGuard`
being the port of `@ddd-ts-kit/di` the module binds.

When a policy refines the permission of a use case, the guard also wraps its handler, last on the
bus and inside the unit of work: a handler that returns without asking `Access` about that
permission has its result refused with `PolicyNotAskedError` and its change rolled back, since the
rule of the policy was never applied. A bus of your own runs that part around its handler, with
`.aroundHandler((message, next, info) => resolve(UseCaseGuard).within?.(message, next, info) ?? next())`.
Without the container, `policiesAskedMiddleware({ map, refined })` is the same check. Only the
questions put to `PolicyAccess` are seen: a project that binds its own `Access` passes
`policiesAsked: false`.
`authorization: 'required'` makes `createApplication` throw a `WiringError`
(`UNDECLARED_AUTHORIZATION`) naming every command and query that has neither `.requires(...)`
nor `.public()`, and another (`AUTHORIZATION_NOT_ENFORCED`) when no module binds a guard. The
default is `'optional'` for now, so existing modules keep working; with it, an undeclared use
case is still refused when it is sent, with `UndeclaredUseCaseError`, as soon as
`authorizationModule` is listed.

`onDecision` is the audit hook. It receives `{ actorId, permissionId, resource?, decision,
useCase?, kind? }` (`kind` is `command` or `query`, as the bus says) for every decision, allowed or refused, and a hook that throws refuses the request:
no decision goes unrecorded.

Without `@ddd-ts-kit/di`, the same pieces are assembled by hand:

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

### 6. A route

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
  resolvePrincipal: principalResolver(app.resolve(Authenticator)), // answers a Session
  executionScope: app.resolve(ExecutionScope),
};
// passed to the adapter of @ddd-ts-kit/http: mountExpress(server, routes, options)
```

The route maps a request to a command and nothing else. It contains no role, no ownership
test and no status code for a refusal: `UnauthenticatedError` and `InvalidCredentialError`
carry the code `UNAUTHORIZED`, `ForbiddenError` carries `FORBIDDEN`, the codes the default
error mapping of `@ddd-ts-kit/http` answers with 401 and 403.

`principalResolver` reads `Authorization: Bearer <token>` from the framework request; a header
that is present and is not a well-formed bearer credential is refused, never treated as an
anonymous call. It answers a kernel `Session` (the anonymous session without credential), which
the pipeline puts, with its actor, in the execution context of the request, and which the
`executionScope` option makes ambient for infrastructure: `ActorContext` of `kernelModule()`
reads its actor from that scope (see "The current actor"). An integration event handler and a
scheduled job open nothing themselves: `@ddd-ts-kit/di` runs each event in an execution
context of origin `event` whose actor is `systemActor('<consumer name>')`, and the scheduler
runs each job in one of origin `schedule` whose actor is `systemActor('<context>.<job-name>')`.
The handler or the job puts that same actor in the command it sends:
`commands.execute(new SendReminders(systemActor('billing.send-reminders'), execution.scheduledAt))`.

| Reading | Gives |
|---|---|
| `actorOf(context.principal)` | the actor, anonymous when there is none; also accepts the context itself |
| `sessionOf(context)` | the session: who, since when, until when, how it was authenticated, `impersonatedBy` |
| `context.execution` | the whole execution context: correlation id, tenant, locale, deadline |

`inActorContext(actorContext, handler)` keeps working for a project that has an `ActorContext`
and no execution scope: it runs the handler inside `ActorContext.run`.

## Authentication

### Actors and sessions

`Authenticator` answers an `Actor`. `SessionAuthenticator` extends it with
`authenticateSession(credential): Promise<Session>`, for an adapter whose credential knows more
than who: the session id, when it was issued and when it expires, the method and strength of
the authentication, who is impersonating. A separate port rather than a required method, so an
adapter that only knows actors (an API key table, a development header) stays three lines; the
boundary does not care which one it gets:

```ts
import { resolveSession } from '@ddd-ts-kit/auth';

const session = await resolveSession(authenticator, credential);
// a SessionAuthenticator answers its own session; for a plain Authenticator the session is
// derived from the actor and says only what is known: id of the actor as session id, no
// issue instant (the epoch), no expiry, method `token`
```

### JSON Web Tokens

`JwtAuthenticator` verifies the signature, the issuer, the audience, the expiry and the
algorithm (asymmetric families only unless told otherwise; `alg: none` is always refused), and
is a `SessionAuthenticator`. Nothing of the token is kept in the actor or in the session. The
verification key, which may be a shared secret, is not a property of the authenticator:
logging or serializing the object shows no key.

| Field of the session | Claim |
|---|---|
| `id` | `sid`, else `jti`, else the subject and the issue instant |
| `issuedAt`, `expiresAt` | `iat`, `exp` |
| `authenticationMethod` | `password` when `amr` lists `pwd`, else `token`; or the `authenticationMethod` option, a value or a function of the claims |
| `authenticationStrength` | `mfa` when `amr` lists `mfa` (RFC 8176), `assuranceLevel` from `acr` |
| `impersonatedBy` | the `sub` of the `act` claim (RFC 8693), or the claim named by `impersonatorClaim`: the id itself, or an object holding it under `sub` or `id` |
| `locale`, `timeZone` | `locale`, `zoneinfo` |
| `scopes` | `scope`, the space-separated list of OAuth 2.0, else `scp` as a list; absent when the token grants none. `HasScope` of `@ddd-ts-kit/http` reads them at the edge |
| `extensions` | what `toSessionExtensions(claims)` answers |

```ts
import { JwtAuthenticator } from '@ddd-ts-kit/auth/jwt';

new JwtAuthenticator({
  jwksUri: 'https://id.example.com/realms/shop/protocol/openid-connect/certs', // or key: publicKey
  issuer: 'https://id.example.com/realms/shop',
  audience: 'shop-api',
  algorithms: ['RS256'],        // default DEFAULT_JWT_ALGORITHMS: RS256, PS256, ES256, EdDSA
  clockTolerance: 5,            // seconds, default 0
  requireExpiry: true,          // the default: a token without exp is refused
  tenantClaim: 'tenant_id',     // the default
  toActor: (claims) => actor,   // replaces the default mapping
});
```

The default mapping takes the subject as the actor, its roles (below), the tenant claim (a text
claim is the tenant; a list names the tenant when it holds one, and the `tenants` attribute of
an actor of several, among which a request names the one it works in), and the standard claims
of OpenID Connect as attributes: `username` (`preferred_username`), `email`, and `emailVerified`
(`email_verified`), which a use case that trusts the address (an invitation sent to it) reads.

`authenticate(undefined)` answers the anonymous actor. A token that is expired, without `exp`,
not valid yet, for another audience or issuer, signed with another key, altered, unsigned
(`alg: none`), or using an algorithm outside the allow-list raises `InvalidCredentialError`
(code `UNAUTHORIZED`) with a reason code: `TOKEN_EXPIRED`, `NO_EXPIRY`, `CLAIM_MISMATCH`,
`BAD_SIGNATURE`, `ALGORITHM_NOT_ALLOWED`, `UNKNOWN_KEY`, `MALFORMED_TOKEN`, `UNSUPPORTED_TOKEN`,
`NO_SUBJECT`. A key set that cannot be fetched is not a refusal: the error is left as it is and
answered as a 5xx.

A token must carry `exp`: one that never expires works for whoever steals it until its key is
revoked. `requireExpiry: false` accepts it, a conscious choice for an issuer whose tokens never
expire; an `exp` that is present is checked all the same. `DEFAULT_JWT_ALGORITHMS`, exported by
the main entry, is the allow-list used when `algorithms` is not given.

The default mapping for OIDC: `id` from `sub` (required), `type: 'user'`, `tenantId` from the
tenant claim when it is a string, no attribute, and `roles` from `realm_access.roles` (realm
roles) when present, else from `roles` (a list or space-separated words), never merged. The
scopes are never roles: a scope a client asked for must not pass for a role, so a token that
carries only `scope` gives an actor with no role, its scopes in `session.scopes` for `HasScope`.
A provider whose tokens carry only scopes maps its roles with `toActor`. The actor keeps nothing
of the token. Map service accounts to `type: 'service'` with `toActor`.

### Keycloak

```ts
import { keycloakAuthenticator } from '@ddd-ts-kit/auth/jwt';

const authenticator = keycloakAuthenticator({
  baseUrl: 'https://id.example.com', // without the realm
  realm: 'shop',
  audience: 'shop-api',              // what the `aud` claim must name
  clientId: 'shop-api',              // optional: its client roles join the realm roles
  tenantClaim: 'organization',       // optional, default `tenant_id`
  requireExpiry: true,               // the default: a token without exp is refused
});
```

It derives the issuer (`<baseUrl>/realms/<realm>`) and the key set
(`<issuer>/protocol/openid-connect/certs`, fetched and cached, rotated keys followed), and maps
an access token as follows:

| Field | Claim |
|---|---|
| `actor.id` | `sub` |
| `actor.type` | `service` when `preferred_username` starts with `service-account-` (a client using the client credentials grant), else `user` |
| `actor.roles` | `realm_access.roles`, plus `resource_access.<clientId>.roles` when `clientId` is given, each once |
| `actor.attributes` | `username` from `preferred_username`, `email`, `emailVerified` from `email_verified`, `groups` from the `groups` claim (or `groupsClaim`), and `tenants` when the tenant claim names several |
| `actor.tenantId` | the claim named by `tenantClaim`: a text claim, or the `organization` claim (a list of aliases, or an object keyed by alias) when it names exactly one organization; several are the `tenants` attribute |
| `session.id` | `sid`, the session of the realm; `jti` for a service account, which has none |
| `session.authenticationMethod` | `sso` for a person, `service` for a service account |
| `session.authenticationStrength` | `assuranceLevel` from `acr` |
| `session.impersonatedBy` | the claim named by `impersonatorClaim` (default `act`) |

What to configure in the realm, for these claims to be in the access token:

1. **A client for the API** (`shop-api`): client authentication on, no flow enabled (it only
   receives tokens: what used to be called bearer-only). It holds the client roles, if you use
   them.
2. **An audience mapper.** By default the `aud` of an access token does not name your API (it
   is `account`, or absent), and the token is refused with `CLAIM_MISMATCH`. On the client the
   users sign in with (the front end), or in a client scope it has by default: add a mapper of
   type *Audience*, *Included Client Audience* `shop-api`, *Add to access token* on.
3. **The roles mappers.** The built-in client scope `roles`, a default scope of every client,
   already writes `realm_access.roles` (mapper *realm roles*) and
   `resource_access.<client>.roles` (mapper *client roles*). Check that the front-end client
   kept it, and that *Full scope allowed* is on, or that the roles you expect are in its scope
   mappings: Keycloak only writes the roles in the scope of the client that asked for the token.
4. **Groups**, if you authorize on them: a mapper of type *Group Membership*, *Token Claim Name*
   `groups`, *Add to access token* on. *Full group path* decides between `/finance/europe`
   and `europe`; the attribute holds what the mapper writes.
5. **The tenant**, one of: a mapper of type *User Attribute* writing `tenant_id` from an
   attribute of the user; or, with Organizations enabled in the realm, the client scope
   `organization` requested by the front end, and `tenantClaim: 'organization'`. A user who
   belongs to several organizations gets no default tenant from that claim: they are the
   `tenants` of the actor, and each request names the one it works in (`x-tenant-id`, which the
   HTTP adapter refuses with 403 for a tenant the actor does not hold).
6. **Impersonation**, if support staff impersonate users from the admin console: Keycloak
   keeps the administrator in the session notes of the impersonated session. A mapper of type
   *User Session Note*, *User Session Note* `IMPERSONATOR_ID`, *Token Claim Name*
   `impersonator_id`, with `impersonatorClaim: 'impersonator_id'`, puts it in
   `session.impersonatedBy`, which `logFieldsOf` carries to every log line.

`preferred_username` and `email` come from the built-in `profile` and `email` scopes. The
preset never calls Keycloak beyond the key set: a revoked session is refused when its access
token expires, so keep the access token lifespan short.

### Passport

A project that authenticates with a strategy of Passport keeps it: `passportPrincipal` runs the
strategy on each request, as `passport.authenticate` does, and answers the session the pipeline
puts in the execution context. The guards of the routes and the permissions of the use cases
then decide, on every door, as with the authenticators above.

```ts
import { passportPrincipal } from '@ddd-ts-kit/auth/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

const strategy = new Strategy(
  { jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: settings.jwtSecret },
  (payload, done) => done(null, payload),
);

const resolvePrincipal = passportPrincipal(strategy, {
  // What the verify callback handed to `done`, read as a mapper reads what enters.
  actorOf: (user) => accountActorOf(user),
});
```

A class written with `PassportStrategy` of `@nestjs/passport` is a strategy too: what its
`validate` answers is the user `actorOf` reads. Nest may build it with what it injects; give
`passportPrincipal` a function that answers the instance once Nest has started.

It fails closed:

| The strategy | The call |
|---|---|
| succeeds | goes on as the actor `actorOf` answers |
| fails a request that presents a credential | is refused, 401 (`InvalidCredentialError`) |
| fails a request that presents none | goes on anonymous, for the guards of the route to decide |
| passes | goes on anonymous |
| errs, or throws | is refused, the error reported as any other |
| redirects (an OAuth sign-in) | is refused: a sign-in flow is served by the platform, not by the authentication of a call |
| answers nothing within `timeoutMs` (10 s) | is refused |

A credential is presented when the request carries an `Authorization` header; a strategy that
reads a cookie says where with `presented: (raw) => ...`. The `InvalidCredentialError` of a
refusal carries the reason the strategy failed with when it is a code (`fail({ message:
'NO_EXPIRY' })`, in upper snake case), and `refused-by-strategy` otherwise: the message of a
library (`invalid signature`) is not a code.

`passportAuthenticator(strategy, { actorOf })` is the same strategy behind the `Authenticator`
port: the bearer credential is handed to the strategy as `Authorization: Bearer <credential>`,
so that the procedures, the scripts and the end-to-end tests authenticate through it too.
`actorOfClaims(claims)` reads the claims of a token as `JwtAuthenticator` does, for the
`actorOf` of a strategy that hands its payload on. `ddd-ts-kit init --authn passport` writes
that platform: a strategy of `passport-jwt` on the key set of the issuer (`jwks-rsa`), its
`actorOf`, and the end-to-end credentials signed for it. It verifies bearer tokens, as
`--authn jwt` does, with the strategy in the code of the project: it refuses a token without
`exp` unless given `requireExpiry: false`, and allows `DEFAULT_JWT_ALGORITHMS` but EdDSA, which
`jsonwebtoken` (under `passport-jwt`) cannot verify: an EdDSA issuer needs `--authn jwt`.
Another strategy that reads a bearer token (opaque tokens through `passport-http-bearer`, an
introspection) takes its place in `bearer-strategy.ts`. A strategy that reads a cookie or a session does not go through the
`Authenticator` port, which only receives a credential: give it to `passportPrincipal`, which
receives the request itself, as the `resolvePrincipal` of the boundary, and declare its security
scheme in the contract.

## Choosing a model

The three authorizers implement the same `Authorizer` port and pass the same contract suite.

| | Roles (RBAC) | Attribute policies (ABAC) | Relationships (ReBAC) |
|---|---|---|---|
| Class | `RoleBasedAuthorizer` | `PolicyBasedAuthorizer` | `RelationBasedAuthorizer` (`/rebac`) |
| The question it answers | does one of the actor's roles grant this action? | do the attributes of the actor, the resource and the moment satisfy a rule? | is there a path of stored relationships from this element to the actor? |
| Choose it when | rights follow job functions and bear on actions, the same for every element | rights depend on properties: department, amount, status, time of day, with explicit refusals | rights are per element and shared: ownership, teams, folders, "whoever can edit the parent" |
| Granularity | action, plus a tenant check | element, through attributes you supply | element, by construction |
| Data to maintain | a role table in code, roles in the token | a `ResourceAttributes` port (projection or cache) | relation tuples, written when aggregates are created or shared |
| Cost of a check | constant, no I/O | one attribute read | several tuple reads, bounded by a depth limit |
| Listing (`listAccessible`) | `all`, `none`, or a tenant `filter`: constant | not available: a predicate is not a query | `ids`, by reverse expansion: grows with what the actor can reach |
| Typical denial reasons | `NO_MATCHING_ROLE`, `TENANT_MISMATCH` | `NO_MATCHING_POLICY`, `EXPLICIT_DENY` | `NO_RELATION`, `RESOURCE_REQUIRED`, `UNMAPPED_PERMISSION`, `DEPTH_EXCEEDED` |
| Why, in words (`explain`) | the roles of the actor and what each one grants, then where the request may act | what is known of the element, then each policy that bears on the permission and whether it held | every question asked of the tuples, every way visited |

**What changes when you switch.** The adapter given to `authorizationModule`, and the data it
needs. From RBAC to ReBAC: add `resource:` to the `requires` of the use cases that did not name
one (a relationship is always to something), name each permission in the `derived` of the type
of its element, and start writing tuples. A search across many elements names an enclosing resource, the context
(`{ type: 'context', id: 'docs' }`, what the generator writes) or the tenant of the actor, and
`Access.scope` on the type of the elements narrows what it reads. Permissions, commands, queries, handlers, policies, routes and tests of
handlers do not change. Models can also be layered: `Access` asks the instance policies and
then the authorizer, so "roles for actions, policies for the few per-element rules" needs no
tuple store at all, and is the place to start.

Every authorizer refuses the anonymous actor (`ANONYMOUS`), and an actor of type `system` has no
right unless the model gives it one.

**Why was it refused.** Every authorizer of the kit answers `explain` with the same decision as
`check` and a trace in words, one line per question it asked on the way; `traceText` lays the
lines out, `x` before what did not hold. For a spec or a console, when a decision surprises;
never in an answer or a log. `explain` is optional on the port, like `listAccessible`: an
authorizer of your own adds it when it can say more than its reason.

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

**What every signed-in person may do.** Some permissions belong to everyone who signed in,
whatever the model says of them: provisioning one's own account, opening an organisation,
accepting an invitation addressed to oneself. The policies of the context then decide on the
element. `SignedInGrantsAuthorizer` answers them before the model, for any model:

```ts
new SignedInGrantsAuthorizer({
  grants: ['identity:*'],                        // the same grants as a role: permissions, ids, <context>:*, *
  otherwise: new RoleBasedAuthorizer({ roles }), // decides everything else, listings included
});
```

Only an actor of type `user` holds these grants: a system, a service and the anonymous actor go
to the model. What they cover lists `all`; another listing is the model's, and a model that
cannot list makes it fail with `ListingNotSupportedError`. The identity preset of the CLI writes
this wrapper in `createAuthorizer` and its grant in `signed-in-grants.ts`.

A permission in these grants lists `all` whatever the model, before the model is asked: every
signed-in person reads every element. It is never the way to let a search past the bus when the
model refuses it: grant there the permission of running the search (`document.search`), and
narrow the search by the scope of another one (`document.view`), which the model decides.

### Roles

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
  inherits: { controller: ['clerk'] },          // a controller has all a clerk has
  tenantOf: tenantOfContext,                    // turns the tenant check on
  crossTenantRoles: ['admin'],                  // may act in every tenant
  systemRole: 'automation',                     // the role of systemActor(...), none by default
});
```

The system role is held by a system actor only: among the roles of a user or a service, which a
token or a header writes, it is left out, so a user whose roles name `automation` does not hold
what the system holds, and `explain` says so (`automation is the role of the system, held by a
system actor only`). A role that inherits the system role, directly or through another role, is
refused at construction: through it, a user would hold what the system holds. The system role
may inherit other roles.

A grant is a permission, its id, `<context>:*` or `*`. A grant that could never match, an
unknown inherited role and a cycle in the hierarchy are refused at construction, and so are a
cross-tenant role or a system role that no role declares and `crossTenantRoles` without
`tenantOf`: each would silently do nothing.

With `tenantOf`, the tenant a request targets is read from the `context` of the requirement:
`requires(X, permission, { context: (command) => ({ tenantId: command.tenantId }) })`. It is
refused when the actor does not belong to it (its `tenantId`, or its `tenants` for an actor of
several), when it is not a tenant id at all, and when it is another tenant than the one the work
runs in. The guard of the bus and `Access` give the authorizer that tenant of the work
(`workTenantId`) from the execution scope, which `authorizationModule` wires on its own. A system
actor belongs to the tenant its work runs in (a per-tenant job, the event of a tenant) and to
none outside of one. A request that targets no tenant passes: the repositories keep it to the
tenant of the work (see [Multitenancy](../../docs/concepts/multitenancy.md)).

A list is filtered on the tenant of the work, when the actor belongs to it, else on the one
tenant of an actor that has one; an actor of several tenants outside of a tenant's work lists
nothing.

`explain` says which role grants, and through which included role, then where the request may
act. Why a clerk who also carries a role nobody declared may not void an invoice, and why a
controller may read one in the tenant acme:

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

### Attribute policies

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
  clock,                                         // time comes from the Clock port
  attributes: invoiceAttributes,                 // ResourceAttributes: of(resource) => attributes
  policies: [
    permit('invoice.read-own-department', [billingPermissions['invoice.read']], sameDepartment),
    permit('invoice.managers-void', ['billing:invoice.void'], ({ actor }) => actor.attributes['manager'] === true),
    forbid('invoice.no-large-void', [billingPermissions['invoice.void']], allOf(isLarge, not(secondApproval))),
  ],
});
```

A matching `forbid` wins over every `permit`; with no matching `permit` the answer is no.
Conditions compose with `anyOf`, `allOf` and `not`, and see `{ actor, permission, resource?,
attributes, context, now }`.

`explain` names what is known of the element, by attribute name and never by value, then each
policy that bears on the permission and whether it held. Why a manager may not void a large
invoice:

```text
  invoice:inv-2 is known by department, amount, status
  permit invoice.managers-void holds
  forbid invoice.no-large-void holds, and refuses
```

### Relationships

The schema says three things, in one place: who is what to which element (the stored relations),
who counts as what (the derived relations), and which permission each one grants. A derived
relation named after a permission id grants that permission on its type; there is no mapping to
keep next to the schema.

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

export const tupleStore = new InMemoryRelationTupleStore(); // a SQL store in production

export const authorizer = new RelationBasedAuthorizer({ schema, store: tupleStore });
```

Each line reads as a sentence. A stored relation names what may stand at its other end: a type
(`'user'`, `'folder'`), or `'group#member'`, a group standing for its members. A derived relation
is held in one way (`edit: 'owner'`, `run: via('desk', 'run')`) or in several: one of `anyOf`,
every one of `allOf`, none of `butNot`. A name is a relation or a derived relation of the same
element; `via('parent', 'edit')` is whoever holds `edit` on the elements the relation `parent`
leads to. These are the words of the modelling language of OpenFGA, `or`, `and`, `but not` and
`from`, without nesting: an inner set gets a name of its own, as `edit` of a folder does.

| Zanzibar and OpenFGA | Here |
|---|---|
| relation tuple `object#relation@subject` | `{ object: 'document:1', relation: 'editor', subject: 'user:ada' }` |
| userset as a subject, `group:eng#member` | `subject: 'group:eng'`: the tuple names the group; the relation that accepts `'group#member'` says what it stands for |
| computed userset | a name: `edit: 'owner'`, `anyOf: ['edit', 'viewer']` |
| tuple to userset, `edit from parent` | `via('parent', 'edit')` |
| union, intersection, exclusion | `anyOf`, `allOf`, `butNot` |
| Check | `authorizer.check({ actor, permission, resource })` |
| Expand | `authorizer.explain({ actor, permission, resource })`: the decision and a trace in words |
| reverse lookup | `authorizer.listAccessible({ actor, permission, resourceType })` |

Three stored facts are enough to see a derived right. Ada is a member of the group finance, the
members of finance view the folder reports, and reports is the parent of the document q3:

<!-- checked sample -->
```ts
import type { PermissionSet } from '@ddd-ts-kit/auth';
import type { InMemoryRelationTupleStore, RelationBasedAuthorizer } from '@ddd-ts-kit/auth/rebac';
import type { Actor } from '@ddd-ts-kit/kernel';

// the schema, the store and the authorizer of the block above
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
// { allowed: true }: view of q3 includes view of its parent, which includes the viewers of reports
await authorizer.check({ actor: ada, permission: docsPermissions['document.edit'], resource: q3 });
// { allowed: false, reason: 'NO_RELATION' }: no path leads to an owner or an editor
await authorizer.listAccessible({ actor: ada, permission: docsPermissions['document.view'], resourceType: 'document' });
// { kind: 'ids', ids: ['q3'] }
```

No tuple says "ada may view q3": the right is derived, so moving q3 to another folder or
removing ada from finance changes it at once, with one tuple written or deleted.

`defineSchema` validates when the schema is defined: an unknown type, a userset of a relation
that does not exist, a relation accepting one type both as itself and as a userset (a tuple
naming a group could not say which), a way naming something undeclared, a `via` over something
that is not a relation to elements or towards a type lacking the name, one name used for a
relation and a derived relation, a derived relation with no way of being held, and one that
reads no tuple and could never terminate (`edit: 'view'`, `view: 'edit'`). A loop that goes
through tuples (folders in folders, groups in groups) is legitimate: it is cut at run time by
cycle protection and by `maxDepth` (default 16). When the depth limit cuts an evaluation the
answer is `DEPTH_EXCEEDED`, never a guess.

An actor is the subject `<type>:<id>` (`user:ada`, `service:billing-worker`); `subjectOf`
changes that. `SchemaCheckedTupleStore` wraps a store and refuses, on write, a tuple the schema
does not describe: an unknown relation, a subject of a type the relation does not accept, a
subject written with a userset (`group:eng#member`) where the element alone is expected.

`explain` answers "why is this allowed, or not" for debugging: the decision, and one line per
question asked on the way, in words. `traceText` lays the lines out; `x` marks what did not hold
and `!` what a cycle or the depth limit cut. Why ada may not edit q3:

```text
  document:q3 docs:document.edit = any of: owner, editor, edit via parent; but not: banned
x   nobody is owner of document:q3
x   nobody is editor of document:q3
    folder:reports edit (parent of document:q3) = any of: owner, edit via parent
x     nobody is owner of folder:reports
x     folder:reports has no parent
```

And why she may view it. A check stops at the first way that holds; an explanation visits every
way, so that each reason is seen:

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

**The cost of listing, honestly.** `listAccessible` returns `{ kind: 'ids' }` by reverse
expansion: starting from the actor it reads the tuples of every subject it can reach (the
actor, its groups, the elements those lead to), which costs one store read per reached
subject, then runs one check per element of the requested type it met. That is fine for an
actor reaching up to a few thousand tuples. It is not a search index: beyond `listLimit`
reached subjects (default 10000) it throws `ReverseExpansionLimitError` rather than return a
partial list. An application with large shared hierarchies should delegate listing to a
dedicated service, or keep a projection of accessible ids.

**What of Zanzibar is not implemented.**

- No zookies or consistency tokens: every check reads the store as it is now. Consistency is
  that of your store; the "new enemy" problem is avoided only when tuples are written in the
  transaction of the change they describe (below) and read from the primary.
- No caveats or conditional tuples. A condition on attributes belongs to a policy.
- No distributed evaluation, no check or expand caching, no request deduplication or hedging,
  no parallel fan-out: the evaluation is sequential, in process, bounded by `maxDepth`.
- No public wildcard subject (`user:*`), no namespace versioning or schema migration tooling,
  no watch API or changelog.
- `explain` is the trace of one check for one actor, not the userset tree of Zanzibar's Expand.

**Delegating to a dedicated service.** OpenFGA and SpiceDB implement the full model.
[`@ddd-ts-kit/openfga`](../openfga/README.md) answers the `RelationTupleStore` and `Authorizer`
ports on OpenFGA, with the authorization model generated from the same `defineSchema` and both
adapters held to the contract suites of this package; a project moves from
`RelationBasedAuthorizer` to `OpenFgaAuthorizer` by binding. SpiceDB maps the same two methods
to `CheckPermission` and `LookupResources`, and the tuple writes of the next section to
`WriteRelationships`; no adapter is shipped for it. With either service, a tuple write is a
remote call that cannot share the transaction: it goes after the commit, retried. Hold an adapter
to `authorizerContract` in an integration test, and carry the consistency token the service
returns in the `context` of the request if you need read-your-writes.

### Keeping relationships in sync

The domain and the handlers never write tuples. The application declares a port in its own
words; the adapter knows the model.

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

The command bus runs the handler in the unit of work, and a SQL-backed `RelationTupleStore`
writes in that transaction: the document and its owner tuple are committed together or not at
all. An event handler reacting to a domain event of the aggregate (`DocumentShared`) can call
the same port: domain events are dispatched at the end of the unit of work of the command,
before its commit, so with a SQL-backed store its tuple commits or rolls back with the aggregate too. Only a store
that is not in that transaction (a remote authorization service) makes the write a second
step, which must then be idempotent (writing a tuple twice changes nothing) and retried,
through the outbox. `test/relationship-sync.spec.ts` is the tested version of the write from
the handler, with the rollback case; hold your SQL store to `relationTupleStoreContract`.

## The current actor

**Use cases get it explicitly.** It is data of the command or query (`command.actor`), put
there by the route or the consumer. Handlers and the domain never read an ambient actor: a use
case then says who acts in its signature, a test passes whoever it wants, and a consumer or a
job is not at the mercy of a context nobody set.

**Infrastructure reads the execution scope.** Audit columns and tenant scoping apply to every
statement and should not be threaded through every method of every repository. The
`ExecutionScope` of the kernel is opened once per request, consumed event or job run at the
boundary (the `executionScope` option of `@ddd-ts-kit/http`, the integration event handlers
and the scheduled jobs of `@ddd-ts-kit/di`), and read by adapters only, through the three
helpers of the kernel:

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

  // save: { ...toRow(invoice), ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) }
  // on insert, { ...toRow(invoice), ...stampUpdate(this.scope, this.clock) } on update
}
```

The whole repository, tested, is in the README of each adapter package (`@ddd-ts-kit/drizzle`,
`knex`, `prisma`, `typeorm`). `kernelModule()` binds `ExecutionScope` to an
`AsyncLocalStorageExecutionScope`, which follows the asynchronous call chain so concurrent
requests never mix, and `ActorContext` to a `ScopedActorContext` over it: the current actor is
the actor of the current execution context, so the two cannot disagree: `ActorContext` is a
view of the scope, and an adapter written against it keeps working. New adapters, and the
ones the CLI generates, name `ExecutionScope`. `require()` throws `NoExecutionContextError` (or
`NoCurrentActorError`) when a boundary opened nothing, and `tenantScopeOf` throws
`NoCurrentTenantError` for work that names no tenant: wiring mistakes, found by the first test.
This is defence in depth, not authorization: the tenant filter of a repository stops a bug from
leaking rows, the permission is still decided in the application layer.

## Fields reserved to some callers

A field of an answer or of a request body that only some callers may see or set is not a role
test in a serializer: it is marked on its schema with `withFieldAccess` of `@ddd-ts-kit/http`,
and decided by the `Access` of this package, as a use case is: `fieldDeciderOf({ access, clock })`
takes an `Access` as it is, a permission is asked with `decideOn` (its policies, then the
authorizer), and a policy written with `definePolicy` can be named on the field directly.
`Access.decideOn({ actor, permission, subject, context, recorded })` is `decide` with what a
use case adds through `@Requires` (`context`), and `recorded: false` for a decision that only
shapes an answer, a field shown or left out, which then does not reach `onDecision`; a field set
in a body and a form opened stay recorded. `decideOn` is optional on an `Access` of the project:
the decider then asks `decide`, which records everything. The how-to is in the README of
`@ddd-ts-kit/http` ("Fields reserved to some callers").

## Filtering lists

A list is filtered by the query, never in memory after loading. A page filtered after it was
read shows fewer rows than asked, and its total counts rows the actor may not see:

![Filtering a list. Instead of reading a page of every tenant and filtering it in memory, which shows 3 rows instead of 20 and a wrong total, the handler asks access.scope for an AccessScope and the read port turns it into a WHERE clause, so the database answers the right page and the right total. For each kind of scope, the read port adds nothing for all, runs no query for none, one equality per entry for filter, and an id IN list for ids; the attribute policies cannot list](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/auth-package-list-scope.svg)

The handler asks for a scope and hands it to the read port:

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

| `AccessScope` | Given by | The read port |
|---|---|---|
| `{ kind: 'all' }` | RBAC when the role grants the permission; `SignedInGrantsAuthorizer` for what its grants cover, whatever the model | adds nothing |
| `{ kind: 'none' }` | any model, and always for the anonymous actor | returns an empty page without querying |
| `{ kind: 'filter', filter }` | RBAC with the tenant check: `{ tenantId }` | adds one equality per entry, on columns it chooses to map |
| `{ kind: 'ids', ids }` | ReBAC | adds `id IN (...)`, or joins a temporary table when the list is long |

`Access.scope` throws `ListingNotSupportedError` when the authorizer has no `listAccessible`
(attribute policies): better a loud failure than a list silently filtered by a guess.

## Testing

<!-- checked sample -->
```ts
import { anActor, AllowAll, RecordingAuthorizer, authorizerContract } from '@ddd-ts-kit/auth/testing';

const accountant = anActor().named('ada').ofTenant('acme').withRole('accountant').build();
```

- **Handlers.** `createTestApplication({ modules: [billingModule] })` allows every use case: a
  handler spec is not about rights. `actor` sets who infrastructure sees through
  `ActorContext` (default: the user `test-user`); `app.actorContext.actAs(actor)` changes it.
  The actor of a use case is the one the test puts in the command.
- **The permission of a use case.** `holdersOf(permission, ...more)` gives `holder`, a user
  of the role `holder`, and `authorizer`, which grants the permissions to that role and to every
  system actor (a job, a reaction) and refuses everybody else, an actor of `anActor()` alone
  among them: `const { holder, authorizer } = holdersOf(billingPermissions['invoice.issue'])`,
  then `authorizationModule({ authorizer })` or `authorizationMiddleware({ authorizer, map })`.
  The generated handler, query and job specs arrange their rights with it.
- **Rights of a context.** List `authorizationModule({ authorizer })` with the real model, or
  with a `RecordingAuthorizer` to assert what was asked as data (`authorizer.checks`); replace
  the authorizer of a composed application with `fake(Authorizer, new AllowAll())`. Add
  `authorization: 'required'` so that a use case without declaration fails the spec at wiring.
- **Policies.** Plain objects: call `policy.allows(actor, subject, { now })`, as below.
- **Boundaries.** `FakeAuthenticator({ 'token-of-ada': ada })` behind `principalResolver`; a credential may stand for a whole session, `{ 'token-of-support': aSession().of(ada).impersonatedBy('support-7').build() }`.
- **Your own adapters.** Hold an `Authorizer` (an OpenFGA adapter, a custom model) to
  `authorizerContract(runner, { name, create })` and a tuple store to
  `relationTupleStoreContract(runner, { name, create })`, with `{ describe, it, expect,
  beforeEach }` of your runner.

A policy spec needs no application, no container and no fake: the policy, two actors, a
subject and an instant.

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

When it answers `false` through `Access`, the reason of the `ForbiddenError` is the policy name,
`invoice.only-issuer-voids`.

`anActor()` answers an `ActorBuilder`, a `Builder` of `@ddd-ts-kit/testing`, so it nests in
other builders (`anInvoice().issuedBy(anActor().named('ada'))`) and is immutable like them. `AllowAll` and
`DenyAll` are stubs for specs that are not about rights; they are not held to the authorizer
contract, which they contradict by design.

## The shortcuts this design removes

The most common one first. Instead of a route that decides who may do what:

```ts
// contexts/billing/presentation/http/void-invoice.route.ts: what this package removes
async ({ params, context }) => {
  const user = context.principal as { id: string; roles: string[] };
  if (!user.roles.includes('controller')) {
    return { status: 403 };                       // a job or a consumer never passes here
  }
  const invoice = await invoices.findById(params.invoiceId);
  if (invoice.issuedBy !== user.id) {
    return { status: 403 };                       // a rule nobody can find, test or audit
  }
  invoice.void(new Date());                       // and a handler bypassed
  await invoices.save(invoice);
  return { status: 204 };
};
```

write each decision where it belongs: the action on the use case, the element in a named
policy, and the route only builds the command.

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

// The action: checked by the bus for every caller, a route, a job or a consumer alike.
export const voidInvoiceRequirement = requires(VoidInvoice, billingPermissions['invoice.void'], {
  resource: (command) => ({ type: 'invoice', id: command.invoiceId }),
});

// The element: a named rule with a spec of its own, asked by the handler once the invoice is loaded.
export const onlyIssuerVoids = definePolicy<Invoice>({
  name: 'invoice.only-issuer-voids',
  permission: billingPermissions['invoice.void'],
  appliesTo: (subject): subject is Invoice => subject instanceof Invoice,
  allows: (actor, invoice) => actor.id === invoice.issuedBy,
});
```

The route of [step 6](#6-a-route) is then a mapping from the request to `VoidInvoice`, and the
roles live in the composition root. The table lists the other shortcuts and the rule that
catches each one.

| Shortcut | Why it is not needed any more | Caught by |
|---|---|---|
| a role test in a controller or a route (`if (!user.roles.includes('admin'))`) | the route only builds the command; the bus middleware decides | `authz/in-application` |
| `if (user.isAdmin)` or an ownership test in an aggregate or a domain service | rights are permissions and policies in `application/authorization/`; the domain holds invariants | `authz/in-application`, `layer/domain-purity` |
| a use case reachable because nobody thought about it | `.requires(...)` or `.public()`, or the application is not created (`authorization: 'required'`) and the message is refused (`UndeclaredUseCaseError`) | `authz/declared` |
| a handler reading "the current user" from a global or a request scope | the actor is the first argument of `AuthorizedCommand` and `AuthorizedQuery`; `requires` does not compile without it | `authz/actor-explicit` |
| a repository or an adapter deciding who may see a row by role | infrastructure only applies the scope it is handed and the tenant of the `ExecutionScope` | `authz/in-application` |
| `invoices.filter((invoice) => canRead(user, invoice))` after loading | `Access.scope` gives an `AccessScope` the read port turns into a `WHERE` clause | `authz/in-application` |
| the raw token passed down to a handler or stored on the user object | `Authenticator` answers an `Actor`, plain data without the credential | `authz/actor-explicit` |
| `if` chains over ownership and status inside a handler | a named policy with a spec of its own, asked through `Access.authorize` | `authz/in-application` |
| `new Date()` in a rule about time | policies and conditions receive `now` from the `Clock` port | `purity/no-system-clock` |
| a string of the model (`'admin'`, `'editor'`) scattered in the code | roles and relations appear only in the composition root and in adapters; the code names permissions | `authz/in-application` |
| a refusal answered with a message quoting the element | `Decision.reason` is a stable machine code, checked by the contract suite | the contract suite |
| a one-off bypass "for the demo" | a deviation is recorded as a decision or it is a defect | `governance/recorded-deviation` |
