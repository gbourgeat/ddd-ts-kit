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
| `@ddd-ts-kit/auth` | permissions, `requires`, `AuthorizationMap`, `authorizationMiddleware`, `Authorizer`, policies and `Access`, `RoleBasedAuthorizer`, `PolicyBasedAuthorizer`, `Authenticator`, HTTP glue | the kernel only |
| `@ddd-ts-kit/auth/rebac` | schema DSL, relation tuples, `RelationTupleStore`, `RelationBasedAuthorizer` | the kernel only |
| `@ddd-ts-kit/auth/jwt` | `JwtAuthenticator` | `jose` (optional peer), the only file that does |
| `@ddd-ts-kit/auth/di` | `authorizationModule`, the tokens `AUTHORIZER`, `AUTHENTICATOR`, `AUTHORIZATION_MAP`, `ACCESS` | `@ddd-ts-kit/di` (optional peer) |
| `@ddd-ts-kit/auth/testing` | `anActor()`, `AllowAll`, `DenyAll`, `RecordingAuthorizer`, `FakeAuthenticator`, the two contract suites | `@ddd-ts-kit/testing` (optional peer), the runner you pass |

The actor model lives in `@ddd-ts-kit/kernel`: `Actor`, `anonymousActor()`, `systemActor(name)`,
`AuthorizedCommand`, `AuthorizedQuery`, the `ActorContext` port and its two implementations.

## Three responsibilities, three places

| Responsibility | Question | Where it lives | With what |
|---|---|---|---|
| Authentication | who is calling? | the platform, at the boundary (`src/platform/auth`, routes, consumers) | an adapter of `Authenticator` verifies the credential and produces an `Actor`: plain data, never the token |
| Authorization | may this actor do this, on this? | the application layer of each context (`application/authorization/`) | permissions declared as data, one requirement per use case checked by a bus middleware, policies for rules that need loaded state, all through the `Authorizer` port |
| Invariants | is this a valid state of the business? | the domain | aggregates and `DomainError`s. "An invoice cannot be paid twice" is not a permission |

Nothing is reachable by default. A command or a query that declares neither a permission nor
that it is public is refused, at run time by the middleware and, when you ask for it, when the
application is created.

## A complete example

### 1. Permissions, declared by the context that owns them

```ts
// contexts/billing/application/authorization/billing.permissions.ts
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
generated from it, never written by hand.

### 2. Use cases that carry their actor

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

### 3. The requirement, next to the handler registration

```ts
// contexts/billing/billing.module.ts
import { defineContextModule } from '@ddd-ts-kit/di';

export const billingModule = defineContextModule({
  name: 'billing',
  register(builder) {
    builder
      .command(IssueInvoice)
      .requires(billingPermissions['invoice.issue'])
      .handledBy(IssueInvoiceHandler, [INVOICE_REPOSITORY, ID_GENERATOR]);
    builder
      .command(VoidInvoice)
      .requires(billingPermissions['invoice.void'], {
        resource: (command) => ({ type: 'invoice', id: command.invoiceId }),
      })
      .handledBy(VoidInvoiceHandler, [INVOICE_REPOSITORY, ACCESS, CLOCK]);
    builder.query(GetCatalog).public().handledBy(GetCatalogHandler, [CATALOG]);
  },
});
```

No decorator, and the handler is not touched. `resource` names the element the right bears on,
`context` passes facts of the message the authorizer may need (the tenant it targets).

### 4. A policy, for a rule that needs the loaded element

```ts
// contexts/billing/application/authorization/only-issuer-voids-same-day.policy.ts
import { definePolicy } from '@ddd-ts-kit/auth';

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
    if (invoice === undefined) throw new NotFoundError('Invoice not found');
    await this.access.authorize(command.actor, billingPermissions['invoice.void'], invoice);
    invoice.void(this.clock.now());
    await this.invoices.save(invoice);
  }
}
```

`Access.authorize` asks every policy of the permission, then the authorizer, and raises
`ForbiddenError` with a reason code: the name of the policy that answered `false`, or the code
the policy or the authorizer gave. A policy is a plain object: its spec calls
`onlyIssuerVoidsSameDay.allows(actor, invoice, { now })` and needs nothing else.

`AccessOptions.resourceOf` says how a subject names its resource (`invoice => ({ type: 'invoice',
id: invoice.id })`) when the authorizer decides per element. By default only a plain
`{ type, id }` is taken as a resource reference.

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

`authorizationModule` binds the guard that the command and query buses of `kernelModule()` run
before anything else, the unit of work included: a refused command opens no transaction. A bus
of your own, given through `kernelModule({ commandBus })`, has to run the guard itself:
`.use((message, next, info) => resolve(USE_CASE_GUARD)(message, next, info))`.
`authorization: 'required'` makes `createApplication` throw a `WiringError`
(`UNDECLARED_AUTHORIZATION`) naming every command and query that has neither `.requires(...)`
nor `.public()`, and another (`AUTHORIZATION_NOT_ENFORCED`) when no module binds a guard. The
default is `'optional'` for now, so existing modules keep working; with it, an undeclared use
case is still refused when it is sent, with `UndeclaredUseCaseError`, as soon as
`authorizationModule` is listed.

`onDecision` is the audit hook. It receives `{ actorId, permissionId, resource?, decision,
useCase? }` for every decision, allowed or refused, and a hook that throws refuses the request:
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
import { actorOf, inActorContext } from '@ddd-ts-kit/auth';

export const voidInvoiceRoute = (commandBus: CommandBus, actorContext: ActorContext) =>
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
    inActorContext(actorContext, async ({ params, context }) => {
      await commandBus.execute(new VoidInvoice(actorOf(context.principal), params.invoiceId));
      return { status: 204 };
    }),
  );
```

