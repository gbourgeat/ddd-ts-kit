import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tseslint from 'typescript-eslint';
import { afterAll, describe, expect, it } from 'vitest';
import { parseConfig } from '../../src/project/parse-config.js';
import { languageDeclaredVocabulary } from '../../src/rules/language-declared-vocabulary.js';
import { projectVocabularies } from '../../src/support/vocabularies/project-vocabularies.js';
import { BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-vocabulary-'));
const STATUS = `${BILLING}/domain/vocabularies/invoice-status.vocabulary.ts`;
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const GRANTS = 'src/platform/auth/roles/roles.ts';
const ROUTES = `${BILLING}/presentation/http/billing.routes.ts`;
const SERVICE = `${BILLING}/domain/services/pricing.service.ts`;
const CATALOG = 'src/contexts/catalog/domain/services/listing.service.ts';
const SCHEMA = `${BILLING}/infrastructure/persistence/billing.schema.ts`;
const REPOSITORY = `${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`;
const NAMED = { ...SAMPLE_CONFIG, stack: { literals: 'named' } };

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function onDisk(file: string, code: string): void {
  fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), code);
}

onDisk(
  STATUS,
  "export const InvoiceStatus = {\n  Draft: 'draft',\n  Issued: 'issued',\n} as const;\n\nexport type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];\n",
);

onDisk(
  `${BILLING}/application/authorization/billing.permissions.ts`,
  "export const billingPermissions = definePermissions('billing', {\n  'invoice.issue': { description: 'Issue an invoice' },\n  'invoice.void': { description: 'Void it' },\n});\n",
);

onDisk(
  `${BILLING}/domain/vocabularies/settlement.vocabulary.ts`,
  "export const Settlement = { Draft: 'draft' } as const;\nexport type Settlement = (typeof Settlement)[keyof typeof Settlement];\n",
);

onDisk(
  'src/platform/auth/authorization/role.ts',
  '/** The roles. */\nexport const Role = {\n  /** Everything. */\n  Admin: "admin",\n  // A job.\n  System: \'system\',\n} as const satisfies Record<string, string>;\n\nexport type Role = (typeof Role)[keyof typeof Role];\n',
);

onDisk(
  'src/shared-kernel/currency.vocabulary.ts',
  "export const Currency = { Euro: 'EUR', 'pound-sterling': 'GBP, sterling' } as const;\nexport type Currency = (typeof Currency)[keyof typeof Currency];\n",
);

onDisk(
  `${BILLING}/domain/vocabularies/level.vocabulary.ts`,
  "export const Level = { Low: 1, High: 'high' } as const;\nexport type Level = (typeof Level)[keyof typeof Level];\n",
);

onDisk(`${BILLING}/domain/vocabularies/loose.ts`, "export const Loose = { Paid: 'paid' } as const;\n");

onDisk(
  `${BILLING}/test/unit/declared-in-a-test.ts`,
  "export const Probe = { Late: 'late' } as const;\nexport type Probe = (typeof Probe)[keyof typeof Probe];\n",
);

const inProject = (
  file: string,
  code: string,
  config: Record<string, unknown> = NAMED,
): { code: string; settings: Record<string, unknown> } => ({
  code,
  settings: { 'ddd-ts-kit': { config, filename: file, rootDir: root } },
});

