import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONFIG_FILE, parseConfig } from '../config.js';
import { runCheck } from './engine.js';
import { loadProject } from './project.js';
import { CONTEXT_DOC_HEADINGS } from './rules/tree-context-doc.js';
import type { Violation } from './types.js';

/**
 * Mini-projects proving each rule both ways. They ship with the CLI so that
 * `ddd-ts-kit check --self` can verify an installed build, and the test suite
 * replays the very same list.
 */

type Files = Readonly<Record<string, string>>;

export interface Fixture {
  readonly ruleId: string;
  readonly name: string;
  readonly files: Files;
  /** `pass`: no violation at all. Otherwise the file the rule has to report. */
  readonly expect: 'pass' | { readonly file: string };
  /** Other rules that legitimately fire on the same mistake. */
  readonly also?: readonly string[];
}

const BILLING = 'src/contexts/billing';
const CATALOG = 'src/contexts/catalog';

const GLOSSARY = '| Term | Meaning |\n|---|---|\n| Invoice | A request for payment. |\n| Issue | To make an invoice final. |\n| Money | An amount in a currency. |';

const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const AGGREGATE_SPEC = `${BILLING}/test/unit/invoice.aggregate.spec.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const HANDLER_SPEC = `${BILLING}/test/unit/issue-invoice.handler.spec.ts`;
const ROUTE = `${BILLING}/presentation/http/issue-invoice.route.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/in-memory-invoice.repository.ts`;
const EVENT = `${BILLING}/domain/events/invoice-issued.event.ts`;
const PUBLISHED = `${BILLING}/published-language/invoice-issued.v1.integration-event.ts`;
const SPEC = "import { it } from 'vitest';\nit.todo('behaves');\n";

const BUILDER = `${BILLING}/test/builders/invoice.builder.ts`;
const MODULE = `${BILLING}/billing.module.ts`;
const COMMAND = `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`;
const QUERY = `${BILLING}/application/queries/list-issued-invoices/list-issued-invoices.query.ts`;
const PUBLISHER = `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`;
const CONSUMER = `${BILLING}/application/integration/consumers/product-listed.consumer.ts`;
const CONSUMER_SPEC = `${BILLING}/test/unit/product-listed.consumer.spec.ts`;
const PLATFORM_MODULE = 'src/platform/platform.module.ts';
/** The decision record behind what the fixtures relax on purpose, so that only the rule under test speaks. */
const FIXTURE_ADR = 'docs/adr/0001-fixture-decisions.md';
const DECIMAL_ADR = 'docs/adr/0012-decimal-arithmetic.md';
const RECORD = '# Decision\n\nContext, deviation, reason, scope, condition for removal.\n';
const DECLARE = "import { z } from 'zod';\nimport { defineIntegrationEvent } from '@ddd-ts-kit/events';\nimport { zodSchema } from '@ddd-ts-kit/validation/zod';\n";
const PAYLOAD = 'payload: zodSchema(z.object({ invoiceId: z.string() }))';
const declaration = (type: string, version = 1, payload = PAYLOAD): string =>
  `export const invoiceIssuedV${version} = defineIntegrationEvent({ type: '${type}', version: ${version}, ${payload} });\n`;

const aggregate = (body: string): Files => ({ [AGGREGATE]: body, [AGGREGATE_SPEC]: SPEC, [BUILDER]: 'export const anInvoice = 1;\n' });
const handler = (body: string): Files => ({ [HANDLER]: body, [HANDLER_SPEC]: SPEC });

export const FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'layer/domain-purity',
    name: 'kernel, own domain and shared kernel are allowed; comments and strings are not imports',
    expect: 'pass',
    files: project(
      aggregate(
        [
          "import { AggregateRoot } from '@ddd-ts-kit/kernel';",
          "import { Money } from '../value-objects/money.vo.js';",
          "import type { Currency } from '@/shared-kernel/currency.js';",
          "// import { z } from 'zod';",
          "/* import fs from 'node:fs'; */",
          "const note = \"import x from 'zod'\";",
          "const template = `require('pg') ${note} import('express')`;",
          'const pattern = /import "zod"/;',
          'export class Invoice extends AggregateRoot {}',
          'export type { Money, Currency };',
          'export { note, template, pattern };',
        ].join('\n'),
      ),
      { [CONFIG_FILE]: config({ rules: { 'clean/no-commented-out-code': 'off' } }) },
    ),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'a validation library in the domain',
    expect: { file: AGGREGATE },
    files: project(aggregate("import { IsEmail } from 'class-validator';\nexport class Invoice {}\n")),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'a Node built-in in the domain, even node:crypto',
    expect: { file: AGGREGATE },
    also: ['purity/no-ambient-randomness'],
    files: project(aggregate("import { randomUUID } from 'node:crypto';\nexport class Invoice { id = randomUUID(); }\n")),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'a type-only import of a package in the domain',
    expect: { file: AGGREGATE },
    files: project(aggregate("import type { ZodType } from 'zod';\nexport class Invoice {}\nexport type S = ZodType;\n")),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'a dynamic import in the domain',
    expect: { file: AGGREGATE },
    files: project(aggregate("export class Invoice { load() { return import('pg'); } }\n")),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'the domain reaching the application layer',
    expect: { file: AGGREGATE },
    files: project(aggregate("import type { Mailer } from '../../application/ports/mailer.port.js';\nexport class Invoice {}\nexport type M = Mailer;\n")),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'domain, kernel and a declared published language are allowed',
    expect: 'pass',
    files: project(
      handler(
        [
          "import type { UseCase } from '@ddd-ts-kit/kernel';",
          "import type { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';",
          "import type { ProductListedV1 } from '../../../../catalog/published-language/index.js';",
          'export class IssueInvoiceHandler {}',
          'export type T = UseCase<ProductListedV1, InvoiceRepository>;',
        ].join('\n'),
      ),
    ),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'a handler importing an adapter',
    expect: { file: HANDLER },
    files: project(handler("import type { PgInvoiceRepository } from '../../../infrastructure/persistence/pg-invoice.repository.js';\nexport class IssueInvoiceHandler {}\nexport type R = PgInvoiceRepository;\n")),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'a handler importing a framework',
    expect: { file: HANDLER },
    files: project(handler("import type { Request } from 'express';\nexport class IssueInvoiceHandler {}\nexport type R = Request;\n")),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'a handler requiring a driver',
    expect: { file: HANDLER },
    files: project(handler("const pg = require('pg');\nexport class IssueInvoiceHandler { driver = pg; }\n")),
  },
  {
    ruleId: 'layer/presentation-no-infrastructure',
    name: 'a route calling a handler',
    expect: 'pass',
    files: project({
      ...handler('export class IssueInvoiceHandler {}\n'),
      [ROUTE]: "import type { IssueInvoiceHandler } from '../../application/commands/issue-invoice/issue-invoice.handler.js';\nexport type H = IssueInvoiceHandler;\n",
    }),
  },
  {
    ruleId: 'layer/presentation-no-infrastructure',
    name: 'a route importing an adapter',
    expect: { file: ROUTE },
    files: project({
      [ROUTE]: "import type { InMemoryInvoiceRepository } from '../../infrastructure/persistence/in-memory-invoice.repository.js';\nexport type R = InMemoryInvoiceRepository;\n",
    }),
  },
  {
    ruleId: 'layer/infrastructure-no-presentation',
    name: 'an adapter implementing a domain interface',
    expect: 'pass',
    files: project({
      [ADAPTER]: "import type { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';\nexport class InMemoryInvoiceRepository {}\nexport type R = InvoiceRepository;\n",
    }),
  },
  {
    ruleId: 'layer/infrastructure-no-presentation',
    name: 'an adapter importing a DTO',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]: "import type { InvoiceDto } from '@/contexts/billing/presentation/http/invoice.dto.js';\nexport type D = InvoiceDto;\n",
    }),
  },
  {
    ruleId: 'context/published-language-only',
    name: 'another context imported through its published language',
    expect: 'pass',
    files: project({
      [ADAPTER]: "export * from '../../../catalog/published-language/index.js';\n",
    }),
  },
  {
    ruleId: 'context/published-language-only',
    name: 'another context imported through its domain',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]: "import { Product } from '../../../catalog/domain/aggregates/product.aggregate.js';\nexport const p = Product;\n",
    }),
  },
  {
    ruleId: 'context/published-language-only',
    name: 'another context imported through the alias',
    expect: { file: ROUTE },
    files: project({
      [ROUTE]: "import type { ListProductsHandler } from '@/contexts/catalog/application/queries/list-products/list-products.handler.js';\nexport type H = ListProductsHandler;\n",
    }),
  },
  {
    ruleId: 'context/declared-relationship',
    name: 'an upstream that is declared',
    expect: 'pass',
    files: project({
      [ROUTE]: "import type { ProductListedV1 } from '../../../catalog/published-language/index.js';\nexport type P = ProductListedV1;\n",
    }),
  },
  {
    ruleId: 'context/declared-relationship',
    name: 'a published language imported without a declared relationship',
    expect: { file: `${CATALOG}/presentation/http/list-products.route.ts` },
    files: project({
      [`${CATALOG}/presentation/http/list-products.route.ts`]:
        "import type { InvoiceIssuedV1 } from '../../../billing/published-language/index.js';\nexport type I = InvoiceIssuedV1;\n",
    }),
  },
  {
    ruleId: 'context/published-language-is-a-contract',
    name: 'a declaration built on the kernel envelope and the schema library of the project',
    expect: 'pass',
    files: project({
      [PUBLISHED]: `import type { IntegrationEvent } from '@ddd-ts-kit/kernel';\n${DECLARE}${declaration('billing.invoice.issued')}export type InvoiceIssuedV1 = IntegrationEvent<{ readonly invoiceId: string }>;\n`,
      [`${BILLING}/published-language/index.ts`]: "export * from './invoice-issued.v1.integration-event.js';\n",
    }),
  },
  {
    ruleId: 'context/published-language-is-a-contract',
    name: 'a contract importing a package that is neither the kernel nor the schema library',
    expect: { file: PUBLISHED },
    files: project({ [PUBLISHED]: "import { v4 } from 'uuid';\nexport const sample = v4();\n" }),
  },
  {
    ruleId: 'context/published-language-is-a-contract',
    name: 'a contract re-exporting the domain',
    expect: { file: `${BILLING}/published-language/index.ts` },
    files: project({
      [`${BILLING}/published-language/index.ts`]: "export { Invoice } from '../domain/aggregates/invoice.aggregate.js';\n",
    }),
  },
  {
    ruleId: 'context/no-cycle',
    name: 'a one-way relationship',
    expect: 'pass',
    files: project({}),
  },
  {
    ruleId: 'context/no-cycle',
    name: 'two contexts upstream of each other',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: [{ context: 'catalog' }] },
            catalog: { classification: 'supporting', upstreams: ['billing'] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'tree/closed',
    name: 'canonical directories, an open use-case level and a declared extra directory',
    expect: 'pass',
    files: project(
      {
        ...handler('export class IssueInvoiceHandler {}\n'),
        [`${BILLING}/infrastructure/messaging/outbox.ts`]: 'export const outbox = 1;\n',
        [`${BILLING}/test/unit/domain/deep/anything.spec.ts`]: SPEC,
        [`${BILLING}/billing.module.ts`]: 'export const billingModule = {};\n',
      },
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: {
              classification: 'core',
              upstreams: ['catalog'],
              extraDirectories: [{ path: 'infrastructure/messaging', reason: 'outbox relay' }],
            },
            catalog: { classification: 'supporting', upstreams: [] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'tree/closed',
    name: 'an ad hoc directory',
    expect: { file: `${BILLING}/domain/utils` },
    files: project({ [`${BILLING}/domain/utils/rounding.ts`]: 'export const round = 1;\n' }),
  },
  {
    ruleId: 'tree/closed',
    name: 'a source file outside a role directory',
    expect: { file: `${BILLING}/domain/rounding.ts` },
    files: project({ [`${BILLING}/domain/rounding.ts`]: 'export const round = 1;\n' }),
  },
  {
    ruleId: 'tree/context-doc',
    name: 'a complete CONTEXT.md',
    expect: 'pass',
    files: project({}),
  },
  {
    ruleId: 'tree/context-doc',
    name: 'no CONTEXT.md',
    expect: { file: `${BILLING}/CONTEXT.md` },
    files: (() => {
      const { [`${BILLING}/CONTEXT.md`]: _removed, ...rest } = project({ [`${BILLING}/published-language/index.ts`]: 'export {};\n' });
      return rest;
    })(),
  },
  {
    ruleId: 'tree/context-doc',
    name: 'a missing section',
    expect: { file: `${BILLING}/CONTEXT.md` },
    files: project({}, { [`${BILLING}/CONTEXT.md`]: contextDoc('core', CONTEXT_DOC_HEADINGS.filter((heading) => heading !== '## Relationships')) }),
  },
  {
    ruleId: 'tree/context-doc',
    name: 'a classification that contradicts the config',
    expect: { file: `${BILLING}/CONTEXT.md` },
    files: project({}, { [`${BILLING}/CONTEXT.md`]: contextDoc('generic') }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'role suffixes in kebab-case',
    expect: 'pass',
    files: project({
      ...aggregate('export class Invoice {}\n'),
      [`${BILLING}/domain/errors/invoice-already-issued.error.ts`]: 'export class InvoiceAlreadyIssuedError extends Error {}\n',
      [`${BILLING}/domain/errors/index.ts`]: "export * from './invoice-already-issued.error.js';\n",
      [`${BILLING}/presentation/http/invoice.dto.ts`]: 'export interface InvoiceDto { readonly id: string }\n',
    }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'a file without the suffix of its role',
    expect: { file: `${BILLING}/domain/errors/invoice-already-issued.ts` },
    files: project({ [`${BILLING}/domain/errors/invoice-already-issued.ts`]: 'export class InvoiceAlreadyIssuedError extends Error {}\n' }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'a file name that is not kebab-case',
    expect: { file: `${BILLING}/domain/errors/InvoiceAlreadyIssued.error.ts` },
    files: project({ [`${BILLING}/domain/errors/InvoiceAlreadyIssued.error.ts`]: 'export class InvoiceAlreadyIssuedError extends Error {}\n' }),
  },
  {
    ruleId: 'naming/one-concept-per-file',
    name: 'one exported class, with private helpers and types',
    expect: 'pass',
    files: project(aggregate('class Money {}\nexport interface InvoiceState { readonly total: Money }\nexport class Invoice {}\n// export class Ghost {}\n'), { [CONFIG_FILE]: config({ rules: { 'clean/no-commented-out-code': 'off' } }) }),
  },
  {
    ruleId: 'naming/one-concept-per-file',
    name: 'two exported classes in an aggregate file',
    expect: { file: AGGREGATE },
    files: project(aggregate('export class Invoice {}\nexport class IssuedInvoice {}\n')),
  },
  {
    ruleId: 'test/spec-required',
    name: 'a spec found by base name anywhere under test/',
    expect: 'pass',
    files: project({
      [AGGREGATE]: 'export class Invoice {}\n',
      [BUILDER]: 'export const anInvoice = 1;\n',
      [`${BILLING}/test/unit/domain/invoice.aggregate.spec.ts`]: SPEC,
      [`${BILLING}/domain/value-objects/money.vo.ts`]: 'export class Money {}\n',
      [`${BILLING}/test/unit/money.spec.ts`]: SPEC,
    }),
  },
  {
    ruleId: 'test/spec-required',
    name: 'an aggregate without a spec',
    expect: { file: AGGREGATE },
    files: project({ [AGGREGATE]: 'export class Invoice {}\n', [BUILDER]: 'export const anInvoice = 1;\n' }),
  },
  {
    ruleId: 'test/spec-required',
    name: 'a handler whose spec lives in another context',
    expect: { file: HANDLER },
    files: project({ [HANDLER]: 'export class IssueInvoiceHandler {}\n', [`${CATALOG}/test/unit/issue-invoice.handler.spec.ts`]: SPEC }),
  },
  {
    ruleId: 'events/name-format',
    name: 'context.aggregate.fact names',
    expect: 'pass',
    files: project({
      [EVENT]: "export class InvoiceIssued {\n  readonly name = 'billing.invoice.issued';\n  readonly label: string = 'Invoice issued';\n}\n",
      [PUBLISHED]: `${DECLARE}${declaration('billing.invoice.marked-as-paid')}`,
      [`${BILLING}/published-language/invoice-summary.ts`]: "export interface InvoiceSummary { readonly type: 'standard' | 'credit-note' }\n",
    }),
  },
  {
    ruleId: 'events/name-format',
    name: 'a domain event named like its class',
    expect: { file: EVENT },
    files: project({ [EVENT]: "export class InvoiceIssued {\n  readonly name = 'InvoiceIssued';\n}\n" }),
  },
  {
    ruleId: 'events/name-format',
    name: 'an integration event carrying the prefix of another context',
    expect: { file: PUBLISHED },
    files: project({ [PUBLISHED]: `${DECLARE}${declaration('catalog.invoice.issued')}` }),
  },
  {
    ruleId: 'events/defined-in-published-language',
    name: 'two versions of an event, each declared once with a payload schema',
    expect: 'pass',
    files: project({
      [PUBLISHED]: `${DECLARE}${declaration('billing.invoice.issued')}`,
      [`${BILLING}/published-language/invoice-issued.v2.integration-event.ts`]: `${DECLARE}${declaration('billing.invoice.issued', 2)}`,
      [`${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`]:
        "import { invoiceIssuedV1 } from '../../../published-language/invoice-issued.v1.integration-event.js';\nexport class InvoiceIssuedPublisher { readonly definition = invoiceIssuedV1; }\n",
    }),
  },
  {
    ruleId: 'events/defined-in-published-language',
    name: 'an event declared in the application layer',
    expect: { file: `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts` },
    also: ['layer/application-inward'],
    files: project({
      [`${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`]: `${DECLARE}${declaration('billing.invoice.issued')}`,
    }),
  },
  {
    ruleId: 'events/defined-in-published-language',
    name: 'a declaration without a payload schema',
    expect: { file: PUBLISHED },
    files: project({ [PUBLISHED]: `${DECLARE}${declaration('billing.invoice.issued', 1, "description: 'payload: later'")}` }),
  },
  {
    ruleId: 'events/defined-in-published-language',
    name: 'the same version declared twice',
    expect: { file: `${BILLING}/published-language/zz-duplicate.integration-event.ts` },
    files: project({
      [PUBLISHED]: `${DECLARE}${declaration('billing.invoice.issued')}`,
      [`${BILLING}/published-language/zz-duplicate.integration-event.ts`]: `${DECLARE}${declaration('billing.invoice.issued')}`,
    }),
  },
  {
    ruleId: 'events/defined-in-published-language',
    name: 'an event described by hand in the published language',
    expect: { file: PUBLISHED },
    files: project({ [PUBLISHED]: "export interface InvoiceIssuedV1 { readonly type: 'billing.invoice.issued'; readonly version: 1 }\n" }),
  },
  {
    ruleId: 'test/no-mocks',
    name: 'a test built on a fake',
    expect: 'pass',
    files: project({
      [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      [HANDLER_SPEC]: "import { it } from 'vitest';\nconst note = 'no vi.fn() here';\n// jest.mock('x')\nit.todo(note);\n",
    }, { [CONFIG_FILE]: config({ rules: { 'clean/no-commented-out-code': 'off' } }) }),
  },
  {
    ruleId: 'test/no-mocks',
    name: 'a test using vi.fn and vi.spyOn',
    expect: { file: HANDLER_SPEC },
    files: project({
      [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      [HANDLER_SPEC]: "import { it, vi } from 'vitest';\nconst save = vi.fn();\nvi.spyOn(console, 'log');\nit.todo(String(save));\n",
    }),
  },
  {
    ruleId: 'test/no-mocks',
    name: 'a test importing a mocking library',
    expect: { file: HANDLER_SPEC },
    files: project({
      [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      [HANDLER_SPEC]: "import { it } from 'vitest';\nimport sinon from 'sinon';\nit.todo(String(sinon));\n",
    }),
  },
  {
    ruleId: 'test/builder-required',
    name: 'an aggregate with its builder',
    expect: 'pass',
    files: project(aggregate('export class Invoice {}\n')),
  },
  {
    ruleId: 'test/builder-required',
    name: 'an aggregate without a builder',
    expect: { file: AGGREGATE },
    files: project({ [AGGREGATE]: 'export class Invoice {}\n', [AGGREGATE_SPEC]: SPEC }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'a builder without its suffix',
    expect: { file: `${BILLING}/test/builders/invoice.ts` },
    files: project({ [`${BILLING}/test/builders/invoice.ts`]: 'export const anInvoice = 1;\n' }),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'names made of glossary terms, inflected, with structural and link words',
    expect: 'pass',
    files: project({
      ...aggregate('export class Invoice {}\n'),
      [EVENT]: "export class InvoiceIssued {\n  readonly name = 'billing.invoice.issued';\n}\n",
      [`${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`]: 'export class IssueInvoiceCommand {}\n',
      [`${BILLING}/application/queries/list-issued-invoices/list-issued-invoices.query.ts`]: 'export class InvoicesIssuedForMoneyQuery {}\n',
    }),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'a class named with a word the glossary does not define',
    expect: { file: AGGREGATE },
    files: project(aggregate('export class InvoiceLedger {}\n')),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'a use case whose verb is not in the glossary',
    expect: { file: `${BILLING}/application/commands/dispatch-invoice/dispatch-invoice.command.ts` },
    files: project({ [`${BILLING}/application/commands/dispatch-invoice/dispatch-invoice.command.ts`]: 'export class DispatchInvoiceCommand {}\n' }),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'domain classes in a context whose glossary is empty',
    expect: { file: `${BILLING}/CONTEXT.md` },
    files: project(aggregate('export class Invoice {}\n'), { [`${BILLING}/CONTEXT.md`]: contextDoc('core', CONTEXT_DOC_HEADINGS, '| Term | Meaning |\n|---|---|') }),
  },
  {
    ruleId: 'language/no-technical-name',
    name: 'names of the business',
    expect: 'pass',
    files: project({
      ...aggregate('export interface InvoiceState { readonly issued: boolean }\nexport class Invoice {}\n'),
      [`${BILLING}/infrastructure/persistence/invoice.mapper.ts`]: 'export class InvoiceDataMapper {}\n',
    }),
  },
  {
    ruleId: 'language/no-technical-name',
    name: 'a manager in the domain',
    expect: { file: `${BILLING}/domain/services/invoice-manager.service.ts` },
    also: ['language/glossary-term'],
    files: project({
      [`${BILLING}/domain/services/invoice-manager.service.ts`]: 'export class InvoiceManager {}\n',
      [`${BILLING}/test/unit/invoice-manager.service.spec.ts`]: SPEC,
    }),
  },
  {
    ruleId: 'language/no-technical-name',
    name: 'a technical word in a use case and in a domain type',
    expect: { file: AGGREGATE },
    files: project(aggregate('export type InvoiceData = { readonly total: number };\nexport class Invoice {}\n')),
  },
  {
    ruleId: 'purity/no-system-clock',
    name: 'time received as a parameter, a date built from a value',
    expect: 'pass',
    files: project(
      aggregate(
        "export class Invoice {\n  isOverdue(now: Date): boolean {\n    return new Date('2026-01-01') < now && new Date(now.getTime()) <= now;\n  }\n}\n// new Date() in a comment\nexport const note = 'Date.now()';\n",
      ),
    ),
  },
  {
    ruleId: 'purity/no-system-clock',
    name: 'new Date() in an aggregate',
    expect: { file: AGGREGATE },
    files: project(aggregate('export class Invoice {\n  readonly createdAt = new Date();\n}\n')),
  },
  {
    ruleId: 'purity/no-system-clock',
    name: 'Date.now() in a handler',
    expect: { file: HANDLER },
    files: project(handler('export class IssueInvoiceHandler {\n  stamp(): number {\n    return Date.now();\n  }\n}\n')),
  },
  {
    ruleId: 'purity/no-ambient-randomness',
    name: 'an identifier received from outside',
    expect: 'pass',
    files: project(aggregate('export class Invoice {\n  constructor(readonly id: string) {}\n}\n')),
  },
  {
    ruleId: 'purity/no-ambient-randomness',
    name: 'crypto.randomUUID in an aggregate',
    expect: { file: AGGREGATE },
    files: project(aggregate('export class Invoice {\n  readonly id = crypto.randomUUID();\n}\n')),
  },
  {
    ruleId: 'purity/no-ambient-randomness',
    name: 'an id library in a handler',
    expect: { file: HANDLER },
    also: ['layer/application-inward'],
    files: project(handler("import { nanoid } from 'nanoid';\nexport class IssueInvoiceHandler {\n  readonly id = nanoid();\n}\n")),
  },
  {
    ruleId: 'purity/no-environment',
    name: 'configuration received through the constructor',
    expect: 'pass',
    files: project(handler('export class IssueInvoiceHandler {\n  constructor(private readonly currency: string) {}\n}\n')),
  },
  {
    ruleId: 'purity/no-environment',
    name: 'process.env and console in a handler',
    expect: { file: HANDLER },
    files: project(handler("export class IssueInvoiceHandler {\n  readonly currency = process.env['CURRENCY'];\n  log(): void {\n    console.log(this.currency);\n  }\n}\n")),
  },
  {
    ruleId: 'purity/no-environment',
    name: 'the file system in the domain',
    expect: { file: AGGREGATE },
    also: ['layer/domain-purity'],
    files: project(aggregate("import { readFileSync } from 'node:fs';\nexport class Invoice {\n  readonly template = readFileSync;\n}\n")),
  },
  {
    ruleId: 'clean/stepdown',
    name: 'factories, public methods, then each private method after its caller',
    expect: 'pass',
    files: project({
      [ADAPTER]: [
        'export function load(text: string): string[] {',
        '  return text.split(",").map(clean);',
        '}',
        '',
        'function clean(part: string): string {',
        '  return part.trim();',
        '}',
        '',
        'export class InMemoryInvoiceRepository {',
        '  readonly #rows = new Map<string, string>();',
        '',
        '  private constructor() {}',
        '',
        '  static empty(): InMemoryInvoiceRepository {',
        '    return new InMemoryInvoiceRepository();',
        '  }',
        '',
        '  save(id: string): void {',
        '    this.#rows.set(id, this.#normalize(id));',
        '  }',
        '',
        '  get size(): number {',
        '    return this.#rows.size;',
        '  }',
        '',
        '  #normalize(id: string): string {',
        '    return this.trim(id);',
        '  }',
        '',
        '  private trim(id: string): string {',
        '    return id.trim();',
        '  }',
        '}',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'clean/stepdown',
    name: 'a private method declared before a public one',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]: 'export class InMemoryInvoiceRepository {\n  private trim(id: string): string {\n    return id.trim();\n  }\n\n  save(id: string): string {\n    return this.trim(id);\n  }\n}\n',
    }),
  },
  {
    ruleId: 'clean/stepdown',
    name: 'a helper function declared above its caller',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]: 'function clean(part: string): string {\n  return part.trim();\n}\n\nexport function load(text: string): string[] {\n  return text.split(",").map(clean);\n}\n',
    }),
  },
  {
    ruleId: 'clean/stepdown',
    name: 'a private method declared above the private method that calls it',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]:
        'export class InMemoryInvoiceRepository {\n  save(id: string): string {\n    return this.#normalize(id);\n  }\n\n  #trim(id: string): string {\n    return id.trim();\n  }\n\n  #normalize(id: string): string {\n    return this.#trim(id);\n  }\n}\n',
    }),
  },
  {
    ruleId: 'clean/function-size',
    name: 'short functions, a constructor with many injected dependencies',
    expect: 'pass',
    files: project({
      [ADAPTER]:
        'export class InMemoryInvoiceRepository {\n  constructor(\n    readonly a: string,\n    readonly b: string,\n    readonly c: string,\n    readonly d: string,\n  ) {}\n\n  find(id: string, options: { limit: number; offset: number }, fallback = id): string {\n    return id + options.limit + fallback;\n  }\n}\n',
    }),
  },
  {
    ruleId: 'clean/function-size',
    name: 'a function with four parameters',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: 'export function issue(id: string, customer: string, amount: number, currency: string): string {\n  return id + customer + amount + currency;\n}\n' }),
  },
  {
    ruleId: 'clean/function-size',
    name: 'a function longer than the limit',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]: `export function issue(id: string): string {\n${Array.from({ length: 31 }, (_, index) => `  const step${index} = id;`).join('\n')}\n  return id;\n}\n`,
    }),
  },
  {
    ruleId: 'clean/no-commented-out-code',
    name: 'prose, a why, an example in JSDoc and a directive',
    expect: 'pass',
    files: project({
      [ADAPTER]: [
        '// Rounded half-even: required by the tax authority (art. 242).',
        '// If the invoice is already issued, the adapter answers the stored one.',
        '/**',
        ' * Stores invoices in memory.',
        ' * @example',
        ' * const repository = new InMemoryInvoiceRepository();',
        ' * await repository.save(invoice);',
        ' */',
        'export class InMemoryInvoiceRepository {}',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'clean/no-commented-out-code',
    name: 'a statement left in a comment',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: '// const total = lines.reduce((sum, line) => sum + line.amount, 0);\nexport class InMemoryInvoiceRepository {}\n' }),
  },
  {
    ruleId: 'clean/no-commented-out-code',
    name: 'a block of code in a block comment',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: '/*\nif (invoice.issued) {\n  return invoice;\n}\n*/\nexport class InMemoryInvoiceRepository {}\n' }),
  },
  {
    ruleId: 'clean/no-noise-comment',
    name: 'comments that say why, a described parameter, an owned TODO',
    expect: 'pass',
    files: project({
      [ADAPTER]: [
        '/**',
        ' * Keeps a copy of each invoice so that a caller mutating its own instance changes nothing here.',
        ' * @param id the business number, not the storage key',
        ' * @returns the stored copy, never the instance given to save',
        ' */',
        'export function find(id: string): string {',
        '  // TODO(billing-team): replace by the archive lookup, see #142.',
        '  return id;',
        '}',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'clean/no-noise-comment',
    name: 'a JSDoc that repeats the member name',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: 'export class InMemoryInvoiceRepository {\n  /** Gets the order. */\n  getOrder(): string {\n    return "";\n  }\n}\n' }),
  },
  {
    ruleId: 'clean/no-noise-comment',
    name: 'a banner, a closing-brace label, an author, an empty tag and an ownerless TODO',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]: [
        '// ---------- helpers ----------',
        '/**',
        ' * Finds what a caller stored earlier, by business number.',
        ' * @author Ada',
        ' * @param id',
        ' * @returns',
        ' */',
        'export function find(id: string): string {',
        '  if (id === "") {',
        '    return id;',
        '  } // end if',
        '  // TODO handle archives',
        '  return id;',
        '}',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'clean/no-escape-hatch',
    name: 'narrowing instead of asserting, a justified expectation',
    expect: 'pass',
    files: project({
      [ADAPTER]: [
        'export function first(values: readonly string[], many: unknown): string {',
        '  const [head] = values;',
        '  if (head === undefined || !many) throw new Error("empty");',
        '  // @ts-expect-error the vendor typings miss this overload, see #77',
        '  const company = head !== "" ? head : "any";',
        '  // eslint-disable-next-line no-console -- ADR-0001: startup banner requested by operations',
        '  return company;',
        '}',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'clean/no-escape-hatch',
    name: 'any and a non-null assertion',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: 'export function first(values: any, map: Map<string, string>): string {\n  return (values as any)[0] + map.get("a")!.length;\n}\n' }),
  },
  {
    ruleId: 'clean/no-escape-hatch',
    name: 'suppressed diagnostics without a reason',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: '// @ts-ignore\nexport const a: number = "a";\n// @ts-expect-error\nexport const b: number = "b";\n// eslint-disable-next-line no-console\nexport const c = 1;\n' }),
  },
  {
    ruleId: 'clean/no-flag-argument',
    name: 'two intentions as two methods, a boolean carried by a command',
    expect: 'pass',
    files: project({
      ...aggregate('export class Invoice {\n  issue(): void {}\n\n  issueMoney(): void {}\n\n  private apply(issued: boolean): boolean {\n    return issued;\n  }\n}\n'),
      [`${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`]: 'export class IssueInvoiceCommand {\n  constructor(readonly issue: boolean) {}\n}\n',
    }),
  },
  {
    ruleId: 'clean/no-flag-argument',
    name: 'a boolean parameter on a public method of an aggregate',
    expect: { file: AGGREGATE },
    files: project(aggregate('export class Invoice {\n  issue(money: boolean): boolean {\n    return money;\n  }\n}\n')),
  },
  {
    ruleId: 'clean/no-flag-argument',
    name: 'a defaulted flag on execute',
    expect: { file: HANDLER },
    files: project(handler('export class IssueInvoiceHandler {\n  async execute(command: object, issue = false): Promise<boolean> {\n    return issue && command !== undefined;\n  }\n}\n')),
  },
  {
    ruleId: 'composition/only-in-module',
    name: 'adapters created in the module file, main.ts and tests',
    expect: 'pass',
    files: project({
      [ADAPTER]: 'export class InMemoryInvoiceRepository {}\n',
      [`${BILLING}/billing.module.ts`]: "import { InMemoryInvoiceRepository } from './infrastructure/persistence/in-memory-invoice.repository.js';\nexport const invoiceRepository = new InMemoryInvoiceRepository();\n",
      'src/main.ts': "import { InMemoryInvoiceRepository } from './contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';\nexport const repository = new InMemoryInvoiceRepository();\n",
      [`${BILLING}/test/integration/in-memory-invoice.repository.spec.ts`]: "import { InMemoryInvoiceRepository } from '../../infrastructure/persistence/in-memory-invoice.repository.js';\nexport const repository = new InMemoryInvoiceRepository();\n",
    }),
  },
  {
    ruleId: 'composition/only-in-module',
    name: 'an adapter instantiated by a handler',
    expect: { file: HANDLER },
    also: ['layer/application-inward'],
    files: project(handler("import { InMemoryInvoiceRepository as Repo } from '../../../infrastructure/persistence/in-memory-invoice.repository.js';\nexport class IssueInvoiceHandler {\n  readonly repository = new Repo();\n}\n")),
  },
  {
    ruleId: 'composition/only-in-module',
    name: 'an adapter registered by class outside the module',
    expect: { file: 'src/bootstrap.ts' },
    files: project({
      'src/bootstrap.ts': "import { InMemoryInvoiceRepository } from './contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';\nexport const binding = { useClass: InMemoryInvoiceRepository };\n",
    }),
  },
  {
    ruleId: 'config/valid',
    name: 'a consistent config',
    expect: 'pass',
    files: project({}, { [CONFIG_FILE]: config({ rules: { 'naming/suffix': 'warn', 'test/spec-required': 'off', 'domain/no-generic-error': 'warn' }, guard: 'advise' }) }),
  },
  {
    ruleId: 'config/valid',
    name: 'an unknown upstream',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: [{ context: 'pricing' }] },
            catalog: { classification: 'supporting', upstreams: [] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'config/valid',
    name: 'an unknown guard mode',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ guard: 'strict' }) }),
  },
  {
    ruleId: 'config/valid',
    name: 'an unknown rule id',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ rules: { 'naming/sufix': 'warn' } }) }),
  },
  {
    ruleId: 'config/valid',
    name: 'a context on disk that the config does not declare',
    expect: { file: 'src/contexts/shipping' },
    files: project({ 'src/contexts/shipping/CONTEXT.md': contextDoc('generic') }),
  },
  {
    ruleId: 'config/valid',
    name: 'a declared context that does not exist on disk',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: ['catalog'] },
            catalog: { classification: 'supporting', upstreams: [] },
            shipping: { classification: 'generic', upstreams: [] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'config/suppression-needs-reason',
    name: 'a suppression with a reason silences the violation',
    expect: 'pass',
    files: project({
      ...aggregate("// ddd-ts-kit-disable-next-line layer/domain-purity -- decimal arithmetic approved in ADR 12\nimport Decimal from 'decimal.js';\nexport class Invoice { total = new Decimal(0); }\n"),
      [DECIMAL_ADR]: RECORD,
    }),
  },
  {
    ruleId: 'config/suppression-needs-reason',
    name: 'a suppression without a reason',
    expect: { file: AGGREGATE },
    also: ['layer/domain-purity'],
    files: project(aggregate("// ddd-ts-kit-disable-next-line layer/domain-purity\nimport Decimal from 'decimal.js';\nexport class Invoice { total = new Decimal(0); }\n")),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a publisher on the port, a platform that hands the OutboxPublisher and keeps the bus for the relay',
    expect: 'pass',
    files: project({
      [PUBLISHER]: "import type { IntegrationEventPublisher } from '@ddd-ts-kit/kernel';\nexport class InvoiceIssuedPublisher {\n  constructor(private readonly publisher: IntegrationEventPublisher) {}\n}\n",
      [PLATFORM_MODULE]:
        "import { OutboxPublisher } from '@ddd-ts-kit/events';\nimport { InMemoryEventBus } from '@ddd-ts-kit/kernel';\nexport const bus = new InMemoryEventBus();\nexport const platform = { eventPublisher: new OutboxPublisher(store), relayTarget: bus };\n",
      'src/platform/events/outbox-relay.ts': 'export const relay = new OutboxRelay({ store, publisher: bus });\n',
    }),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'no database: the in-memory bus alone is enough',
    expect: 'pass',
    files: project({ [PLATFORM_MODULE]: 'export const platform = { eventPublisher: bus };\n' }, { [CONFIG_FILE]: config({ stack: { database: 'none', orm: 'none', events: 'in-memory' } }) }),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a database without the outbox, recorded as a deviation',
    expect: 'pass',
    files: project(
      {},
      { [CONFIG_FILE]: config({ stack: { events: 'in-memory' }, deviations: [{ what: 'stack.events', adr: 'ADR-0001', reason: 'Events are advisory in this prototype.' }] }) },
    ),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a handler importing a broker client',
    expect: { file: HANDLER },
    also: ['layer/application-inward'],
    files: project(handler("import { connect } from 'amqplib';\nexport class IssueInvoiceHandler {\n  readonly open = connect;\n}\n")),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a handler publishing on the in-memory bus',
    expect: { file: HANDLER },
    files: project(handler("import type { InMemoryEventBus } from '@ddd-ts-kit/kernel';\nexport class IssueInvoiceHandler {\n  constructor(private readonly bus: InMemoryEventBus) {}\n}\n")),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a publisher that depends on the whole bus',
    expect: { file: PUBLISHER },
    files: project({ [PUBLISHER]: "import type { EventBus } from '@ddd-ts-kit/kernel';\nexport class InvoiceIssuedPublisher {\n  constructor(private readonly bus: EventBus) {}\n}\n" }),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a platform that hands the bus to use cases',
    expect: { file: PLATFORM_MODULE },
    files: project({ [PLATFORM_MODULE]: "import { InMemoryEventBus } from '@ddd-ts-kit/kernel';\nexport const bus = new InMemoryEventBus();\nexport const platform = { eventPublisher: bus };\n" }),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a database with in-memory events',
    expect: { file: CONFIG_FILE },
    also: ['governance/recorded-deviation'],
    files: project({}, { [CONFIG_FILE]: config({ stack: { orm: 'drizzle', events: 'in-memory' } }) }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'consumers registered under their own name, by the builder and by hand',
    expect: 'pass',
    files: project({
      [CONSUMER]: 'export class ProductListedConsumer {}\n',
      [CONSUMER_SPEC]: SPEC,
      [`${BILLING}/application/integration/consumers/product-withdrawn.consumer.ts`]: 'export class ProductWithdrawnConsumer {}\n',
      [`${BILLING}/test/unit/product-withdrawn.consumer.spec.ts`]: SPEC,
      [MODULE]: [
        'export function register(builder: Builder): void {',
        '  builder',
        "    .on(productListedV1, { consumer: 'billing.product-listed' })",
        '    .handledBy(ProductListedConsumer, [COMMAND_BUS]);',
        "  process.on('SIGTERM', stop);",
        '}',
        'const productWithdrawnConsumer = create(commandBus);',
        'export const subscriptions = [',
        "  consume(productWithdrawnV1, { consumer: 'billing.product-withdrawn', processed, unitOfWork }, (event) => productWithdrawnConsumer.handle(event)),",
        "  on(productRenamedV1, rename, { consumer: 'billing.product-renamed', processed: store }),",
        "  subscribe(idempotent('billing.product-archived', store, archive)),",
        '];',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'a consumer subscribed without a consumer name',
    expect: { file: CONSUMER },
    files: project({
      [CONSUMER]: 'export class ProductListedConsumer {}\n',
      [CONSUMER_SPEC]: SPEC,
      [MODULE]: "export const subscription = subscriber.subscribe('catalog.product.listed', (event) => productListedConsumer.handle(event));\n",
    }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'one consumer name used twice in a module',
    expect: { file: MODULE },
    files: project({
      [MODULE]:
        "export const subscriptions = [\n  consume(productListedV1, { consumer: 'billing', processed, unitOfWork }, list),\n  consume(productWithdrawnV1, { consumer: 'billing', processed, unitOfWork }, withdraw),\n];\n",
    }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'one consumer name used by two contexts',
    expect: { file: `${CATALOG}/catalog.module.ts` },
    files: project({
      [MODULE]: "export const subscriptions = [consume(productListedV1, { consumer: 'product-listed', processed, unitOfWork }, list)];\n",
      [`${CATALOG}/catalog.module.ts`]: "export const subscriptions = [consume(productListedV1, { consumer: 'product-listed', processed, unitOfWork }, index)];\n",
    }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'a subscription by hand without a processed-event store',
    expect: { file: MODULE },
    files: project({ [MODULE]: "export const subscriptions = [on(productListedV1, list, { consumer: 'billing.product-listed' })];\n" }),
  },
  {
    ruleId: 'context/extractable',
    name: 'a context wired alone, its own schema, a gateway on the published language, an entry point',
    expect: 'pass',
    files: project(
      {
        [MODULE]: "import type { ProductListedV1 } from '../catalog/published-language/index.js';\nimport { InMemoryInvoiceRepository } from './infrastructure/persistence/in-memory-invoice.repository.js';\nexport const invoiceRepository = new InMemoryInvoiceRepository();\nexport type Listed = ProductListedV1;\n",
        [ADAPTER]: "export const billing = pgSchema('billing');\nexport class InMemoryInvoiceRepository {\n  readonly #rows = new Map<string, string>();\n\n  get size(): number {\n    return this.#rows.size;\n  }\n}\n",
        [`${BILLING}/infrastructure/external/in-process-product.gateway.ts`]: "import type { ProductListedV1 } from '../../../catalog/published-language/index.js';\nexport type Listed = ProductListedV1;\n",
        'src/apps/billing/main.ts': "import { invoiceRepository } from '../../contexts/billing/billing.module.js';\nexport const composed = [invoiceRepository];\n",
      },
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: [{ context: 'catalog', relationship: 'published-language' }], deployable: true },
            catalog: { classification: 'supporting', upstreams: [] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'context/extractable',
    name: 'a module that wires another context',
    expect: { file: MODULE },
    also: ['context/published-language-only'],
    files: project({ [MODULE]: "import { catalogModule } from '../catalog/catalog.module.js';\nexport const modules = [catalogModule];\n" }),
  },
  {
    ruleId: 'context/extractable',
    name: 'a repository importing the tables of another context',
    expect: { file: ADAPTER },
    also: ['context/published-language-only'],
    files: project({ [ADAPTER]: "import { products } from '../../../catalog/infrastructure/persistence/product.schema.js';\nexport const joined = products;\n" }),
  },
  {
    ruleId: 'context/extractable',
    name: 'a repository naming the schema of another context',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: "export const products = pgSchema('catalog').table('products', {});\n" }),
  },
  {
    ruleId: 'context/extractable',
    name: 'a handler loading through the repository of another context',
    expect: { file: HANDLER },
    also: ['context/published-language-only'],
    files: project(handler("import type { ProductRepository } from '../../../../catalog/domain/repositories/product.repository.js';\nexport class IssueInvoiceHandler {\n  constructor(private readonly products: ProductRepository) {}\n}\n")),
  },
  {
    ruleId: 'context/extractable',
    name: 'mutable state exported by a module',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: 'export const cache = new Map<string, string>();\nexport let lastInvoiceNumber = 0;\n' }),
  },
  {
    ruleId: 'context/extractable',
    name: 'a deployable context without its entry point',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: ['catalog'], deployable: true },
            catalog: { classification: 'supporting', upstreams: [] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'authz/declared',
    name: 'a permission or a public mark on every registration, a security on every route',
    expect: 'pass',
    files: project({
      [COMMAND]: 'export class IssueInvoiceCommand {}\n',
      [MODULE]: [
        'export function register(builder: Builder): void {',
        '  builder',
        '    .command(IssueInvoiceCommand)',
        "    .requires(billingPermissions['invoice.issue'])",
        '    .handledBy(IssueInvoiceHandler, [CLOCK]);',
        '  builder.query(InvoicesIssuedQuery).public().handledBy(InvoicesIssuedHandler, []);',
        '}',
        '',
      ].join('\n'),
      [ROUTE]: "export const issueInvoiceRoute = defineRoute({ method: 'POST', path: '/invoices', security: ['bearer'] }, issue);\nexport const statusRoute = defineRoute({ method: 'GET', path: '/status', security: false }, status);\n",
    }),
  },
  {
    ruleId: 'authz/declared',
    name: 'wired by hand: every command and query is in the authorization map',
    expect: 'pass',
    files: project(
      {
        [COMMAND]: 'export class IssueInvoiceCommand {}\n',
        [QUERY]: 'export class InvoicesIssuedQuery {}\n',
        [MODULE]: "export const authorization = [\n  requires(IssueInvoiceCommand, billingPermissions['invoice.issue']),\n  publicUseCase(InvoicesIssuedQuery),\n];\n",
      },
      { [CONFIG_FILE]: config({ stack: { di: 'manual' } }) },
    ),
  },
  {
    ruleId: 'authz/declared',
    name: 'a command registered without a permission, next to a declared query',
    expect: { file: MODULE },
    files: project({
      [MODULE]:
        'export function register(builder: Builder): void {\n  builder.command(IssueInvoiceCommand).handledBy(IssueInvoiceHandler, [CLOCK]);\n  builder.query(InvoicesIssuedQuery).public().handledBy(InvoicesIssuedHandler, []);\n}\n',
    }),
  },
  {
    ruleId: 'authz/declared',
    name: 'wired by hand: a command missing from the authorization map',
    expect: { file: COMMAND },
    files: project(
      {
        [COMMAND]: 'export class IssueInvoiceCommand {}\n',
        [QUERY]: 'export class InvoicesIssuedQuery {}\n',
        [MODULE]: 'export const authorization = [publicUseCase(InvoicesIssuedQuery)];\n',
      },
      { [CONFIG_FILE]: config({ stack: { di: 'manual' } }) },
    ),
  },
  {
    ruleId: 'authz/declared',
    name: 'a route that does not declare its security',
    expect: { file: ROUTE },
    files: project({ [ROUTE]: "export const issueInvoiceRoute = defineRoute({ method: 'POST', path: '/invoices' }, issue);\n" }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'a route that builds the actor, a handler asking the access port, an adapter scoped by tenant',
    expect: 'pass',
    files: project({
      [ROUTE]: "import { actorOf } from '@ddd-ts-kit/auth';\nimport type { Actor } from '@ddd-ts-kit/kernel';\nexport const toActor = (principal: unknown): Actor => actorOf(principal);\n",
      ...handler('export class IssueInvoiceHandler {\n  async execute(command: IssueInvoiceCommand): Promise<void> {\n    await this.access.authorize(command.actor, permission, command);\n  }\n}\n'),
      [ADAPTER]: 'export class InMemoryInvoiceRepository {\n  tenant(): string | undefined {\n    return this.actors.require().tenantId;\n  }\n}\n',
    }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'a role test in a route',
    expect: { file: ROUTE },
    files: project({ [ROUTE]: "export const refuse = (context: Context): boolean => !context.principal.roles.includes('admin');\n" }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'an authorizer imported by a route',
    expect: { file: ROUTE },
    files: project({ [ROUTE]: "import type { Authorizer } from '@ddd-ts-kit/auth';\nexport type Decide = Authorizer;\n" }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'an adapter that decides and refuses',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]:
        'export class InMemoryInvoiceRepository {\n  async find(request: Request): Promise<void> {\n    const decision = await this.authorizer.check(request);\n    if (!decision.allowed) throw new ForbiddenError(decision.reason);\n  }\n}\n',
    }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'an aggregate that tests the roles of the actor',
    expect: { file: AGGREGATE },
    files: project(aggregate("import type { Actor } from '@ddd-ts-kit/kernel';\nexport class Invoice {\n  issue(actor: Actor): boolean {\n    return actor.roles.includes('accountant');\n  }\n}\n")),
  },
  {
    ruleId: 'authz/actor-explicit',
    name: 'the actor carried by the command, the ambient actor read by an adapter only',
    expect: 'pass',
    files: project({
      [COMMAND]: "import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';\nexport class IssueInvoiceCommand extends AuthorizedCommand {\n  constructor(actor: Actor) {\n    super(actor);\n  }\n}\n",
      ...handler('export class IssueInvoiceHandler {\n  async execute(command: IssueInvoiceCommand): Promise<string> {\n    return command.actor.id;\n  }\n}\n'),
      [ADAPTER]:
        "import type { ActorContext } from '@ddd-ts-kit/kernel';\nexport class InMemoryInvoiceRepository {\n  constructor(private readonly actors: ActorContext) {}\n\n  tenant(): string | undefined {\n    return this.actors.require().tenantId;\n  }\n}\n",
    }),
  },
  {
    ruleId: 'authz/actor-explicit',
    name: 'a handler reading the current actor',
    expect: { file: HANDLER },
    files: project(
      handler(
        "import type { ActorContext } from '@ddd-ts-kit/kernel';\nexport class IssueInvoiceHandler {\n  constructor(private readonly actors: ActorContext) {}\n\n  async execute(): Promise<string> {\n    return this.actors.require().id;\n  }\n}\n",
      ),
    ),
  },
  {
    ruleId: 'authz/actor-explicit',
    name: 'an aggregate handed the actor context',
    expect: { file: AGGREGATE },
    also: ['authz/in-application'],
    files: project(aggregate("import type { ActorContext } from '@ddd-ts-kit/kernel';\nexport class Invoice {\n  issue(actors: ActorContext): string | undefined {\n    return actors.current()?.id;\n  }\n}\n")),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'suppressions and relaxed settings that point to an existing decision record',
    expect: 'pass',
    files: project(
      {
        ...aggregate(
          "import Decimal from 'decimal.js';\nexport class Invoice {\n  readonly total = new Decimal(0);\n  // ddd-ts-kit-disable-next-line purity/no-system-clock -- ADR-0007: the legacy import stamps invoices itself\n  readonly importedAt = new Date();\n}\n",
        ),
        [ADAPTER]: '/* eslint-disable no-console -- see docs/adr/0007-legacy-import.md */\nexport class InMemoryInvoiceRepository {}\n',
        'docs/adr/0007-legacy-import.md': RECORD,
      },
      {
        [CONFIG_FILE]: config({
          rules: { 'test/builder-required': 'off', 'naming/suffix': 'warn', 'test/no-mocks': 'error' },
          guard: 'advise',
          domainAllowedPackages: ['@ddd-ts-kit/kernel', 'decimal.js'],
          deviations: [
            { what: 'rules.test/builder-required', adr: 'ADR-0007', reason: 'Aggregates of the legacy import are built by the import itself.' },
            { what: 'rules.naming/suffix', adr: '7', reason: 'Legacy files keep their names until the import is retired.' },
            { what: 'guard', adr: '0007', reason: 'The import is written by a tool the hook cannot stop.' },
            { what: 'domainAllowedPackages.decimal.js', adr: 'docs/adr/0007-legacy-import.md', reason: 'Money arithmetic of the legacy import.' },
          ],
        }),
      },
    ),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a suppression with a reason and no decision record still silences its rule',
    expect: { file: AGGREGATE },
    files: project(aggregate("// ddd-ts-kit-disable-next-line layer/domain-purity -- decimal.js is our money arithmetic\nimport Decimal from 'decimal.js';\nexport class Invoice { total = new Decimal(0); }\n")),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a suppression pointing to a record that does not exist',
    expect: { file: AGGREGATE },
    files: project(aggregate("// ddd-ts-kit-disable-next-line layer/domain-purity -- ADR-0099: decimal.js is our money arithmetic\nimport Decimal from 'decimal.js';\nexport class Invoice { total = new Decimal(0); }\n")),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a lint suppression with a reason and no decision record',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: '// eslint-disable-next-line no-console -- startup banner requested by operations\nexport class InMemoryInvoiceRepository {}\n' }),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a rule switched off without a deviation',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ rules: { 'test/spec-required': 'off' }, deviations: [] }) }),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a package, a directory and a guard mode added without a deviation',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          guard: 'advise',
          applicationAllowedPackages: ['@ddd-ts-kit/kernel', 'lodash'],
          contexts: {
            billing: { classification: 'core', upstreams: ['catalog'], extraDirectories: ['infrastructure/messaging'] },
            catalog: { classification: 'supporting', upstreams: [] },
          },
          deviations: [],
        }),
      },
    ),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a deviation without a reason, pointing to a missing record',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ guard: 'advise', deviations: [{ what: 'guard', adr: 'ADR-0042', reason: '' }] }) }),
  },
];

export interface FixtureOutcome {
  readonly fixture: Fixture;
  readonly ok: boolean;
  readonly detail: string;
  readonly violations: readonly Violation[];
}

export function runFixture(fixture: Fixture): FixtureOutcome {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-fixture-'));
  try {
    writeFiles(root, fixture.files);
    return judgeFixture(fixture, runCheck(loadProject(root)).violations);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export function runSelfCheck(): FixtureOutcome[] {
  return FIXTURES.map(runFixture);
}

function contextDoc(classification: string, headings: readonly string[] = CONTEXT_DOC_HEADINGS, glossary = GLOSSARY): string {
  const body = (heading: string): string => (heading === '## Classification' ? classification : heading === '## Ubiquitous language' ? glossary : 'Text.');
  return headings.map((heading) => `${heading}\n\n${body(heading)}\n`).join('\n');
}

function config(overrides: Record<string, unknown> = {}): string {
  const written = {
    contexts: {
      billing: { classification: 'core', upstreams: [{ context: 'catalog', relationship: 'published-language' }] },
      catalog: { classification: 'supporting', upstreams: [] },
    },
    ...overrides,
  };
  return JSON.stringify({ deviations: recordedRelaxations(written), ...written }, null, 2);
}

/** Unless a fixture writes its own `deviations`, the severities, guard mode and directories it changes are recorded. */
function recordedRelaxations(written: Record<string, unknown>): { what: string; adr: string; reason: string }[] {
  const { rules, guard, contexts } = parseConfig(written);
  const relaxed = [
    ...Object.keys(rules).map((id) => `rules.${id}`),
    ...(guard === 'enforce' ? [] : ['guard']),
    ...Object.entries(contexts).flatMap(([name, context]) => context.extraDirectories.map((directory) => `contexts.${name}.extraDirectories.${directory}`)),
  ];
  return relaxed.map((what) => ({ what, adr: '0001', reason: 'Needed by the fixture.' }));
}

/** Two declared contexts, billing downstream of catalog, each with a valid CONTEXT.md. */
function project(files: Files, overrides: Files = {}): Files {
  return {
    [CONFIG_FILE]: config(),
    [FIXTURE_ADR]: RECORD,
    [`${BILLING}/CONTEXT.md`]: contextDoc('core'),
    [`${CATALOG}/CONTEXT.md`]: contextDoc('supporting'),
    ...files,
    ...overrides,
  };
}

function writeFiles(root: string, files: Files): void {
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

function judgeFixture(fixture: Fixture, violations: readonly Violation[]): FixtureOutcome {
  const outcome = (ok: boolean, detail: string): FixtureOutcome => ({ fixture, ok, detail, violations });
  const listed = violations.map((violation) => `${violation.ruleId} at ${violation.file}:${violation.line}`).join('; ');
  if (fixture.expect === 'pass') {
    return violations.length === 0 ? outcome(true, 'no violation') : outcome(false, `expected no violation, got ${listed}`);
  }
  const { file } = fixture.expect;
  const hit = violations.find((violation) => violation.ruleId === fixture.ruleId && violation.file === file);
  if (hit === undefined) return outcome(false, `expected ${fixture.ruleId} at ${file}, got ${listed || 'nothing'}`);
  if (hit.fix.trim() === '') return outcome(false, 'the violation carries no fix');
  const stray = violations.filter((violation) => violation.ruleId !== fixture.ruleId && fixture.also?.includes(violation.ruleId) !== true);
  if (stray.length > 0) return outcome(false, `other rules fired: ${stray.map((violation) => violation.ruleId).join(', ')}`);
  return outcome(true, `${hit.ruleId} at ${hit.file}:${hit.line}`);
}
