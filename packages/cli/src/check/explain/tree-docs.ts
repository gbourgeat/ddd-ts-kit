import type { RuleDoc } from '../model/rule-doc';

export const TREE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'tree/closed': {
    why: 'A fixed tree means every concept has one obvious place, so people and tools find it without reading the code. An ad hoc folder (utils, helpers, common, types, functions) is where unnamed concepts go to hide: a function that reads a value is a method of that value object, a decision over several objects a domain service, a shared shape of data a value object, an interchangeable rule an abstract class of domain/services with one service per variant (docs/ARCHITECTURE.md, a concept with no role of its own). A real new need is declared in extraDirectories with its reason. In the declared style the generated summary <context>.declarations.ts lives at the root of the context, next to CONTEXT.md, and the generated <layer>.declarations.ts of each layer in that layer; a module file may stay at the root when the wiring of a context is unusual.',
    bad: `contexts/billing/domain/utils/rounding.ts`,
    good: `contexts/billing/domain/value-objects/money.vo.ts
contexts/billing/billing.declarations.ts                          // declared style only
contexts/billing/application/application.declarations.ts          // declared style only`,
  },
  'tree/context-doc': {
    why: 'CONTEXT.md is where the vocabulary and the boundaries are agreed with the domain experts. Without it, names drift and nobody can tell whether a concept belongs here. The classification says how much design effort the context deserves.',
    bad: `contexts/billing/ without CONTEXT.md, or with "## Classification" saying generic while the config says core`,
    good: `## Purpose, ## Classification, ## Ubiquitous language, ## Aggregates, ## Published events, ## Relationships`,
  },
  'tree/documented-paths': {
    why: 'A plan, a design note or a review of docs/architecture is read by the next person or agent before the code. When a rule moved a file (a service of application/services became a port), a document that still names the old place sends its reader to a design the code no longer has, and a worker may build it again. Each path of a context written as code in a Markdown file of docs/architecture is judged as tree/closed judges a file: its directories and the file itself must have a place in the canonical tree. A path written relative to its context (`application/services/credit-limit.service.ts`) names no context: it is reported only when every declared context refuses it, their extra directories considered; a path starting with `test/` is left alone, since the project root has `test/e2e/` too. A path that does not exist yet is not reported: a plan names files to create. It is a warning.',
    bad: `docs/architecture/design-review.md: "add \`src/contexts/billing/application/services/credit-limit.service.ts\`"`,
    good: `docs/architecture/design-review.md: "add the port \`src/contexts/billing/application/ports/credit-limit-reader.port.ts\`"`,
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
  'naming/business-name': {
    why: 'The code of the model is read by people who speak the business, and it is the ubiquitous language written down: a handler that loads an appointment and calls it target, data or item makes every reader translate it back, and hides which concept a line handles. A generic name also spreads, because the next line copies it: the command handler templates of the kit wrote target until 0.17, and forty handlers of the example inherited it. Judged: a variable, a loop variable, a destructured binding, a parameter (of a function, a method, a signature or an arrow) and a property (of a class, an interface or a type of an object) under domain/ and application/ of a context, and in the shared kernel outside presentation/, named target, targets, data, item, items, obj, object, thing, things, stuff, info, element, el, tmp, temp, foo, bar or baz; "businessNames": { "words": [..] } replaces the list and { "allow": [..] } removes words from it. A key of an object literal follows the type it is written for and is not judged, nor infrastructure, presentation, the platform and the tests. npx eslint --fix renames a variable built by X.create(..) or new X(..), or read from a repository, with every use of it; a loop variable is reported with the singular of its collection.',
    bad: `const target = await this.appointmentRepository.findById(command.appointmentId);
for (const target of due) {
  target.expire(now);
}`,
    good: `const appointment = await this.appointmentRepository.findById(command.appointmentId);
for (const reminder of dueReminders) {
  reminder.send(now);
}`,
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
    why: 'Aggregates, value objects, domain services, handlers and jobs hold the business behaviour and what triggers it; an untested one is an unverified rule. Requiring the spec file makes the missing test visible at the moment the code is written. An abstract base (every exported class abstract, no exported function), such as a strategy of domain/services, needs none: the specs of its implementations hold its behaviour.',
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
  'test/mutation-governed': {
    why: 'A mutation score says how many of the changes made to the domain its tests would notice, and it only says so while the measure is honest. One source holds it: the "mutation" key of ddd-ts-kit.config.json gives the floor of the domain layer every context must reach (80 when the key is absent), and the Stryker config reads it through governedMutation of @ddd-ts-kit/testing/mutation, which also mutates the domain layer of every context, the texts of its refusals left out through the ignorer of the kit, since a refusal is asserted by its code and never by its text, every other string measured. Raising the floor is free; lowering it is a deviation with its decision record (governance/recorded-deviation). What this rule refuses is the quiet way around: a mutate, mutator, ignorers, ignoreStatic or thresholds written by hand in the Stryker config, or a config that does not read the kit at all. A survivor is a rule no test states: it is read as a decision, then tested or left alive and said so, never hidden by the configuration.',
    bad: `// stryker.config.mjs
export default { testRunner: 'vitest', mutate: ['src/contexts/billing/domain/**'], thresholds: { break: 10 } };`,
    good: `// stryker.config.mjs
import { governedMutation } from '@ddd-ts-kit/testing/mutation';
export default { testRunner: 'vitest', vitest: { configFile: 'vitest.mutation.config.ts' }, ...governedMutation() };
// ddd-ts-kit.config.json
"mutation": { "domain": 70 },
"deviations": [{ "what": "mutation.domain", "adr": "0013", "reason": "The legacy module is retired next quarter." }]`,
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
  'test/acceptance-black-box': {
    why: 'An acceptance scenario says what a client of the application observes once a story is built, and it is written before the code of the story: the scenario of a route not built yet fails on its answer, and stays wrapped in `pending(...)` until the rows it names are built. A class of the application imported by the spec would not exist yet, so the spec could not even compile before the code; once it exists, the scenario that calls it tests the class, not what the client gets. The spec drives the routes and asserts the answer, the problem document and the integration events. It may import the builders of a context (test data) and its published language (the contract its clients already read), the support of test/e2e/ and the packages. It is a warning.',
    bad: `// test/acceptance/us5.acceptance.spec.ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';`,
    good: `// test/acceptance/us5.acceptance.spec.ts
it('#US5.02 AC1 an accountant issues an invoice', pending(async () => {
  expectStatus(await accountant.post('/invoices', anInvoiceRequest()), 201);
}));`,
  },
  'test/helper-placed': {
    why: 'test/unit/ and test/integration/ hold specs. A helper written among them (an arrange function several specs import, a factory of test data, an in-memory class) has no name a reader can look for, and the next spec copies it instead of finding it. Each has its place: the arrangement several specs of the context share, the test application or the buses with the fakes of the context, is a world of test/worlds/*.world.ts (generate test-world writes one from the fakes of the context); test data is a builder of test/builders/; an in-memory implementation of a port is a fake of test/fakes/. A file whose name ends with .spec.ts, .test.ts or .d.ts is not reported. It is a warning.',
    bad: `test/unit/scheduling-application.ts   // imported by four handler specs`,
    good: `// test/worlds/scheduling.world.ts, written by \`npx ddd-ts-kit generate test-world scheduling\`
const { application, appointmentRepository } = await aSchedulingWorld({ now: NOW });`,
  },
};