```ts
// platform/http/server.ts
import { principalResolver } from '@ddd-ts-kit/auth';

const resolvePrincipal = principalResolver(app.resolve(AUTHENTICATOR));
// passed to the adapter of @ddd-ts-kit/http: executeRoute(route, request, { resolvePrincipal })
```

The route maps a request to a command and nothing else. It contains no role, no ownership
test and no status code for a refusal: `UnauthenticatedError` and `InvalidCredentialError`
carry the code `UNAUTHORIZED`, `ForbiddenError` carries `FORBIDDEN`, the codes the default
error mapping of `@ddd-ts-kit/http` answers with 401 and 403.

`principalResolver` reads `Authorization: Bearer <token>` from the framework request; a header
that is present and is not a well-formed bearer credential is refused, never treated as an
anonymous call. `inActorContext` runs the handler inside `ActorContext.run`, so infrastructure
sees the actor (see "The current actor"). A consumer or a scheduled job does the same with
`actorContext.run(systemActor('invoice-reminder'), () => commandBus.execute(...))`.

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

**What changes when you switch.** The adapter given to `authorizationModule`, and the data it
needs. From RBAC to ReBAC: add `resource:` to the `requires` of the use cases that did not name
one (a relationship is always to something), map each permission to a schema permission, and
start writing tuples. Permissions, commands, queries, handlers, policies, routes and tests of
handlers do not change. Models can also be layered: `Access` asks the instance policies and
then the authorizer, so "roles for actions, policies for the few per-element rules" needs no
tuple store at all, and is the place to start.

Every authorizer refuses the anonymous actor (`ANONYMOUS`), and an actor of type `system` has no
right unless the model gives it one.

### Roles

```ts
new RoleBasedAuthorizer({
  roles: { admin: ['*'], controller: ['billing:*'], clerk: [billingPermissions['invoice.read']] },
  inherits: { controller: ['clerk'] },          // a controller has all a clerk has
  tenantOf: tenantOfContext,                    // turns the tenant check on
  crossTenantRoles: ['admin'],                  // may act in every tenant
  systemRole: 'automation',                     // the role of systemActor(...), none by default
});
```

A grant is a permission, its id, `<context>:*` or `*`. A grant that could never match, an
unknown inherited role and a cycle in the hierarchy are refused at construction. With
`tenantOf`, a request that targets another tenant than the actor's is refused; the tenant is
read from the `context` of the requirement: `requires(X, permission, { context: (command) =>
({ tenantId: command.tenantId }) })`.

### Attribute policies

```ts
const sameDepartment: Condition = ({ actor, attributes }) => actor.attributes['department'] === attributes['department'];
const isLarge: Condition = ({ attributes }) => Number(attributes['amount']) > 10_000;

new PolicyBasedAuthorizer({
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

### Relationships

```ts
import { defineSchema, union, intersection, exclusion, from } from '@ddd-ts-kit/auth/rebac';

const schema = defineSchema({
  user: {},
  group: { relations: { member: ['user', 'group#member'] } },
  folder: {
    relations: { owner: ['user'], viewer: ['user', 'group#member'], parent: ['folder'] },
    permissions: {
      edit: union('owner', from('parent', 'edit')),
      view: union('edit', 'viewer', from('parent', 'view')),
    },
  },
  document: {
    relations: { owner: ['user'], editor: ['user', 'group#member'], banned: ['user'], parent: ['folder'] },
    permissions: {
      edit: exclusion(union('owner', 'editor', from('parent', 'edit')), 'banned'),
      view: union('edit', from('parent', 'view')),
    },
  },
});