ruleTester.run('language-declared-vocabulary', languageDeclaredVocabulary, {
  valid: [
    inProject(AGGREGATE, 'export const isIssued = (status: InvoiceStatus) => status === InvoiceStatus.Issued;'),
    inProject(
      AGGREGATE,
      "const labels = { issued: 'Issued', [InvoiceStatus.Draft]: 'Draft' };\ninterface Row { issued: boolean }",
    ),
    inProject(AGGREGATE, "import { x } from 'issued';\nexport { y } from 'draft';"),
    inProject(AGGREGATE, "const paid = 'paid';\nconst late = 'late';\nconst grant = `invoice.issue`;"),
    inProject(STATUS, "export const again = 'issued';"),
    inProject(`${BILLING}/test/unit/invoice.aggregate.spec.ts`, "it('issues', () => expect(status).toBe('issued'));"),
    inProject(`${BILLING}/published-language/invoice-issued.v1.payload.ts`, "export const status = 'issued';"),
    inProject(GRANTS, "export const grants = [billingPermissions['invoice.issue'], `billing:${name}`];"),
    inProject(AGGREGATE, "export const isIssued = (status: string) => status === 'issued';", SAMPLE_CONFIG),
    inProject(SERVICE, "export const issuer = 'admin';\nexport const kind = 'system';"),
    inProject(CATALOG, "export const listed = 'issued';\nexport const level = 'high';"),
    inProject(
      SCHEMA,
      "export const invoices = billingSchema.table('issued', {\n  draft: text('draft'),\n  entity: { name: 'draft', tableName: 'issued', schema: 'draft' },\n});",
    ),
    inProject(
      REPOSITORY,
      "export const find = (knex: Knex) => knex('invoices').where('draft', status).select('issued');",
    ),
  ],
  invalid: [
    {
      ...inProject(GRANTS, "export const grants = { admin: ['*'] };\nexport const issuer = 'admin';"),
      errors: [
        {
          messageId: 'raw',
          data: {
            value: 'admin',
            vocabularies: 'Role (src/platform/auth/authorization/role.ts)',
            written: 'Role.Admin',
          },
        },
      ],
    },
    { ...inProject(ROUTES, "export const guard = { role: 'admin' };"), errors: [{ messageId: 'raw' }] },
    {
      ...inProject(SCHEMA, "export const invoices = { status: text('status').default('draft') };"),
      errors: [{ messageId: 'raw' }],
    },
    {
      ...inProject(REPOSITORY, "export const find = (knex: Knex) => knex('invoices').where('status', 'issued');"),
      errors: [{ messageId: 'raw' }],
    },
    {
      ...inProject(CATALOG, "export const priced = 'EUR';\nexport const legacy = 'GBP, sterling';"),
      errors: [
        {
          messageId: 'raw',
          data: {
            value: 'EUR',
            vocabularies: 'Currency (src/shared-kernel/currency.vocabulary.ts)',
            written: 'Currency.Euro',
          },
        },
        {
          messageId: 'raw',
          data: {
            value: 'GBP, sterling',
            vocabularies: 'Currency (src/shared-kernel/currency.vocabulary.ts)',
            written: "Currency['pound-sterling']",
          },
        },
      ],
    },
    { ...inProject(GRANTS, "export const priced = 'EUR';"), errors: [{ messageId: 'raw' }] },
    {
      ...inProject(AGGREGATE, "export const isIssued = (status: string) => status === 'issued';"),
      errors: [
        {
          messageId: 'raw',
          data: { value: 'issued', vocabularies: `InvoiceStatus (${STATUS})`, written: 'InvoiceStatus.Issued' },
        },
      ],
    },
    {
      ...inProject(AGGREGATE, "type Shown = 'draft' | 'issued';\nconst shown = `issued`;"),
      errors: [
        {
          messageId: 'raw',
          data: {
            value: 'draft',
            vocabularies: `InvoiceStatus (${STATUS}) and of Settlement (${BILLING}/domain/vocabularies/settlement.vocabulary.ts)`,
            written: 'InvoiceStatus.Draft or Settlement.Draft',
          },
        },
        { messageId: 'raw' },
        { messageId: 'raw' },
      ],
    },
    {
      ...inProject(
        AGGREGATE,
        "const labels = { 'draft': 'Draft' };\ninterface Row { 'issued': boolean }\nenum Kind { 'issued' = 1 }",
      ),
      errors: [{ messageId: 'raw' }, { messageId: 'raw' }, { messageId: 'raw' }],
    },
    {
      ...inProject(GRANTS, "export const grants = { admin: ['billing:invoice.void'], [`billing:invoice.issue`]: [] };"),
      errors: [{ messageId: 'raw' }, { messageId: 'raw' }],
    },
  ],
});

describe('the vocabularies of a project', () => {
  it('are read again once their reading is older than a few seconds', () => {
    const project = { root, config: parseConfig(NAMED) };
    const first = projectVocabularies(project, tseslint.parser, 1);

    onDisk(
      `${BILLING}/domain/vocabularies/channel.vocabulary.ts`,
      "export const Channel = { Mail: 'mail' } as const;\nexport type Channel = (typeof Channel)[keyof typeof Channel];\n",
    );

    expect(projectVocabularies(project, tseslint.parser, 2)).toBe(first);

    expect(projectVocabularies(project, tseslint.parser, 10_000).get('mail')).toEqual([
      expect.objectContaining({ written: 'Channel.Mail' }),
    ]);
  });
});

describe('a project read without a parser', () => {
  it('declares nothing', () => {
    expect(projectVocabularies({ root: `${root}-none`, config: parseConfig(NAMED) }, undefined, 1).size).toBe(0);
  });
});
