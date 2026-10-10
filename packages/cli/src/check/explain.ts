import type { RuleDoc } from './types.js';

/** Shown by `ddd-ts-kit explain <rule-id>`: the reason behind the rule and one example each way. */
export const RULE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'layer/domain-purity': {
    why: 'The domain is the part of the system that has to survive a change of framework, database or transport. Every outside import ties a business rule to a technical choice and makes it impossible to test without that choice. Values that come from the outside world (ids, time, randomness) enter as parameters. The packages that apply a concern from outside (@ddd-ts-kit/aspects, audit, redis, tracing) are refused whatever `domainAllowedPackages` says. The kernel itself is allowed, its entry @ddd-ts-kit/kernel/declarations is not: a declaration is wiring, and the domain declares nothing, neither a decorator on a class nor a token.',
    bad: `// domain/aggregates/invoice.aggregate.ts
import { randomUUID } from 'node:crypto';
import { IsEmail } from 'class-validator';
import { Logged } from '@ddd-ts-kit/aspects/decorators';
import { Repository, token } from '@ddd-ts-kit/kernel/declarations';`,
    good: `// domain/aggregates/invoice.aggregate.ts
import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { Money } from '../value-objects/money.vo.js';`,
  },
  'layer/application-inward': {
    why: 'A use case orchestrates the domain and talks to the outside through ports. If it imports an adapter, a framework or a driver, the technical choice can no longer be replaced or faked, and the handler cannot be unit tested with plain fakes. Cross-cutting behaviour reaches a use case from outside: @ddd-ts-kit/aspects, audit, redis and tracing are refused whatever `applicationAllowedPackages` says, their place is the composition root, a bus middleware or an adapter. The declarations of the kernel (@ddd-ts-kit/kernel/declarations) are part of the kernel and belong here: a handler or a policy says what it is and names its dependencies by token, without knowing a container.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
import { PgInvoiceRepository } from '../../../infrastructure/persistence/pg-invoice.repository.js';
import { RedisCache } from '@ddd-ts-kit/redis';
import { retry } from '@ddd-ts-kit/aspects';`,
    good: `// application/commands/issue-invoice/issue-invoice.handler.ts
import type { Cache } from '@ddd-ts-kit/kernel';
import type { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';
import { CLOCK, CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { INVOICE_REPOSITORY } from '../../ports/billing.ports.js';`,
  },
  'layer/presentation-no-infrastructure': {
    why: 'A route translates a transport request into a command or a query and maps the answer back. Reaching an adapter directly skips the use case, so the business rule that guards the operation is skipped too.',
    bad: `// presentation/http/issue-invoice.route.ts
import { PgInvoiceRepository } from '../../infrastructure/persistence/pg-invoice.repository.js';`,
    good: `// presentation/http/issue-invoice.route.ts
import type { IssueInvoiceHandler } from '../../application/commands/issue-invoice/issue-invoice.handler.js';`,
  },
  'layer/infrastructure-no-presentation': {
    why: 'Adapters implement ports declared inward. An adapter that knows a DTO or a route depends on one transport, and both outer layers start changing together.',
    bad: `// infrastructure/persistence/pg-invoice.repository.ts
import type { InvoiceDto } from '../../presentation/http/invoice.dto.js';`,
    good: `// infrastructure/persistence/pg-invoice.repository.ts
import type { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';`,
  },
  'context/published-language-only': {
    why: 'A bounded context owns its model and must be free to change it. The published language is the only part designed for others; importing anything else couples two models and turns every refactoring into a cross-team negotiation.',
    bad: `// contexts/shipping/application/...
import { Invoice } from '../../../billing/domain/aggregates/invoice.aggregate.js';`,
    good: `// contexts/shipping/application/...
import type { InvoiceIssuedV1 } from '../../../billing/published-language/index.js';`,
  },
  'context/declared-relationship': {
    why: 'The context map is a strategic decision, not a side effect of an import. Declaring the upstream and the pattern keeps the map reviewable and lets the cycle check work.',
    bad: `// shipping imports billing/published-language, config has "shipping": { "upstreams": [] }`,
    good: `"shipping": { "classification": "supporting",
  "upstreams": [{ "context": "billing", "relationship": "published-language" }] }`,
  },
  'context/published-language-is-a-contract': {
    why: 'A contract that re-exports a domain class is no contract: consumers get the internal model and its behaviour through the back door. The published language holds serializable types that are versioned on purpose.',
    bad: `// published-language/index.ts
export { Invoice } from '../domain/aggregates/invoice.aggregate.js';`,
    good: `// published-language/invoice-issued.v1.integration-event.ts
export interface InvoiceIssuedV1Payload { readonly invoiceId: string }`,
  },
  'context/no-cycle': {
    why: 'Two contexts that are upstream of each other are one context with a line drawn through it: neither can be changed, deployed or understood alone. One of them has to be the supplier.',
    bad: `"billing": { "upstreams": [{ "context": "shipping" }] },
"shipping": { "upstreams": [{ "context": "billing" }] }`,
    good: `"billing": { "upstreams": [] },
"shipping": { "upstreams": [{ "context": "billing" }] }`,
  },
  'tree/closed': {
    why: 'A fixed tree means every concept has one obvious place, so people and tools find it without reading the code. An ad hoc folder (utils, helpers, common) is where unnamed concepts go to hide; a real new need is declared in extraDirectories with its reason. In the declared style the generated barrel <context>.declarations.ts lives at the root of the context, next to CONTEXT.md; a module file may stay there when the wiring of a context is unusual.',
    bad: `contexts/billing/domain/utils/rounding.ts`,
    good: `contexts/billing/domain/value-objects/money.vo.ts
contexts/billing/billing.declarations.ts   // declared style only`,
  },
  'tree/context-doc': {
    why: 'CONTEXT.md is where the vocabulary and the boundaries are agreed with the domain experts. Without it, names drift and nobody can tell whether a concept belongs here. The classification says how much design effort the context deserves.',
    bad: `contexts/billing/ without CONTEXT.md, or with "## Classification" saying generic while the config says core`,
    good: `## Purpose, ## Classification, ## Ubiquitous language, ## Aggregates, ## Published events, ## Relationships`,
  },
  'naming/suffix': {
    why: 'The suffix states the role of a file before it is opened and lets the other rules know what they are looking at. Kebab-case avoids case-only renames that break on some file systems. In the declared style two files are named after their context instead of a role: application/ports/<context>.ports.ts (its tokens) and presentation/http/<context>.routes.ts (its routes).',
    bad: `domain/aggregates/Invoice.ts`,
    good: `domain/aggregates/invoice.aggregate.ts
application/ports/billing.ports.ts   // declared style only`,
  },
  'naming/one-concept-per-file': {
    why: 'One concept per file keeps the file name truthful and the diff of a change small. A second class in an aggregate file is usually an entity or a value object that deserves its own name and its own tests. In the declared style a role file is found by its name and holds one declared class: a second class carrying a declaration decorator in the same file is reported, whatever the role.',
    bad: `// invoice.aggregate.ts
export class Invoice {}
export class InvoiceLine {}
// application/authorization/invoice.policy.ts, declared style
@Policy(billingPermissions['invoice.void'], { name: 'billing.only-issuer-voids' })
export class OnlyIssuerVoidsPolicy {}
@Policy(billingPermissions['invoice.issue'], { name: 'billing.only-accountant-issues' })
export class OnlyAccountantIssuesPolicy {}`,
    good: `// invoice.aggregate.ts
export class Invoice {}
// ../entities/invoice-line.entity.ts
export class InvoiceLine {}`,
  },
  'test/spec-required': {
    why: 'Aggregates, value objects, domain services and handlers hold the business behaviour; an untested one is an unverified rule. Requiring the spec file makes the missing test visible at the moment the code is written.',
    bad: `domain/aggregates/invoice.aggregate.ts with no test/**/invoice.aggregate.spec.ts`,
    good: `test/unit/invoice.aggregate.spec.ts`,
  },
  'events/name-format': {
    why: 'Event names are routing keys and part of the public contract. A uniform <context>.<aggregate>.<fact> name tells who owns the event and what happened, and never collides across contexts.',
    bad: `readonly name = 'InvoiceIssued';`,
    good: `readonly name = 'billing.invoice.issued';`,
  },
  'events/defined-in-published-language': {
    why: 'Integration events are the only way two contexts communicate, so their shape is a public contract. One declaration with a payload schema gives the type, validates what is published and consumed, and feeds the generated catalog and AsyncAPI document. An event described by hand, or declared twice, drifts from what is really sent.',
    bad: `// application/integration/publishers/invoice-issued.publisher.ts
const event = { type: 'billing.invoice.issued', version: 1, payload };`,
    good: `// published-language/invoice-issued.v1.integration-event.ts
export const invoiceIssuedV1 = defineIntegrationEvent({
  type: 'billing.invoice.issued', version: 1, payload: zodSchema(z.object({ invoiceId: z.string() })),
});`,
  },
  'test/no-mocks': {
    why: 'A mock asserts that a call was made, not that the outcome is right, so it breaks on every refactoring and passes on wrong behaviour. A fake is a working in-memory implementation held to the same contract suite as the real adapter. Tests assert its state, the published events or the returned value.',
    bad: `const repository = { save: vi.fn() };
expect(repository.save).toHaveBeenCalledOnce();`,
    good: `const repository = new FakeInvoiceRepository();
expect(await repository.findById(id)).toBeDefined();`,
  },
  'test/builder-required': {
    why: 'Tests that build aggregates by hand repeat every mandatory field and break together when one is added. A builder has valid defaults and methods in the ubiquitous language, and goes through the public API of the aggregate, so a test states only what matters to the rule it checks and never starts from an invalid state.',
    bad: `domain/aggregates/invoice.aggregate.ts with no test/builders/invoice.builder.ts`,
    good: `// test/builders/invoice.builder.ts
anInvoice().issued().build();`,
  },
  'language/glossary-term': {
    why: 'The ubiquitous language is the contract between the domain experts and the code. A class named with a word nobody defined is either a concept the experts do not know, or a synonym that will split the vocabulary in two. Writing the term and its meaning first forces the conversation that the name needs.',
    bad: `// CONTEXT.md glossary: Invoice, Issue
export class BillDispatcher {}`,
    good: `// CONTEXT.md glossary: Invoice, Issue
export class IssueInvoiceCommand {}`,
  },
  'language/no-technical-name': {
    why: 'Manager, Helper, Data or Impl say how a class is built, not what it means. In the domain such a name marks a concept that was not discussed: the behaviour ends up in a bag that keeps growing. A domain expert never says "invoice manager".',
    bad: `export class InvoiceManager {}`,
    good: `export class InvoiceNumbering {}`,
  },
  'purity/no-system-clock': {
    why: 'Code that reads the clock gives a different answer every time it runs, so its tests are either flaky or need a mocked module. Passing the instant in, from the Clock port, makes every rule about time testable with a fixed date and replayable in production.',
    bad: `isOverdue(): boolean { return this.dueDate < new Date(); }`,
    good: `isOverdue(now: Date): boolean { return this.dueDate < now; }`,
  },
  'purity/no-ambient-randomness': {
    why: 'An identifier drawn inside the domain cannot be predicted by a test nor chosen by the caller (idempotent retries, imports of existing data). The IdGenerator port keeps the choice of the scheme in the composition root and gives tests readable, sequential identifiers.',
    bad: `static create(): Invoice { return new Invoice(crypto.randomUUID()); }`,
    good: `static create(id: string): Invoice { return new Invoice(id); }`,
  },
  'purity/no-environment': {
    why: 'Reading the environment, logging to the console or touching the network from the domain or a handler hides a dependency that no constructor declares. The class then needs the real world, or a mocked module, to be tested. Every such access is a port with an adapter.',
    bad: `if (process.env.FEATURE_X) console.log('issuing', invoice);`,
    good: `constructor(private readonly features: FeatureFlags) {}`,
  },
  'clean/stepdown': {
    why: 'A reader opens a file to learn what it does, then, if needed, how. With the public members first and each helper below its first caller, the file reads once from top to bottom, like a newspaper article. Helpers on top force the reader to hold details before knowing what they serve.',
    bad: `function parseLine(line: string) {}
export function parseFile(text: string) { return text.split('\\n').map(parseLine); }`,
    good: `export function parseFile(text: string) { return text.split('\\n').map(parseLine); }
function parseLine(line: string) {}`,
  },
  'clean/function-size': {
    why: 'A long function mixes several levels of abstraction, and its parts can be neither named nor tested alone. More than three parameters usually travel together because they are one concept without a type. Small functions with few arguments are what makes the stepdown order readable.',
    bad: `function issue(id: string, customer: string, amount: number, currency: string, dueOn: Date) {}`,
    good: `function issue(id: string, customer: CustomerId, total: Money) {}`,
  },
  'clean/no-commented-out-code': {
    why: 'Nobody dares to delete commented-out code: it looks important and is never run, compiled or tested. It rots while the code around it changes, and misleads the next reader. Version control keeps every past version without that cost.',
    bad: `// const total = lines.reduce((sum, line) => sum + line.amount, 0);`,
    good: `(nothing: the old version is in the history)`,
  },
  'clean/no-noise-comment': {
    why: 'A comment that repeats the name, draws a banner or records who changed what adds reading time and no information, and it drifts from the code it sits on. Comments are kept for what the code cannot say: why, a warning, an external reference.',
    bad: `/** Gets the order. */
getOrder(): Order {}
// ---------- helpers ----------`,
    good: `// Rounded half-even: required by the tax authority (art. 242).
round(amount: Money): Money {}`,
  },
  'clean/no-escape-hatch': {
    why: 'any, the non-null assertion and suppressed diagnostics tell the compiler to stop checking, and the error it would have reported comes back at run time, far from its cause. When one is really needed, the written reason is what lets a reviewer judge it.',
    bad: `const total = (order as any).lines!.length; // @ts-ignore`,
    good: `if (order.lines === undefined) throw new OrderWithoutLines(order.id);`,
  },
  'clean/no-flag-argument': {
    why: 'A boolean parameter means the method does two things, and the call site (`close(true)`) does not say which. Two methods named after the two intentions are readable at the call site and can each guard their own invariants.',
    bad: `cancel(refund: boolean): void {}`,
    good: `cancel(): void {}
cancelAndRefund(): void {}`,
  },
  'composition/only-in-module': {
    why: 'When adapters are created in one place, replacing one (a fake in a test, another provider in production) is a one-line change and tracing can wrap them all. A `new PgRepository()` buried in a handler hides a dependency and defeats both. A class carrying @Repository, @Gateway or @Adapter is bound by its declaration, so nothing instantiates it at all. What turns declarations into bindings (contextModule, discoverContext, include on a module builder) is composition too and stays in main.ts, apps/<context>/main.ts, the platform and a module file.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
const repository = new PgInvoiceRepository();
// infrastructure/external/extend-billing.ts
builder.include(billingDeclarations);`,
    good: `// billing.module.ts
const invoiceRepository = new PgInvoiceRepository();
const issueInvoiceHandler = new IssueInvoiceHandler(invoiceRepository);
// declared style: infrastructure/persistence/pg-invoice.repository.ts and src/main.ts
@Repository(INVOICE_REPOSITORY, [DATABASE])
export class PgInvoiceRepository implements InvoiceRepository {}
contextModule('billing', billingDeclarations);`,
  },
  'declarations/role-declared': {
    why: 'In the declared style nothing lists the classes of a context: a class is registered because its file has the name of a role and its decorator says which one. A role file whose class declares nothing, or declares another role, is wired nowhere and nobody is told. The names a declaration writes (a consumer, a policy, a domain event) are identities kept in stores and logs, so they are literals, and the name of a domain event handler is the one its event carries. The domain declares nothing: a decorator there would make the model depend on its own wiring. Checked in declared-style projects only.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
export class IssueInvoiceHandler {}
// application/event-handlers/invoice-issued.event-handler.ts
@DomainEventHandler(InvoiceIssued, { name: EVENT_NAME })
// domain/aggregates/invoice.aggregate.ts
@Repository(INVOICE_REPOSITORY)
export class Invoice {}`,
    good: `// application/commands/issue-invoice/issue-invoice.handler.ts
@CommandHandler(IssueInvoiceCommand, [INVOICE_REPOSITORY, CLOCK])
export class IssueInvoiceHandler {}
// application/event-handlers/invoice-issued.event-handler.ts
@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' })
export class InvoiceIssuedEventHandler {}`,
  },
  'declarations/barrel-current': {
    why: 'With stack.assembly set to barrel, the composition root assembles a context from <context>.declarations.ts and from nothing else. A role file added by hand and missing from the barrel compiles, passes its unit tests and is never registered. The barrel is derived from the tree, one export per role file sorted by path, so it is compared with what the tree says; with stack.assembly set to discovery the role files are found at startup and a barrel left behind is reported instead.',
    bad: `// billing.declarations.ts, while application/authorization/only-issuer-voids.policy.ts exists
export * from './application/commands/issue-invoice/issue-invoice.command.js';
export * from './application/commands/issue-invoice/issue-invoice.handler.js';`,
    good: `// billing.declarations.ts, rewritten by \`ddd-ts-kit generate\` and \`ddd-ts-kit docs\`
export * from './application/authorization/only-issuer-voids.policy.js';
export * from './application/commands/issue-invoice/issue-invoice.command.js';
export * from './application/commands/issue-invoice/issue-invoice.handler.js';`,
  },
  'config/valid': {
    why: 'Every other rule reads the config: a misspelled upstream or rule id silently disables a check. The contexts on disk and in the config have to be the same set, or part of the code is not checked at all.',
    bad: `"rules": { "naming/sufix": "warn" }, "guard": "strict"`,
    good: `"rules": { "naming/suffix": "warn" }, "guard": "advise"   // enforce (default), advise or off: how the editor hook reacts`,
  },
  'config/suppression-needs-reason': {
    why: 'An exception to an architecture rule is a decision someone will question later. The reason written next to it is what makes it reviewable; a bare suppression is indistinguishable from a shortcut.',
    bad: `// ddd-ts-kit-disable-next-line layer/domain-purity`,
    good: `// ddd-ts-kit-disable-next-line layer/domain-purity -- ADR-0012: decimal.js is our money arithmetic`,
  },
  'events/outbox-required': {
    why: 'Publishing an event and committing the state change it describes must succeed or fail together. A handler that talks to a broker or a bus publishes events of transactions that roll back, and loses events when the broker is down. Written to the outbox in the transaction of the command, the event is relayed afterwards, whatever the transport.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
import { connect } from 'amqplib';
// ddd-ts-kit.config.json
"stack": { "orm": "drizzle", "events": "in-memory" }`,
    good: `// application/commands/issue-invoice/issue-invoice.handler.ts
constructor(private readonly publisher: IntegrationEventPublisher) {}
// platform/platform.module.ts
eventPublisher: new OutboxPublisher(persistence.outbox),`,
  },
  'events/consumer-idempotent': {
    why: 'Delivery is at least once: a consumer sees the same event again after a retry, a restart or a replay. The processed-event store recognises a redelivery by the pair consumer name and event id, in the transaction of the handler. A consumer without a name, or sharing the name of another, either handles events twice or skips events it never handled. An integration event handler class that carries @IntegrationEventHandler(definition, { consumer }) is named by its declaration and needs no registration; the name is a string literal, and it is unique across declarations and registrations alike.',
    bad: `// billing.module.ts
subscriber.subscribe('catalog.product.listed', (event) => productListedHandler.handle(event));
// application/integration/handlers/product-listed.integration-handler.ts
@IntegrationEventHandler(productListedV1, { consumer: CONSUMER_NAME }, [COMMAND_BUS])`,
    good: `// billing.module.ts
builder.on(productListedV1, { consumer: 'billing.product-listed' }).handledBy(ProductListedHandler, [COMMAND_BUS]);
// or, wired by hand
consume(productListedV1, { consumer: 'billing.product-listed', processed, unitOfWork }, (event) => productListedHandler.handle(event));
// or declared on the class
@IntegrationEventHandler(productListedV1, { consumer: 'billing.product-listed' }, [COMMAND_BUS])
export class ProductListedHandler {}`,
  },
  'context/extractable': {
    why: 'A bounded context is a deployable unit in waiting. Moving one to its own service must change a composition root and adapters, never domain or application code. A module that wires another context, a repository that reads its tables, a handler that loads its aggregates or a map shared through an export all hold only while both live in one process and one database. In the declared style the wiring is written on the classes: a role file that imports a token of another context (an UPPER_SNAKE_CASE name, or anything of its ports file) ties the composition of the two, so tokens come from the context itself, the kernel, @ddd-ts-kit/auth and the platform.',
    bad: `// contexts/shipping/infrastructure/persistence/drizzle-parcel.repository.ts
import { invoices } from '../../../billing/infrastructure/persistence/invoice.schema.js';
export const cache = new Map<string, Parcel>();
// contexts/shipping/application/commands/ship-parcel/ship-parcel.handler.ts, declared style
import { INVOICE_REPOSITORY } from '../../../../billing/application/ports/billing.ports.js';`,
    good: `// contexts/shipping/application/ports/invoice-status.gateway.port.ts
export interface InvoiceStatusGateway { isPaid(invoiceId: string): Promise<boolean> }
// contexts/shipping/infrastructure/external/in-process-invoice-status.gateway.ts
import type { InvoiceStatus } from '../../../billing/published-language/index.js';
// contexts/shipping/application/commands/ship-parcel/ship-parcel.handler.ts, declared style
import { INVOICE_STATUS_GATEWAY } from '../../ports/shipping.ports.js';`,
  },
  'authz/declared': {
    why: 'A use case nobody thought about is reachable by everybody. Declaring the permission next to the registration, or declaring the use case public, makes the decision visible in review and lets the bus middleware refuse everything else. The same holds for a route: its security is part of the contract, not a default. The route type enforces it already (`defineRoute` does not compile without `security` and refuses an empty list); this rule stays as the net for a definition built loosely, from an untyped object or a cast. On a message class, @Requires(...) or @Public() of @ddd-ts-kit/kernel/declarations is the declaration, in any project; in the declared style there is no registration to read, so a command or query class carrying neither is reported.',
    bad: `builder.command(VoidInvoiceCommand).handledBy(VoidInvoiceHandler, [INVOICE_REPOSITORY]);
defineRoute({ method: 'POST', path: '/invoices/:id/void' }, handler);
// application/commands/void-invoice/void-invoice.command.ts, declared style
export class VoidInvoiceCommand extends AuthorizedCommand<void> {}`,
    good: `builder.command(VoidInvoiceCommand).requires(billingPermissions['invoice.void']).handledBy(VoidInvoiceHandler, [INVOICE_REPOSITORY]);
builder.query(GetCatalogQuery).public().handledBy(GetCatalogHandler, [CATALOG]);
defineRoute({ method: 'POST', path: '/invoices/:id/void', security: ['bearer'] }, handler);
// application/commands/void-invoice/void-invoice.command.ts, declared style
@Requires(billingPermissions['invoice.void'])
export class VoidInvoiceCommand extends AuthorizedCommand<void> {}`,
  },
  'authz/in-application': {
    why: 'A right decided in a route is skipped by every other entry point: a consumer, a job, another route. Decided in an adapter or in an aggregate, it is invisible and tied to one authorization model. In the application layer, behind the Authorizer port, every right is declared once, tested once, and changing from roles to policies or relationships changes an adapter only. A route keeps the request glue of @ddd-ts-kit/auth (actorOf, sessionOf, resolveSession, a SessionAuthenticator); the domain sees neither the Actor, the Session nor the ExecutionContext. The access decorators (Requires, Public, Policy of @ddd-ts-kit/kernel/declarations) and the ACCESS token of @ddd-ts-kit/auth are how the application layer says it: they are imported in application/ and refused in presentation/, infrastructure/ and domain/.',
    bad: `// presentation/http/void-invoice.route.ts
if (!context.principal.roles.includes('admin')) return { status: 403 };
// presentation/http/void-invoice.route.ts
import { Requires } from '@ddd-ts-kit/kernel/declarations';`,
    good: `// presentation/http/void-invoice.route.ts
await commandBus.execute(new VoidInvoiceCommand(actorOf(context.principal), params.invoiceId));
// application/commands/void-invoice/void-invoice.handler.ts
await this.access.authorize(command.actor, billingPermissions['invoice.void'], invoice);
// application/authorization/only-issuer-voids.policy.ts
@Policy(billingPermissions['invoice.void'], { name: 'billing.only-issuer-voids' })
export class OnlyIssuerVoidsPolicy {}`,
  },
  'authz/actor-explicit': {
    why: 'A handler that reads "the current user" from an ambient context depends on something no signature shows: a consumer or a job that forgot to set it fails at run time, and a test has to set a global. With the actor as data of the command, the use case says who acts, and any caller can send it. The ExecutionScope (and ActorContext, a view of it) is read by infrastructure and the platform alone, for audit columns, tenant scoping and correlation: stampCreation, stampUpdate and tenantScopeOf belong in a repository adapter.',
    bad: `// application/commands/void-invoice/void-invoice.handler.ts
const actor = this.actors.require();
const { tenantId } = this.scope.require();
const stamp = stampCreation(this.scope, this.clock);`,
    good: `// application/commands/void-invoice/void-invoice.command.ts
export class VoidInvoiceCommand extends AuthorizedCommand {}
// application/commands/void-invoice/void-invoice.handler.ts
const { actor } = command;
// infrastructure/persistence/drizzle-invoice.repository.ts
const row = { ...toRow(invoice), ...stampCreation(this.scope, this.clock), ...tenantScopeOf(this.scope) };`,
  },
  'aspects/outside-in': {
    why: 'Logging, metrics, retry, timeout, circuit breaking and caching are applied from outside the code they wrap, so the policy of an application is read in one place and changes without touching a class. The decorator form is the exception: it is kept for an adapter whose policy is part of what the adapter is, in infrastructure/ or in the platform. On a route, a module file, a published language or the shared kernel it hides a policy where nobody looks for one.',
    bad: `// presentation/http/issue-invoice.route.ts
import { Retry } from '@ddd-ts-kit/aspects/decorators';`,
    good: `// billing.module.ts
builder.bind(PAYMENT_GATEWAY).toClass(StripePaymentGateway, [CONFIG]).with(retry({ attempts: 3 }), timeout(2000));
// infrastructure/external/stripe-payment.gateway.ts
import { Retry } from '@ddd-ts-kit/aspects/decorators';`,
  },
  'standard/no-parallel-interface': {
    why: 'The kernel defines the shapes every project shares (Actor, Session, ExecutionContext, Logger, Metrics, Cache, Page and PageRequest, AuditStamp, Clock, IdGenerator, UnitOfWork) so that adapters, middlewares and tooling written once fit them all. A home-made ILogger or UserContext next to them forks the shape: every adapter then needs a translation, and the fields of the project never reach the standard logs, spans and audit entries. A project adds its fields by declaration merging of the extension interfaces the kernel leaves open.',
    bad: `// application/ports/logger.port.ts
export interface ILogger { info(message: string): void }
// shared-kernel/user-context.ts
export interface UserContext { userId: string; tenantId: string; plan: string }`,
    good: `import type { Logger, ExecutionContext } from '@ddd-ts-kit/kernel';
// platform/kernel-extensions.ts
declare module '@ddd-ts-kit/kernel' {
  interface ExecutionContextExtensions { plan: string }
}
// infrastructure/external/pino.logger.ts
export class PinoLogger implements Logger {}`,
  },
  'governance/recorded-deviation': {
    why: 'The architecture can be changed deliberately, not case by case. A suppression, a lowered severity or a widened list that points to no decision is indistinguishable from a shortcut, and gets copied. The decision record says why, for what scope and until when, so the exception can be reviewed today and removed later.',
    bad: `// eslint-disable-next-line no-console -- needed for the demo
"rules": { "test/spec-required": "off" }`,
    good: `// eslint-disable-next-line no-console -- ADR-0004: startup banner read by operations
"rules": { "test/spec-required": "off" },
"deviations": [{ "what": "rules.test/spec-required", "adr": "0009", "reason": "Generated adapters are covered by the contract suite." }]
// docs/adr/0004-startup-banner.md, docs/adr/0009-no-spec-for-generated-adapters.md`,
  },
};