const authorizer = new RelationBasedAuthorizer({
  schema,
  store: tupleStore,
  mapping: {
    document: { [docsPermissions['document.edit'].id]: 'edit', [docsPermissions['document.view'].id]: 'view' },
    folder: { [docsPermissions['folder.view'].id]: 'view' },
  },
});
```

| Zanzibar concept | Here |
|---|---|
| relation tuple `object#relation@subject` | `{ object: 'document:1', relation: 'editor', subject: 'user:ada' }` |
| userset as a subject | `subject: 'group:eng#member'`, declared as `'group#member'` in the relation |
| computed userset | a name in a rewrite: `union('owner', 'editor')`, `view: union('edit', ...)` |
| tuple to userset | `from('parent', 'edit')`: whoever may edit the parent |
| union, intersection, exclusion | `union(...)`, `intersection(...)`, `exclusion(base, subtract)` |
| Check | `authorizer.check({ actor, permission, resource })` |
| Expand | `authorizer.expand({ actor, permission, resource })` |
| reverse lookup | `authorizer.listAccessible({ actor, permission, resourceType })` |

`defineSchema` validates when the schema is defined: an unknown type, a userset of a relation
that does not exist, a rewrite naming something undeclared, a `from` over something that is not
a relation to objects or towards a type lacking the permission, one name used for a relation
and a permission, an empty union or intersection, and a rewrite that reads no tuple and could
never terminate (`edit: 'view'`, `view: 'edit'`). A loop that goes through tuples (folders in
folders, groups in groups) is legitimate: it is cut at run time by cycle protection and by
`maxDepth` (default 16). When the depth limit cuts an evaluation the answer is `DEPTH_EXCEEDED`,
never a guess.

An actor is the subject `<type>:<id>` (`user:ada`, `service:billing-worker`); `subjectOf`
changes that. `SchemaCheckedTupleStore` wraps a store and refuses, on write, a tuple the schema
does not describe.

`expand` answers "why is this allowed" for debugging: the whole evaluation tree, every branch
visited, each node saying which object and relation were evaluated, how (`relation`, `direct`,
`userset`, `computed`, `union`, `intersection`, `exclusion`, `from`, `cycle`, `depth-limit`),
with which tuple and with what answer.

**The cost of listing, honestly.** `listAccessible` returns `{ kind: 'ids' }` by reverse
expansion: starting from the actor it reads the tuples of every subject it can reach (the
actor, its groups, the objects those lead to, and their usersets), which costs one store read
per reached subject, then runs one check per object of the requested type it met. That is fine
for an actor reaching up to a few thousand tuples. It is not a search index: beyond `listLimit`
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
- `expand` is the trace of one check for one actor, not the userset tree of Zanzibar's Expand.

**Delegating to a dedicated service.** OpenFGA and SpiceDB implement the full model. They are
adapters of the same `Authorizer` port, written in the platform, with their SDK as a dependency
of the project and not of this package:

```ts
// platform/auth/openfga-authorizer.ts (outline)
export class OpenFgaAuthorizer implements Authorizer {
  constructor(
    private readonly client: OpenFgaClient,
    private readonly mapping: PermissionMapping,
  ) {}

  async check({ actor, permission, resource }: CheckRequest): Promise<Decision> {
    if (isAnonymous(actor)) return deny(DenialReason.anonymous);
    if (resource === undefined) return deny(DenialReason.resourceRequired);
    const relation = this.mapping[resource.type]?.[permission.id];
    if (relation === undefined) return deny(DenialReason.unmappedPermission);
    const { allowed } = await this.client.check({
      user: `${actor.type}:${actor.id}`,
      relation,
      object: `${resource.type}:${resource.id}`,
    });
    return allowed ? ALLOWED : deny(DenialReason.noRelation);
  }

  async listAccessible({ actor, permission, resourceType }: ListRequest): Promise<AccessScope> {
    const relation = this.mapping[resourceType]?.[permission.id];
    if (isAnonymous(actor) || relation === undefined) return { kind: 'none' };
    const { objects } = await this.client.listObjects({ user: `${actor.type}:${actor.id}`, relation, type: resourceType });
    return { kind: 'ids', ids: objects.map((object) => object.slice(resourceType.length + 1)) };
  }
}
```

With SpiceDB the same two methods call `CheckPermission` and `LookupResources`; the tuple
writes of the next section become `WriteRelationships`, through the outbox when the service is
remote, since a remote call cannot share the transaction. Hold the adapter to
`authorizerContract` in an integration test, and carry the consistency token the service
returns in the `context` of the request if you need read-your-writes.

