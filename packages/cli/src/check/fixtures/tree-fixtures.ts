import { CONFIG_FILE } from '../../config/index.js';
import { CONTEXT_DOC_HEADINGS } from '../canonical/context-doc-headings.js';
import { aggregate } from './aggregate.js';
import { config } from './config.js';
import { contextDoc } from './context-doc.js';
import { DECLARED } from './declared.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { handler } from './handler.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { AGGREGATE, BARREL, BILLING, JOB, JOB_SPEC, MODULE, POLICY, ROUTES } = PATHS;
const { SPEC } = SAMPLES;

export const TREE_FIXTURES: readonly Fixture[] = [
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
    files: project({ [`${BILLING}/domain/utils/rounding.ts`]: 'export const rounding = 1;\n' }),
  },
  {
    ruleId: 'tree/closed',
    name: 'a source file outside a role directory',
    expect: { file: `${BILLING}/domain/rounding.ts` },
    files: project({ [`${BILLING}/domain/rounding.ts`]: 'export const rounding = 1;\n' }),
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
      const { [`${BILLING}/CONTEXT.md`]: _removed, ...rest } = project({
        [`${BILLING}/published-language/index.ts`]: 'export {};\n',
      });

      return rest;
    })(),
  },
  {
    ruleId: 'tree/context-doc',
    name: 'a missing section',
    expect: { file: `${BILLING}/CONTEXT.md` },
    files: project(
      {},
      {
        [`${BILLING}/CONTEXT.md`]: contextDoc(
          'core',
          CONTEXT_DOC_HEADINGS.filter((heading) => heading !== '## Relationships'),
        ),
      },
    ),
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
      [`${BILLING}/domain/errors/invoice-already-issued.error.ts`]:
        'export class InvoiceAlreadyIssuedError extends Error {}\n',
      [`${BILLING}/domain/errors/index.ts`]:
        "export * from '@/contexts/billing/domain/errors/invoice-already-issued.error.js';\n",
      [`${BILLING}/presentation/http/invoice.dto.ts`]: 'export interface InvoiceDto { readonly id: string }\n',
    }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'a file without the suffix of its role',
    expect: { file: `${BILLING}/domain/errors/invoice-already-issued.ts` },
    files: project({
      [`${BILLING}/domain/errors/invoice-already-issued.ts`]: 'export class InvoiceAlreadyIssued extends Error {}\n',
    }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'a file name that is not kebab-case',
    expect: { file: `${BILLING}/domain/errors/InvoiceAlreadyIssued.error.ts` },
    also: ['clean/one-export-per-file'],
    files: project({
      [`${BILLING}/domain/errors/InvoiceAlreadyIssued.error.ts`]:
        'export class InvoiceAlreadyIssuedError extends Error {}\n',
    }),
  },
  {
    ruleId: 'naming/one-concept-per-file',
    name: 'one exported class, with private helpers and types',
    expect: 'pass',
    files: project(
      aggregate(
        'class Money {}\n\nexport interface InvoiceState {\n  readonly total: Money;\n}\n\nexport class Invoice {\n  constructor(readonly state: InvoiceState) {}\n}\n// export class Ghost {}\n',
      ),
      { [CONFIG_FILE]: config({ rules: { 'clean/no-commented-out-code': { severity: 'off', files: [AGGREGATE] } } }) },
    ),
  },
  {
    ruleId: 'naming/one-concept-per-file',
    name: 'two exported classes in an aggregate file',
    expect: { file: AGGREGATE },
    also: ['clean/one-export-per-file'],
    files: project(aggregate('export class Invoice {}\nexport class IssuedInvoice {}\n')),
  },
  {
    ruleId: 'naming/suffix',
    name: 'a builder without its suffix',
    expect: { file: `${BILLING}/test/builders/invoice.ts` },
    files: project({ [`${BILLING}/test/builders/invoice.ts`]: 'export const anInvoice = 1;\n' }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'declared style: the routes file named after the context, a result next to its command, a job',
    expect: 'pass',
    files: declaredProject({
      [ROUTES]: 'export const billingRoutes = (): unknown[] => [];\n',
      [`${BILLING}/application/commands/issue-invoice/issue-invoice.result.ts`]:
        'export interface IssueInvoiceResult {\n  readonly invoiceId: string;\n}\n',
      [JOB]: DECLARED.job,
      [JOB_SPEC]: SPEC,
    }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'explicit style: a routes file named after the context',
    expect: 'pass',
    files: project({ [ROUTES]: 'export const billingRoutes = (): unknown[] => [];\n' }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'a controller in its folder with its schemas, mapper and serializer, behind a route group and a guard',
    expect: 'pass',
    files: project({
      [`${BILLING}/presentation/http/invoices.routes.ts`]: 'export class InvoicesRoutes {}\n',
      [`${BILLING}/presentation/http/guards/office-hours.guard.ts`]: 'export class OfficeHoursGuard {}\n',
      [`${BILLING}/presentation/http/shared/money.ts`]: 'export class Money {}\n',
      ...Object.fromEntries(
        ['controller', 'params', 'query', 'body', 'accepted', 'mapper', 'serializer'].map((role) => [
          `${BILLING}/presentation/http/invoices/issue-invoice/issue-invoice.${role}.ts`,
          `export class IssueInvoice${role.charAt(0).toUpperCase()}${role.slice(1)} {}\n`,
        ]),
      ),
    }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'a file of another role in the folder of a controller',
    expect: { file: `${BILLING}/presentation/http/invoices/issue-invoice/issue-invoice.dto.ts` },
    files: project({
      [`${BILLING}/presentation/http/invoices/issue-invoice/issue-invoice.dto.ts`]: 'export class IssueInvoiceDto {}\n',
    }),
  },
  {
    ruleId: 'tree/closed',
    name: 'a file left in the folder of a resource, outside the folder of a controller',
    expect: { file: `${BILLING}/presentation/http/invoices/issue-invoice.controller.ts` },
    files: project({
      [`${BILLING}/presentation/http/invoices/issue-invoice.controller.ts`]: 'export class IssueInvoiceController {}\n',
    }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'a job without its suffix',
    expect: { file: `${BILLING}/application/scheduling/send-reminders.ts` },
    files: project({ [`${BILLING}/application/scheduling/send-reminders.ts`]: 'export class SendReminders {}\n' }),
  },
  {
    ruleId: 'test/spec-required',
    name: 'a job without a spec',
    expect: { file: JOB },
    files: declaredProject({ [JOB]: DECLARED.job }),
  },
  {
    ruleId: 'tree/closed',
    name: 'declared style: the generated barrel at the root of a context, next to a module file kept on purpose',
    expect: 'pass',
    files: declaredProject({ [MODULE]: 'export const billingModule = {};\n' }),
  },
  {
    ruleId: 'tree/closed',
    name: 'explicit style: a barrel of declarations at the root of a context',
    expect: { file: BARREL },
    files: project({ [BARREL]: 'export {};\n' }),
  },
  {
    ruleId: 'naming/one-concept-per-file',
    name: 'declared style: two declared classes in one role file',
    expect: { file: POLICY },
    also: ['clean/one-export-per-file'],
    files: declaredProject({
      [POLICY]: `${DECLARED.policy}\n@Policy(billingPermissions['invoice.issue'], { name: 'billing.only-accountant-issues' })\nexport class OnlyAccountantIssuesPolicy {}\n`,
    }),
  },
  {
    ruleId: 'naming/one-concept-per-file',
    name: 'explicit style: a second declared class in a policy file is not counted',
    expect: 'pass',
    files: project({
      [POLICY]: `${DECLARED.policy}\n@Policy(billingPermissions['invoice.issue'], { name: 'billing.only-accountant-issues' })\nclass OnlyAccountantIssuesPolicy {}\n`,
    }),
  },
];
