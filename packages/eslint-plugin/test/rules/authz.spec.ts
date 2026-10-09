import { authzActorExplicit } from '../../src/rules/authz-actor-explicit.js';
import { authzDeclared } from '../../src/rules/authz-declared.js';
import { authzInApplication } from '../../src/rules/authz-in-application.js';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester.js';

const MODULE = `${BILLING}/billing.module.ts`;
const ROUTE = `${BILLING}/presentation/http/void-invoice.route.ts`;
const COMMAND = `${BILLING}/application/commands/void-invoice/void-invoice.command.ts`;
const HANDLER = `${BILLING}/application/commands/void-invoice/void-invoice.handler.ts`;
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`;
const SPEC = `${BILLING}/test/unit/void-invoice.handler.spec.ts`;

const route = (spec: string): string => `export const r = defineRoute({ method: 'POST', path: '/invoices', operationId: 'issueInvoice', ${spec} }, handler);`;

ruleTester.run('authz-declared', authzDeclared, {
  valid: [
    at(MODULE, "builder.command(IssueInvoice).requires(billingPermissions['invoice.issue']).handledBy(IssueInvoiceHandler, [INVOICES]);"),
    at(MODULE, 'builder.query(GetCatalog).public().handledBy(GetCatalogHandler, [CATALOG]);'),
    at(MODULE, 'builder.query(GetCatalog).public().handledByFactory((resolve) => new GetCatalogHandler(resolve(CATALOG)));'),
    at(MODULE, "builder.on(invoiceIssuedV1, { consumer: 'billing.remind' }).handledBy(RemindConsumer, [COMMAND_BUS]);"),
    at(HANDLER, 'builder.command(IssueInvoice).handledBy(IssueInvoiceHandler);'),
    at(SPEC, 'builder.command(IssueInvoice).handledBy(IssueInvoiceHandler);'),
    at(ROUTE, route("security: ['bearer']")),
    at(ROUTE, route('security: false')),
    at(ROUTE, route('security')),
    at(ROUTE, route('...defaults')),
    at(ROUTE, 'export const r = defineRoute(spec, handler);'),
    at(COMMAND, 'export class VoidInvoice extends AuthorizedCommand { constructor(actor: Actor, readonly invoiceId: string) { super(actor); } }'),
    at(COMMAND, 'export class VoidInvoice extends AuthorizedCommand { constructor(input: VoidInvoiceInput) { super(input.actor); } }'),
    at(COMMAND, 'export class VoidInvoice extends AuthorizedCommand { constructor(readonly who: Actor = anonymousActor()) { super(who); } }'),
    at(COMMAND, 'export class ListMine extends AuthorizedQuery<Invoice[]> {}'),
    at(COMMAND, 'export class GetCatalog extends Query<Catalog> { constructor() { super(); } }'),
    at(MODULE, "// ddd-ts-kit-disable-next-line authz/declared -- ADR-0007: the health probe is registered before permissions exist\nbuilder.query(Health).handledBy(HealthHandler);"),
    at(MODULE, 'builder.command(IssueInvoice).handledBy(IssueInvoiceHandler);', { ...SAMPLE_CONFIG, rules: { 'authz/declared': 'off' } }),
  ],
  invalid: [
    { ...at(MODULE, 'builder.command(IssueInvoice).handledBy(IssueInvoiceHandler, [INVOICES]);'), errors: [{ messageId: 'useCase', data: { kind: 'command', name: 'IssueInvoice', binding: 'handledBy' } }] },
    { ...at(MODULE, 'builder\n  .query(ListInvoices)\n  .handledByFactory((resolve) => new ListInvoicesHandler(resolve(INVOICES)));'), errors: [{ messageId: 'useCase', data: { kind: 'query', name: 'ListInvoices', binding: 'handledByFactory' } }] },
    { ...at(MODULE, 'register.command(A).handledBy(AHandler);\nregister.command(B).public().handledBy(BHandler);'), errors: [{ messageId: 'useCase', line: 1 }] },
    { ...at(ROUTE, route("summary: 'Issue'")), errors: [{ messageId: 'route', data: { route: '"issueInvoice"' } }] },
    { ...at(ROUTE, route('security: []')), errors: [{ messageId: 'emptySecurity', data: { route: '"issueInvoice"' } }] },
    { ...at(ROUTE, route('security: undefined')), errors: [{ messageId: 'route' }] },
    { ...at('src/platform/http/health.route.ts', "export const health = http.defineRoute({ method: 'GET', path: '/health' }, handler);"), errors: [{ messageId: 'route', data: { route: '"/health"' } }] },
    { ...at(COMMAND, 'export class VoidInvoice extends AuthorizedCommand { constructor(readonly invoiceId: string) { super(systemActor("billing")); } }'), errors: [{ messageId: 'actor', data: { className: 'VoidInvoice', base: 'AuthorizedCommand' } }] },
    { ...at(COMMAND, 'export class ListMine extends kernel.AuthorizedQuery<Invoice[]> { constructor() { super(); } }'), errors: [{ messageId: 'actor', data: { className: 'ListMine', base: 'AuthorizedQuery' } }] },
    { ...at(COMMAND, 'export class VoidInvoice extends AuthorizedCommand { constructor(actor: Actor) { super(anonymousActor()); } }'), errors: [{ messageId: 'actor' }] },
  ],
});

ruleTester.run('authz-in-application', authzInApplication, {
  valid: [
    at(ROUTE, "import { actorOf, inActorContext, ForbiddenError, FORBIDDEN, type HeaderValues } from '@ddd-ts-kit/auth';"),
    at(ROUTE, 'await commandBus.execute(new VoidInvoice(actorOf(context.principal), params.invoiceId));'),
    at(ROUTE, 'const command = new InviteMember(actor, body.email, body.role);'),
    at(ROUTE, "if (body.kind === 'draft') skip();"),
    at(HANDLER, "import { Access } from '@ddd-ts-kit/auth';\nif (command.actor.roles.includes('admin')) allow();\nawait this.access.authorize(command.actor, permission, invoice);"),
    at(ADAPTER, 'const row = await this.database.check(id);\nawait this.client.authorize(token);'),
    at(`${BILLING}/infrastructure/external/remote-authorizer.ts`, 'export class CachedAuthorizer implements Authorizer { async check(request: CheckRequest) { return this.inner.authorizer.check(request); } }'),
    at(ADAPTER, 'const tenant = this.actorContext.require().tenantId;'),
    at(AGGREGATE, "import { AggregateRoot, DomainError } from '@ddd-ts-kit/kernel';"),
    at(`${BILLING}/domain/aggregates/member.aggregate.ts`, 'class Member { grant(role: string): void { this.state = { ...this.state, roles: [...this.state.roles, role] }; } }'),
    at(SPEC, "import { AllowAll } from '@ddd-ts-kit/auth/testing';\nexpect(actor.roles).toEqual([]);"),
    at('src/platform/auth/guard.ts', "import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';\nif (actor.roles.length === 0) deny();"),
    at(ROUTE, "import { resolveSession, sessionOf, type SessionAuthenticator } from '@ddd-ts-kit/auth';\nimport type { Session } from '@ddd-ts-kit/kernel';"),
    at(HANDLER, "import type { ExecutionContext, Session } from '@ddd-ts-kit/kernel';"),
    at(AGGREGATE, "import type { Session } from '../value-objects/session.vo.js';"),
  ],
  invalid: [
    { ...at(ROUTE, "if (principal.roles.includes('admin')) allow();"), errors: [{ messageId: 'rights', data: { access: 'principal.roles' } }] },
    { ...at(ROUTE, 'const allowed = context.principal.isAdmin || user["permissions"].length > 0;'), errors: [{ messageId: 'rights' }, { messageId: 'rights' }] },
    { ...at(ROUTE, "if (user.role === 'admin') allow();"), errors: [{ messageId: 'roleTest', data: { access: 'user.role' } }] },
    { ...at(ROUTE, "if ('accountant' != session.user.role) refuse();"), errors: [{ messageId: 'roleTest' }] },
    { ...at(ROUTE, "switch (user.role) { case 'admin': allow(); break; default: refuse(); }"), errors: [{ messageId: 'roleTest' }] },
    { ...at(ROUTE, "import { Access, actorOf, type Authorizer } from '@ddd-ts-kit/auth';"), errors: [{ messageId: 'authorizerImport', data: { name: 'Access' } }, { messageId: 'authorizerImport', data: { name: 'Authorizer' } }] },
    { ...at(ROUTE, "import { RoleBasedAuthorizer as Rbac } from '@ddd-ts-kit/auth';"), errors: [{ messageId: 'authorizerImport', data: { name: 'RoleBasedAuthorizer' } }] },
    { ...at(ROUTE, "import * as auth from '@ddd-ts-kit/auth';"), errors: [{ messageId: 'authorizerImport', data: { name: 'the whole module' } }] },
    { ...at(ROUTE, "import { RelationBasedAuthorizer } from '@ddd-ts-kit/auth/rebac';"), errors: [{ messageId: 'authorizerImport' }] },
    { ...at(ADAPTER, 'await this.access.authorize(actor, permission, row);'), errors: [{ messageId: 'decision', data: { call: 'this.access.authorize' } }] },
    { ...at(ADAPTER, 'const decision = await authorizer.check(request);'), errors: [{ messageId: 'decision' }] },
    { ...at(ADAPTER, 'class Repo { constructor(private readonly gate: Access) {} async find() { await this.gate.decide(a, p, s); } }'), errors: [{ messageId: 'decision', data: { call: 'this.gate.decide' } }] },
    { ...at(ADAPTER, 'class Repo { readonly #gate: RoleBasedAuthorizer = make(); async find() { await this.#gate.check(r); } }'), errors: [{ messageId: 'decision' }] },
    { ...at(ADAPTER, 'async function find(gate: Authorizer) { await gate.check(request); }'), errors: [{ messageId: 'decision' }] },
    { ...at(ADAPTER, "if (row.ownerId !== actorId) throw new ForbiddenError('billing:invoice.read', 'not-owner');"), errors: [{ messageId: 'refusal' }] },
    { ...at(AGGREGATE, "import type { Permission } from '@ddd-ts-kit/auth';"), errors: [{ messageId: 'authInDomain' }] },
    { ...at(AGGREGATE, "import { AggregateRoot, type Actor, type Actored } from '@ddd-ts-kit/kernel';"), errors: [{ messageId: 'actorInDomain', data: { name: 'Actor' } }, { messageId: 'actorInDomain', data: { name: 'Actored' } }] },
    { ...at(AGGREGATE, "import type { ExecutionContext, Session } from '@ddd-ts-kit/kernel';"), errors: [{ messageId: 'actorInDomain', data: { name: 'ExecutionContext' } }, { messageId: 'actorInDomain', data: { name: 'Session' } }] },
    { ...at(AGGREGATE, "class Invoice { void(by: User): void { if (!by.roles.includes('controller')) throw new NotAllowed(); } }"), errors: [{ messageId: 'rightsInDomain', data: { access: 'by.roles' } }] },
    { ...at(AGGREGATE, 'const may = member.permissions.has(id);'), errors: [{ messageId: 'rightsInDomain' }] },
  ],
});

ruleTester.run('authz-actor-explicit', authzActorExplicit, {
  valid: [
    at(HANDLER, "import type { Actor } from '@ddd-ts-kit/kernel';\nclass VoidInvoiceHandler { constructor(private readonly invoices: InvoiceRepository, private readonly access: Access) {} async execute(command: VoidInvoice) { return command.actor.id; } }"),
    at(ADAPTER, "import type { ActorContext } from '@ddd-ts-kit/kernel';\nclass Repo { constructor(private readonly actors: ActorContext) {} }"),
    at(ADAPTER, "import { stampCreation, tenantScopeOf, type ExecutionScope } from '@ddd-ts-kit/kernel';\nclass Repo { constructor(private readonly scope: ExecutionScope) {} row() { return { ...stampCreation(this.scope, clock), ...tenantScopeOf(this.scope), id: this.scope.require().correlationId }; } }"),
    at(ROUTE, "import { ACTOR_CONTEXT, EXECUTION_SCOPE } from '@ddd-ts-kit/di';"),
    at(MODULE, "import { ACTOR_CONTEXT, EXECUTION_SCOPE } from '@ddd-ts-kit/di';\nbuilder.bind(REPO).toClass(Repo, [ACTOR_CONTEXT, EXECUTION_SCOPE]);"),
    at('src/platform/http/scope.ts', "import { AsyncLocalStorageExecutionScope } from '@ddd-ts-kit/kernel';\nconst context = scope.current();"),
    at(SPEC, "import { FixedActorContext, FixedExecutionScope, type ActorContext, type ExecutionScope } from '@ddd-ts-kit/kernel';\nconst context = scope.require();"),
    at(HANDLER, 'const context = options.actorContext;'),
    at(HANDLER, 'class H { async execute(query: ListInvoices) { const scope = await this.access.scopeOf(query.actor, permission); return this.invoices.within(scope); } }'),
    at(HANDLER, 'function within(scope: AccessScope) { return scope.current(); }'),
    at(HANDLER, 'class H { constructor(private readonly scope: ProjectScope) {} execute() { return this.scope.require(); } }'),
    at(HANDLER, 'const module = loader.require();\nconst page = cursor.current();\nconst value = scope.current(position);'),
    at(AGGREGATE, 'class Invoice { stampUpdate(at: Date): void { this.touch(at); } revise(at: Date): void { this.stampUpdate(at); } }'),
  ],
  invalid: [
    { ...at(HANDLER, "import type { ActorContext } from '@ddd-ts-kit/kernel';"), errors: [{ messageId: 'imported', data: { name: 'ActorContext', layer: 'application' } }] },
    { ...at(HANDLER, "import { ACTOR_CONTEXT as CURRENT } from '@ddd-ts-kit/di';"), errors: [{ messageId: 'imported', data: { name: 'ACTOR_CONTEXT', layer: 'application' } }] },
    { ...at(AGGREGATE, "import { AsyncLocalStorage } from 'node:async_hooks';"), errors: [{ messageId: 'imported', data: { name: 'AsyncLocalStorage', layer: 'domain' } }] },
    { ...at(HANDLER, "export { AsyncLocalStorageActorContext } from '@ddd-ts-kit/kernel';"), errors: [{ messageId: 'imported' }] },
    { ...at(HANDLER, 'const storage = new hooks.AsyncLocalStorage<Actor>();'), errors: [{ messageId: 'used', data: { name: 'AsyncLocalStorage', layer: 'application' } }] },
    { ...at(HANDLER, 'class H { constructor(private readonly actors: kernel.ActorContext) {} }'), errors: [{ messageId: 'injected' }, { messageId: 'used' }] },
    { ...at(HANDLER, 'class VoidInvoiceHandler { constructor(private readonly invoices: InvoiceRepository, private readonly actors: ActorContext) {} }'), errors: [{ messageId: 'injected', data: { className: 'VoidInvoiceHandler', port: 'ActorContext' } }] },
    { ...at(`${BILLING}/domain/services/numbering.service.ts`, 'class Numbering { constructor(actors: ActorContext) {} }'), errors: [{ messageId: 'injected' }] },
    { ...at(HANDLER, "import type { ExecutionScope } from '@ddd-ts-kit/kernel';"), errors: [{ messageId: 'imported', data: { name: 'ExecutionScope', layer: 'application' } }] },
    { ...at(HANDLER, "import { EXECUTION_SCOPE } from '@ddd-ts-kit/di';\nimport { AsyncLocalStorageExecutionScope, ScopedActorContext } from '@ddd-ts-kit/kernel';"), errors: [{ messageId: 'imported' }, { messageId: 'imported' }, { messageId: 'imported' }] },
    { ...at(AGGREGATE, 'function tenant(scope: kernel.ExecutionScope) { return scope; }'), errors: [{ messageId: 'used', data: { name: 'ExecutionScope', layer: 'domain' } }] },
    { ...at(HANDLER, 'class H { constructor(private readonly scope: ExecutionScope) {} execute() { return this.scope.require().tenantId; } }'), errors: [{ messageId: 'injected', data: { className: 'H', port: 'ExecutionScope' } }, { messageId: 'read', data: { read: 'this.scope.require', layer: 'application' } }] },
    { ...at(HANDLER, 'class H { execute() { return this.dependencies.scope.current()?.correlationId; } }'), errors: [{ messageId: 'read', data: { read: 'this.dependencies.scope.current', layer: 'application' } }] },
    { ...at(HANDLER, 'const actor = this.#actors.require();\nconst context = executionScope.current();\nconst other = this.actorContext.current();'), errors: [{ messageId: 'read' }, { messageId: 'read' }, { messageId: 'read' }] },
    { ...at(AGGREGATE, 'function who(ambient: ActorContext) { return ambient.current(); }'), errors: [{ messageId: 'read', data: { read: 'ambient.current', layer: 'domain' } }] },
    { ...at(HANDLER, "import { stampCreation, stampUpdate as touch, tenantScopeOf } from '@ddd-ts-kit/kernel';"), errors: [{ messageId: 'helper', data: { name: 'stampCreation', layer: 'application' } }, { messageId: 'helper', data: { name: 'stampUpdate', layer: 'application' } }, { messageId: 'helper', data: { name: 'tenantScopeOf', layer: 'application' } }] },
    { ...at(AGGREGATE, "import * as kernel from '@ddd-ts-kit/kernel';\nconst stamp = kernel.stampCreation(context, clock);"), errors: [{ messageId: 'helper', data: { name: 'stampCreation', layer: 'domain' } }] },
  ],
});
