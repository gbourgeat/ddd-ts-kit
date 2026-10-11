import type { RuleDoc } from '../model/rule-doc.js';

export const WIRING_DOCS: Readonly<Record<string, RuleDoc>> = {
  'composition/only-in-module': {
    why: 'When adapters are created in one place, replacing one (a fake in a test, another provider in production) is a one-line change and tracing can wrap them all. A `new PgRepository()` buried in a handler, or a `bind(Port).toClass(PgRepository)` written outside the composition root, hides a dependency and defeats both. A class carrying @Repository, @Gateway or @Adapter is bound by its declaration, so nothing instantiates it at all. What turns declarations into bindings (contextModule, discoverContext, include on a module builder) is composition too and stays in main.ts, apps/<context>/main.ts, the platform and a module file.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
const repository = new PgInvoiceRepository();
// infrastructure/external/extend-billing.ts
builder.include(billingDeclarations);`,
    good: `// billing.module.ts
const invoiceRepository = new PgInvoiceRepository();
const issueInvoiceHandler = new IssueInvoiceHandler(invoiceRepository);
// declared style: infrastructure/persistence/pg-invoice.repository.ts and src/main.ts
@Repository(InvoiceRepository, [Database, ExecutionScope, Clock])
export class PgInvoiceRepository implements InvoiceRepository {}
contextModule('billing', billingDeclarations);`,
  },
  'declarations/role-declared': {
    why: 'In the declared style nothing lists the classes of a context: a class is registered because its file has the name of a role and its decorator says which one. A role file whose class declares nothing, or declares another role, is wired nowhere and nobody is told. The names a declaration writes (a consumer, a policy, a domain event; the name of a job is held by scheduling/job-name) are identities kept in stores and logs, so they are literals, and the name of a domain event handler is the one its event carries. The domain declares nothing: a decorator there would make the model depend on its own wiring. Checked in declared-style projects only.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
export class IssueInvoiceHandler {}
// application/event-handlers/invoice-issued.event-handler.ts
@DomainEventHandler(InvoiceIssued, { name: EVENT_NAME })
// domain/aggregates/invoice.aggregate.ts
@Repository(InvoiceRepository)
export class Invoice {}`,
    good: `// application/commands/issue-invoice/issue-invoice.handler.ts
@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])
export class IssueInvoiceHandler {}
// application/event-handlers/invoice-issued.event-handler.ts
@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' })
export class InvoiceIssuedEventHandler {}`,
  },
  'declarations/barrel-current': {
    why: 'With stack.assembly set to barrel, the composition root assembles a context from <context>.declarations.ts and from nothing else. A role file added by hand and missing from the barrel compiles, passes its unit tests and is never registered. The barrel is derived from the tree, one export per role file sorted by path, so it is compared with what the tree says; with stack.assembly set to discovery the role files are found at startup and a barrel left behind is reported instead.',
    bad: `// billing.declarations.ts, while application/authorization/only-issuer-voids.policy.ts exists
export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler';`,
    good: `// billing.declarations.ts, rewritten by \`ddd-ts-kit generate\` and \`ddd-ts-kit docs\`
export * from '@/contexts/billing/application/authorization/only-issuer-voids.policy';
export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler';`,
  },
  'config/valid': {
    why: 'Every other rule reads the config: a misspelled upstream or rule id silently disables a check. The contexts on disk and in the config have to be the same set, or part of the code is not checked at all. A function limit above the ceiling of 100 lines and an allowance without a file or a reason are read as something else than what is written, so they are reported too.',
    bad: `"rules": { "naming/sufix": "warn" }, "guard": "strict",
"limits": { "maxFunctionLines": 250 },
"onePerFile": { "allow": [{ "file": "src/platform/http-server.ts" }] }`,
    good: `"rules": { "naming/suffix": "warn" }, "guard": "advise",   // enforce (default), advise or off: how the editor hook reacts
"limits": { "maxFunctionLines": 40 },                       // at most 100
"onePerFile": { "allow": [{ "file": "src/platform/http-server.ts", "reason": "The server and its two error mappers are one boundary." }] }`,
  },
  'config/suppression-needs-reason': {
    why: 'An exception to an architecture rule is a decision someone will question later. The reason written next to it is what makes it reviewable; a bare suppression is indistinguishable from a shortcut.',
    bad: `// ddd-ts-kit-disable-next-line layer/domain-purity`,
    good: `// ddd-ts-kit-disable-next-line layer/domain-purity -- ADR-0012: decimal.js is our money arithmetic`,
  },
};
