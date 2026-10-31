import { aggregate } from './aggregate';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';

const { BILLING, REPOSITORY_PORT } = PATHS;

const BARREL = `${BILLING}/domain/aggregates/index.ts`;
const JAVASCRIPT = `${BILLING}/domain/aggregates/invoice-total.js`;

/** A role folder holds its role files and nothing else. */
export const ROLE_FOLDER_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'naming/suffix',
    name: 'a barrel in a role folder, even through the alias',
    expect: { file: BARREL },
    files: project({
      ...aggregate('export class Invoice {}\n'),
      [BARREL]: "export * from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';\n",
    }),
  },
  {
    ruleId: 'tree/closed',
    name: 'a JavaScript file in a role folder',
    expect: { file: JAVASCRIPT },
    files: project({ ...aggregate('export class Invoice {}\n'), [JAVASCRIPT]: 'export const total = 1;\n' }),
  },
  {
    ruleId: 'ports/abstract-class',
    name: 'a repository port written as a type, with no class',
    expect: { file: REPOSITORY_PORT },
    files: project({ [REPOSITORY_PORT]: 'export type InvoiceRepository = { save(): Promise<void> };\n' }),
  },
];
