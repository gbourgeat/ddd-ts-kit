import { aggregate } from './aggregate.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';

const { AGGREGATE, AGGREGATE_SPEC, BILLING, PUBLISHED } = PATHS;
const STATUS = `${BILLING}/domain/vocabularies/invoice-status.vocabulary.ts`;
const PERMISSIONS = `${BILLING}/application/authorization/billing.permissions.ts`;
const GRANTS = 'src/platform/auth/roles.ts';

const DECLARED = {
  [STATUS]:
    "export const InvoiceStatus = {\n  Draft: 'draft',\n  Issued: 'issued',\n} as const;\n\nexport type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];\n",
  [PERMISSIONS]:
    "import { definePermissions } from '@ddd-ts-kit/auth';\n\nexport const billingPermissions = definePermissions('billing', {\n  'invoice.issue': { description: 'Issue an invoice' },\n});\n",
};

const invoice = (status: string): string =>
  `import { InvoiceStatus } from '@/contexts/billing/domain/vocabularies/invoice-status.vocabulary.js';\n\nexport class Invoice {\n  constructor(private readonly status: InvoiceStatus) {}\n\n  isIssued(): boolean {\n    return this.status === ${status};\n  }\n}\n`;

export const VOCABULARY_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'language/declared-vocabulary',
    name: 'values read through their vocabulary; a test and a published language that spell one',
    expect: 'pass',
    files: project({
      ...DECLARED,
      ...aggregate(invoice('InvoiceStatus.Issued')),
      [AGGREGATE_SPEC]: "import { it } from 'vitest';\n\nit('reads issued', () => 'issued');\n",
      [PUBLISHED]: "export const contract = { status: 'issued' as string, issued: true };\n",
      [GRANTS]:
        "import { billingPermissions } from '@/contexts/billing/application/authorization/billing.permissions.js';\n\nexport const grants = { [billingPermissions['invoice.issue'].id]: [billingPermissions['invoice.issue']] };\n",
    }),
  },
  {
    ruleId: 'language/declared-vocabulary',
    name: 'a value of a vocabulary written as a string',
    expect: { file: AGGREGATE },
    files: project({ ...DECLARED, ...aggregate(invoice("'issued'")) }),
  },
  {
    ruleId: 'language/declared-vocabulary',
    name: 'a permission given by its id where its permission set declares it',
    expect: { file: GRANTS },
    files: project({ ...DECLARED, [GRANTS]: "export const grants = ['billing:invoice.issue'];\n" }),
  },
  {
    ruleId: 'language/declared-vocabulary',
    name: 'a value of a vocabulary spelled as a quoted key',
    expect: { file: AGGREGATE },
    files: project({ ...DECLARED, ...aggregate("export const labels = { 'issued': 'Issued' };\n") }),
  },
  {
    ruleId: 'language/declared-vocabulary',
    name: 'an object as const without the union type of its name declares no vocabulary',
    expect: 'pass',
    files: project({
      [STATUS]: "export const InvoiceStatus = {\n  Issued: 'issued',\n} as const;\n",
      ...aggregate("export class Invoice {\n  readonly status = 'issued';\n}\n"),
    }),
  },
];