### Keeping relationships in sync

The domain and the handlers never write tuples. The application declares a port in its own
words; the adapter knows the model.

```ts
// application/ports/document-grants.port.ts
export interface DocumentGrants {
  ownerAssigned(documentId: string, ownerId: string): Promise<void>;
  sharedWithGroup(documentId: string, groupId: string): Promise<void>;
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
all. Prefer the handler for that reason. An event handler reacting to a domain event of the
aggregate (`DocumentShared`) can call the same port, but domain events are dispatched after the
commit: the write is then a second step that must be idempotent (writing a tuple twice changes
nothing) and retried, and for a short while the aggregate exists without its relationship.
`test/relationship-sync.spec.ts` is the tested version, with the rollback case; hold your SQL
store to `relationTupleStoreContract`.

## The current actor

**Use cases get it explicitly.** It is data of the command or query (`command.actor`), put
there by the route or the consumer. Handlers and the domain never read an ambient actor: a use
case then says who acts in its signature, a test passes whoever it wants, and a consumer or a
job is not at the mercy of a context nobody set.

**Infrastructure reads `ActorContext`.** Audit columns and tenant scoping apply to every
statement and should not be threaded through every method of every repository. The context is
set once per request or consumed message at the boundary (`inActorContext`, or
`actorContext.run(actor, work)`), and read by adapters only:

```ts
// contexts/billing/infrastructure/persistence/drizzle-invoice.repository.ts
export class DrizzleInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly db: Database,
    private readonly actors: ActorContext,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const [row] = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, this.#tenantId())));
    return row === undefined ? undefined : toInvoice(row);
  }

  async save(invoice: Invoice): Promise<void> {
    const stamp = { updatedBy: this.actors.require().id, updatedAt: this.clock.now() };
    await this.db
      .insert(invoices)
      .values({ ...toRow(invoice), tenantId: this.#tenantId(), createdBy: stamp.updatedBy, ...stamp })
      .onConflictDoUpdate({ target: invoices.id, set: { ...toRow(invoice), ...stamp } });
  }

  #tenantId(): string {
    const { tenantId } = this.actors.require();
    if (tenantId === undefined) throw new Error('Tenant-scoped storage was reached by an actor without tenant');
    return tenantId;
  }
}
```

`kernelModule()` binds `ACTOR_CONTEXT` to `AsyncLocalStorageActorContext`, which follows the
asynchronous call chain so concurrent requests never mix. `require()` throws
`NoCurrentActorError` when a boundary forgot `run`: a wiring mistake, found by the first test.
This is defence in depth, not authorization: the tenant filter of a repository stops a bug from
leaking rows, the permission is still decided in the application layer.

## Filtering lists

A list is filtered by the query, never in memory after loading. The handler asks for a scope
and hands it to the read port:

```ts
// application/queries/list-invoices/list-invoices.handler.ts
async execute(query: ListInvoices): Promise<readonly InvoiceSummary[]> {
  const scope = await this.access.scope(query.actor, billingPermissions['invoice.read'], 'invoice');
  return this.invoices.list(scope, query.page);
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
| `{ kind: 'all' }` | RBAC when the role grants the permission | adds nothing |
| `{ kind: 'none' }` | any model, and always for the anonymous actor | returns an empty page without querying |
| `{ kind: 'filter', filter }` | RBAC with the tenant check: `{ tenantId }` | adds one equality per entry, on columns it chooses to map |
| `{ kind: 'ids', ids }` | ReBAC | adds `id IN (...)`, or joins a temporary table when the list is long |

`Access.scope` throws `ListingNotSupportedError` when the authorizer has no `listAccessible`
(attribute policies): better a loud failure than a list silently filtered by a guess.

## Authentication

```ts
import { JwtAuthenticator } from '@ddd-ts-kit/auth/jwt';

new JwtAuthenticator({
  jwksUri: 'https://id.example.com/realms/shop/protocol/openid-connect/certs', // or key: publicKey
  issuer: 'https://id.example.com/realms/shop',
  audience: 'shop-api',
  algorithms: ['RS256'],        // default: RS256, PS256, ES256, EdDSA
  clockTolerance: 5,            // seconds, default 0
  tenantClaim: 'tenant_id',     // the default
  toActor: (claims) => actor,   // replaces the default mapping
});
```

`authenticate(undefined)` answers the anonymous actor. A token that is expired, not valid yet,
for another audience or issuer, signed with another key, altered, unsigned (`alg: none`), or
using an algorithm outside the allow-list raises `InvalidCredentialError` (code `UNAUTHORIZED`)
with a reason code: `TOKEN_EXPIRED`, `CLAIM_MISMATCH`, `BAD_SIGNATURE`, `ALGORITHM_NOT_ALLOWED`,
`UNKNOWN_KEY`, `MALFORMED_TOKEN`, `UNSUPPORTED_TOKEN`, `NO_SUBJECT`. A key set that cannot be
fetched is not a refusal: the error is left as it is and answered as a 5xx.

The default mapping for OIDC: `id` from `sub` (required), `type: 'user'`, `tenantId` from the
tenant claim when it is a string, no attribute, and `roles` from the first claim present among
`realm_access.roles` (realm roles), `roles` (a list or space-separated words) and `scope`. They
are never merged: a scope a client asked for must not pass for a role. The actor keeps nothing
of the token. Map service accounts to `type: 'service'` with `toActor`.

## Testing

```ts
import { anActor, AllowAll, RecordingAuthorizer, authorizerContract } from '@ddd-ts-kit/auth/testing';

const accountant = anActor().named('ada').ofTenant('acme').withRole('accountant').build();
```

- **Handlers.** `createTestApplication({ modules: [billingModule] })` allows every use case: a
  handler spec is not about rights. `actor` sets who infrastructure sees through
  `ACTOR_CONTEXT` (default: the user `test-user`); `app.actorContext.actAs(actor)` changes it.
  The actor of a use case is the one the test puts in the command.
- **Rights of a context.** List `authorizationModule({ authorizer })` with the real model, or
  with a `RecordingAuthorizer` to assert what was asked as data (`authorizer.checks`); replace
  the authorizer of a composed application with `fake(AUTHORIZER, new AllowAll())`. Add
  `authorization: 'required'` so that a use case without declaration fails the spec at wiring.
- **Policies.** Plain objects: call `policy.allows(actor, subject, { now })`.
- **Boundaries.** `FakeAuthenticator({ 'token-of-ada': ada })` behind `principalResolver`.
- **Your own adapters.** Hold an `Authorizer` (an OpenFGA adapter, a custom model) to
  `authorizerContract(runner, { name, create })` and a tuple store to
  `relationTupleStoreContract(runner, { name, create })`, with `{ describe, it, expect,
  beforeEach }` of your runner.

`anActor()` is a class on the `Builder` of `@ddd-ts-kit/testing`, so it nests in other builders
(`anInvoice().issuedBy(anActor().named('ada'))`) and is immutable like them. `AllowAll` and
`DenyAll` are stubs for specs that are not about rights; they are not held to the authorizer
contract, which they contradict by design.

## The shortcuts this design removes

| Shortcut | Why it is not needed any more | Caught by |
|---|---|---|
| a role test in a controller or a route (`if (!user.roles.includes('admin'))`) | the route only builds the command; the bus middleware decides | `authz/in-application` |
| `if (user.isAdmin)` or an ownership test in an aggregate or a domain service | rights are permissions and policies in `application/authorization/`; the domain holds invariants | `authz/in-application`, `layer/domain-purity` |
| a use case reachable because nobody thought about it | `.requires(...)` or `.public()`, or the application is not created (`authorization: 'required'`) and the message is refused (`UndeclaredUseCaseError`) | `authz/declared` |
| a handler reading "the current user" from a global or a request scope | the actor is the first argument of `AuthorizedCommand` and `AuthorizedQuery`; `requires` does not compile without it | `authz/actor-explicit` |
| a repository or an adapter deciding who may see a row by role | infrastructure only applies the scope it is handed and the tenant of `ActorContext` | `authz/in-application` |
| `invoices.filter((invoice) => canRead(user, invoice))` after loading | `Access.scope` gives an `AccessScope` the read port turns into a `WHERE` clause | `authz/in-application` |
| the raw token passed down to a handler or stored on the user object | `Authenticator` answers an `Actor`, plain data without the credential | `authz/actor-explicit` |
| `if` chains over ownership and status inside a handler | a named policy with a spec of its own, asked through `Access.authorize` | `authz/in-application` |
| `new Date()` in a rule about time | policies and conditions receive `now` from the `Clock` port | `purity/no-system-clock` |
| a string of the model (`'admin'`, `'editor'`) scattered in the code | roles and relations appear only in the composition root and in adapters; the code names permissions | `authz/in-application` |
| a refusal answered with a message quoting the element | `Decision.reason` is a stable machine code, checked by the contract suite | the contract suite |
| a one-off bypass "for the demo" | a deviation is recorded as a decision or it is a defect | `governance/recorded-deviation` |
