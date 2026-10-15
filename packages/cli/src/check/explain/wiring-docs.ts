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
@Repository(InvoiceRepository)
export class PgInvoiceRepository implements InvoiceRepository {}
contextModule('billing', billingDeclarations);`,
  },
  'declarations/role-declared': {
    why: 'In the declared style nothing lists the classes of a context: a class is registered because its file has the name of a role and its decorator says which one. A role file whose class declares nothing, or declares another role, is wired nowhere and nobody is told. The names a declaration writes (a consumer, a policy; the name of a job is held by scheduling/job-name) are identities kept in stores and logs, so they are literals; a domain event handler writes none, it is attached under the name its event class declares once, static readonly eventName. The domain declares nothing: a decorator there would make the model depend on its own wiring. Checked in declared-style projects only.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
export class IssueInvoiceHandler {}
// application/policies/only-issuer-voids.policy.ts
@Policy(billingPermissions['invoice.void'], { name: POLICY_NAME })
// domain/aggregates/invoice.aggregate.ts
@Repository(InvoiceRepository)
export class Invoice {}`,
    good: `// application/commands/issue-invoice/issue-invoice.handler.ts
@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler {}
// application/event-handlers/invoice-issued.event-handler.ts
@DomainEventHandler(InvoiceIssued)
export class InvoiceIssuedEventHandler {}`,
  },
  'declarations/barrel-current': {
    why: 'With stack.assembly set to barrel, the composition root assembles a context from <context>.declarations.ts and from nothing else. A role file added by hand and missing from the barrel compiles, passes its unit tests and is never registered. The same file registers what each constructor is injected, read from its signature: a constructor changed without regenerating would be given the dependencies of the old one. The file is derived from the tree, one export per role file sorted by path then one injected(Class, [Tokens]) per class that takes something, so it is compared with what the tree says, and the message names the class whose list is stale. With stack.assembly set to discovery the role files are found at startup, <context>.dependencies.ts holds the lists alone and is compared the same way, and a barrel left behind is reported.',
    bad: `// billing.declarations.ts, while only-issuer-voids.policy.ts exists and IssueInvoiceHandler now also takes a Clock
export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler';

injected(IssueInvoiceHandler, [InvoiceRepository]);`,
    good: `// billing.declarations.ts, rewritten by \`ddd-ts-kit generate\`, \`ddd-ts-kit docs\` and \`npm run dev\`
export * from '@/contexts/billing/application/authorization/only-issuer-voids.policy';
export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler';

injected(IssueInvoiceHandler, [InvoiceRepository, Clock]);`,
  },
  'declarations/constructor-injection': {
    why: 'The constructor signature is the one statement of what a declared class depends on: `ddd-ts-kit docs` reads it and writes the list the composition root injects, so nothing is repeated in the decorator and nothing can disagree with the constructor. That only works when each parameter names exactly one injection token, and a token is a class: an interface, a type alias or a primitive is erased by the compiler, a union names two things, an optional or defaulted parameter says the container might not give a value, which it always does. A constructor inherited from a class of a package cannot be read at all. The compiler is not asked for the types at run time: `emitDecoratorMetadata` exists only with legacy decorators compiled by tsc or swc, not with standard decorators nor under tsx or esbuild. Under "stack.dependencies": "signature" a list left in a decorator is a second statement: it wins at run time, so it is removed when it repeats the constructor (ESLint fixes it) and reported when it differs. A project whose config does not say lists its dependencies in its decorators, as 0.1 did, and may keep doing so.',
    bad: `@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler {
  constructor(
    private readonly invoices: InvoiceRepository | undefined,
    private readonly settings: InvoiceSettings,   // an interface
    private readonly retries = 3,
  ) {}
}
// "stack.dependencies": "signature"
@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])`,
    good: `@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly settings: InvoiceSettings,   // an abstract class of application/ports, bound to a value in the platform
    private readonly clock: Clock,
  ) {}
}`,
  },
  'config/rule-off-everywhere': {
    why: 'An exception is decided for some files: generated mappers, a legacy module, a migration script. Written as "off" alone, it silences the rule in every file of the project, and the real findings in the others go unseen; the decision record says why the rule is off, not that the exception grew to the whole project. A rule set for some files keeps judging the rest. When the whole project is really meant, "files": ["**"] says it in so many words.',
    bad: `"rules": { "clean/function-size": "off" },
"deviations": [{ "what": "rules.clean/function-size", "adr": "0004", "reason": "The generated mappers of the legacy ledger are long." }]`,
    good: `"rules": { "clean/function-size": { "severity": "off", "files": ["src/contexts/ledger/infrastructure/legacy/*.mapper.ts"] } },
"deviations": [{ "what": "rules.clean/function-size", "adr": "0004", "reason": "The generated mappers of the legacy ledger are long." }]`,
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
