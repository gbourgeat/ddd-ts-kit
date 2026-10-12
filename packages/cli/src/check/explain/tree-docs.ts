import type { RuleDoc } from '../model/rule-doc.js';

export const TREE_DOCS: Readonly<Record<string, RuleDoc>> = {
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
    why: 'The suffix states the role of a file before it is opened and lets the other rules know what they are looking at. Kebab-case avoids case-only renames that break on some file systems. A use case folder holds its message, its handler and, when it answers something, its result (*.result.ts); a job is application/scheduling/*.job.ts. Under presentation/http/ a controller lives in a folder of its own, presentation/http/<resource>/<use-case>/, with the schemas of its request and of its answer (*.params.ts, *.query.ts, *.headers.ts, *.body.ts, *.accepted.ts, *.answer.ts, *.line.ts), its *.mapper.ts and its *.serializer.ts; a route group is presentation/http/<name>.routes.ts, a guard presentation/http/guards/*.guard.ts, and what several routes share is under presentation/http/shared/. Function routes stay flat: *.route.ts and *.dto.ts, listed in presentation/http/<context>.routes.ts.',
    bad: `domain/aggregates/Invoice.ts`,
    good: `domain/aggregates/invoice.aggregate.ts
application/commands/issue-invoice/issue-invoice.result.ts
application/scheduling/send-reminders.job.ts
presentation/http/invoices.routes.ts
presentation/http/invoices/issue-invoice/issue-invoice.controller.ts`,
  },
  'naming/search-not-list': {
    why: 'A read that takes criteria, a scope or a page is a search, and the whole project says so with one word: a port, its adapters, its fakes, the query and its folder. Two words for one thing make a reader wonder what the difference is, and a generated name then disagrees with a written one. Judged: a method named list, or list followed by an upper-case letter, in domain/repositories/*.repository.ts, application/ports/*.port.ts, infrastructure/ and test/fakes/ of a context (properties are not judged, nor listAccessible, which the Authorizer port of the kit requires); and under application/queries/, a folder or a file named list or starting with list- or list., and a class named List or starting with List followed by an upper-case letter. A read of one element or none stays findById or findBy...',
    bad: `// application/ports/invoice-reader.port.ts
abstract list(scope: AccessScope, page: PageRequest<InvoiceSort>): Promise<Page<InvoiceLine>>;
abstract listByCustomer(customerId: string): Promise<readonly InvoiceLine[]>;
// application/queries/list-invoices/list-invoices.query.ts
export class ListInvoicesQuery {}`,
    good: `// application/ports/invoice-reader.port.ts
abstract search(scope: AccessScope, page: PageRequest<InvoiceSort>): Promise<Page<InvoiceLine>>;
abstract searchByCustomer(customerId: string): Promise<readonly InvoiceLine[]>;
abstract findById(id: string): Promise<InvoiceLine | undefined>;
// application/queries/search-invoices/search-invoices.query.ts
export class SearchInvoicesQuery {}`,
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
    why: 'Aggregates, value objects, domain services, handlers and jobs hold the business behaviour and what triggers it; an untested one is an unverified rule. Requiring the spec file makes the missing test visible at the moment the code is written.',
    bad: `domain/aggregates/invoice.aggregate.ts with no test/**/invoice.aggregate.spec.ts`,
    good: `test/unit/invoice.aggregate.spec.ts`,
  },
  'test/coverage-governed': {
    why: 'A coverage threshold is a floor that says how much of a layer no test has ever run, and it only says so while the measure is honest. One source holds it: the "coverage" key of ddd-ts-kit.config.json gives, per layer, the four rates every context must reach (the reference when the key is absent), and the test runner config reads them through governedCoverage of @ddd-ts-kit/testing/coverage, which also measures the four layers of every context, the files no test loads included. Raising a threshold is free; lowering one is a deviation with its decision record (governance/recorded-deviation). What this rule refuses is the quiet way around: an include, an exclude or thresholds written by hand in the runner config, the same set by a flag in a script, and a coverage ignore comment (v8 ignore, istanbul ignore, c8 ignore) in a production source that names no decision record. A rate proves that code ran under a test, never that the test asserts anything: the floor is not a goal.',
    bad: `// vitest.config.ts
coverage: { ...governedCoverage(mode), exclude: ['src/contexts/billing/infrastructure/**'] }
// domain/aggregates/invoice.aggregate.ts
/* v8 ignore next 3 */`,
    good: `// vitest.config.ts
coverage: { provider: 'v8', reporter: ['text', 'cobertura', 'lcov'], ...governedCoverage(mode) }
// ddd-ts-kit.config.json
"coverage": { "infrastructure": { "branches": 50 } },
"deviations": [{ "what": "coverage.infrastructure.branches", "adr": "0011", "reason": "The driver's failure branches are held by its contract suite." }]
// domain/aggregates/invoice.aggregate.ts
/* v8 ignore next 3 -- ADR-0012: reached only by the legacy import, removed with it */`,
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
};
