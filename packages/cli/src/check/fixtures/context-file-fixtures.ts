import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { source } from './source';

const { BILLING } = PATHS;

const CODES = source("export const BillingCodes = { InvoiceVoid: 'INVOICE_VOID' } as const;");

const PERMISSIONS = source(
  "import { definePermissions } from '@ddd-ts-kit/auth';",
  '',
  "export const billingPermissions = definePermissions('billing', {",
  "  'invoice.issue': { description: 'Issue invoice' },",
  '});',
);

/** The code list and the permission set of a context: at its root, and where 0.86 and 0.87 kept them, an error. */
export const CONTEXT_FILE_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'tree/closed',
    name: 'the code list and the permission set at the root of their context',
    expect: 'pass',
    files: project({ [`${BILLING}/billing.codes.ts`]: CODES, [`${BILLING}/billing.permissions.ts`]: PERMISSIONS }),
  },
  {
    ruleId: 'tree/closed',
    name: 'the code list where 0.86 and 0.87 kept it: an error, which context-layout moves',
    expect: { file: `${BILLING}/domain/errors/codes.ts` },
    files: project({ [`${BILLING}/domain/errors/codes.ts`]: CODES }),
  },
  {
    ruleId: 'tree/closed',
    name: 'the permission set where 0.86 and 0.87 kept it: an error, which context-layout moves',
    expect: { file: `${BILLING}/application/authorization/billing.permissions.ts` },
    files: project({ [`${BILLING}/application/authorization/billing.permissions.ts`]: PERMISSIONS }),
  },
  {
    ruleId: 'tree/closed',
    name: 'the code list at the root and where 0.86 and 0.87 kept it: one of each',
    expect: { file: `${BILLING}/domain/errors/codes.ts` },
    files: project({ [`${BILLING}/billing.codes.ts`]: CODES, [`${BILLING}/domain/errors/codes.ts`]: CODES }),
  },
];
