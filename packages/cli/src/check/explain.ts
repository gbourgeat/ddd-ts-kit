import type { RuleDoc } from './types.js';

/** Shown by `ddd-ts-kit explain <rule-id>`: the reason behind the rule and one example each way. */
export const RULE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'layer/domain-purity': {
    why: 'The domain is the part of the system that has to survive a change of framework, database or transport. Every outside import ties a business rule to a technical choice and makes it impossible to test without that choice. Values that come from the outside world (ids, time, randomness) enter as parameters.',
    bad: `// domain/aggregates/invoice.aggregate.ts
import { randomUUID } from 'node:crypto';
import { IsEmail } from 'class-validator';`,
    good: `// domain/aggregates/invoice.aggregate.ts
import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { Money } from '../value-objects/money.vo.js';`,
  },
  'layer/application-inward': {
    why: 'A use case orchestrates the domain and talks to the outside through ports. If it imports an adapter, a framework or a driver, the technical choice can no longer be replaced or faked, and the handler cannot be unit tested with plain fakes.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
import { PgInvoiceRepository } from '../../../infrastructure/persistence/pg-invoice.repository.js';`,
    good: `// application/commands/issue-invoice/issue-invoice.handler.ts
import type { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';`,
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
    why: 'A fixed tree means every concept has one obvious place, so people and tools find it without reading the code. An ad hoc folder (utils, helpers, common) is where unnamed concepts go to hide; a real new need is declared in extraDirectories with its reason.',
    bad: `contexts/billing/domain/utils/rounding.ts`,
    good: `contexts/billing/domain/value-objects/money.vo.ts`,
  },
  'tree/context-doc': {
    why: 'CONTEXT.md is where the vocabulary and the boundaries are agreed with the domain experts. Without it, names drift and nobody can tell whether a concept belongs here. The classification says how much design effort the context deserves.',
    bad: `contexts/billing/ without CONTEXT.md, or with "## Classification" saying generic while the config says core`,
    good: `## Purpose, ## Classification, ## Ubiquitous language, ## Aggregates, ## Published events, ## Relationships`,
  },
  'naming/suffix': {
    why: 'The suffix states the role of a file before it is opened and lets the other rules know what they are looking at. Kebab-case avoids case-only renames that break on some file systems.',
    bad: `domain/aggregates/Invoice.ts`,
    good: `domain/aggregates/invoice.aggregate.ts`,
  },
  'naming/one-concept-per-file': {
    why: 'One concept per file keeps the file name truthful and the diff of a change small. A second class in an aggregate file is usually an entity or a value object that deserves its own name and its own tests.',
    bad: `// invoice.aggregate.ts
export class Invoice {}
export class InvoiceLine {}`,
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
    why: 'When adapters are created in one place, replacing one (a fake in a test, another provider in production) is a one-line change and tracing can wrap them all. A `new PgRepository()` buried in a handler hides a dependency and defeats both.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
const repository = new PgInvoiceRepository();`,
    good: `// billing.module.ts
const invoiceRepository = new PgInvoiceRepository();
const issueInvoiceHandler = new IssueInvoiceHandler(invoiceRepository);`,
  },
  'config/valid': {
    why: 'Every other rule reads the config: a misspelled upstream or rule id silently disables a check. The contexts on disk and in the config have to be the same set, or part of the code is not checked at all.',
    bad: `"rules": { "naming/sufix": "warn" }, "guard": "strict"`,
    good: `"rules": { "naming/suffix": "warn" }, "guard": "advise"   // enforce (default), advise or off: how the editor hook reacts`,
  },
  'config/suppression-needs-reason': {
    why: 'An exception to an architecture rule is a decision someone will question later. The reason written next to it is what makes it reviewable; a bare suppression is indistinguishable from a shortcut.',
    bad: `// ddd-ts-kit-disable-next-line layer/domain-purity`,
    good: `// ddd-ts-kit-disable-next-line layer/domain-purity -- decimal.js is our money arithmetic, approved in ADR 12`,
  },
};
