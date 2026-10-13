import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { source } from './source.js';

const { BILLING } = PATHS;
const HTTP = `${BILLING}/presentation/http/invoices`;
const SHARED = { [CONFIG_FILE]: config({ stack: { schemas: 'shared' } }) };
const MONEY_SCHEMA = 'src/shared-kernel/presentation/money.schema.ts';
const LOOSE_MONEY = 'src/shared-kernel/money.ts';
const MAPPER = `${HTTP}/issue-invoice/issue-invoice.mapper.ts`;
const ISSUE_ACCEPTED = `${HTTP}/issue-invoice/issue-invoice.accepted.ts`;
const VOID_ACCEPTED = `${HTTP}/void-invoice/void-invoice.accepted.ts`;
const ISSUE_PARAMS = `${HTTP}/issue-invoice/issue-invoice.params.ts`;
const VOID_PARAMS = `${HTTP}/void-invoice/void-invoice.params.ts`;
const ISSUE_CONTROLLER = `${HTTP}/issue-invoice/issue-invoice.controller.ts`;
const AMEND_CONTROLLER = `${HTTP}/amend-invoice/amend-invoice.controller.ts`;

const money = (name: string): string =>
  source(
    "import { IsInt, IsString } from 'class-validator';",
    '',
    `export class ${name} {`,
    '  @IsInt()',
    '  cents = 0;',
    '',
    '  @IsString()',
    "  currency = '';",
    '}',
  );

const dto = (name: string, property: string): string =>
  source(
    "import { IsString } from 'class-validator';",
    '',
    `export class ${name} {`,
    '  @IsString()',
    `  ${property} = '';`,
    '}',
  );

const MAPPING = source(
  "import type { Money } from '@/shared-kernel/presentation/money.schema.js';",
  '',
  'export class IssueInvoiceMapper {',
  '  amountOf(money: Money): number {',
  '    return money.cents;',
  '  }',
  '}',
);

const COMMAND_READING_A_SCHEMA = source(
  "import type { Money } from '@/shared-kernel/presentation/money.schema.js';",
  '',
  'export class IssueInvoiceCommand {',
  '  constructor(readonly amount: Money) {}',
  '}',
);

const controller = (body: string): string =>
  source(
    "import { z } from 'zod';",
    "import { zodSchema } from '@ddd-ts-kit/validation/zod';",
    '',
    `export const body = zodSchema(${body});`,
  );

const PRESENTATION_ONLY: readonly Fixture[] = [
  {
    ruleId: 'schema/presentation-only',
    name: 'a schema shared by the contexts under presentation/ of the shared kernel, read by a presentation layer',
    expect: 'pass',
    files: project({ [MONEY_SCHEMA]: money('Money'), [MAPPER]: MAPPING }, SHARED),
  },
  {
    ruleId: 'schema/presentation-only',
    name: 'a schema declared in the shared kernel outside presentation/',
    expect: { file: LOOSE_MONEY },
    files: project({ [LOOSE_MONEY]: money('Money') }, SHARED),
  },
  {
    ruleId: 'schema/presentation-only',
    name: 'a command that carries a schema of presentation/ of the shared kernel',
    expect: { file: PATHS.COMMAND },
    files: project({ [MONEY_SCHEMA]: money('Money'), [PATHS.COMMAND]: COMMAND_READING_A_SCHEMA }, SHARED),
  },
  {
    ruleId: 'schema/presentation-only',
    name: 'a project that does not say how it writes its schemas is not judged',
    expect: 'pass',
    files: project({ [LOOSE_MONEY]: money('Money') }),
  },
];

const NO_DUPLICATE_SHAPE: readonly Fixture[] = [
  {
    ruleId: 'schema/no-duplicate-shape',
    name: 'two answers of different shapes',
    expect: 'pass',
    files: project(
      { [ISSUE_ACCEPTED]: dto('IssueInvoiceAccepted', 'id'), [VOID_ACCEPTED]: dto('VoidInvoiceAccepted', 'reference') },
      SHARED,
    ),
  },
  {
    ruleId: 'schema/no-duplicate-shape',
    name: 'two DTO classes declaring the same properties with the same constraints',
    expect: { file: VOID_ACCEPTED },
    files: project(
      { [ISSUE_ACCEPTED]: dto('IssueInvoiceAccepted', 'id'), [VOID_ACCEPTED]: dto('VoidInvoiceAccepted', 'id') },
      SHARED,
    ),
  },
  {
    ruleId: 'schema/no-duplicate-shape',
    name: 'two zod bodies declaring the same entries in another order and layout',
    expect: { file: ISSUE_CONTROLLER },
    files: project(
      {
        [AMEND_CONTROLLER]: controller('z.object({ cents: z.number().int(), currency: z.string().length(3) })'),
        [ISSUE_CONTROLLER]: controller('z.object({\n  currency: z.string().length(3),\n  cents: z.number().int(),\n})'),
      },
      SHARED,
    ),
  },
  {
    ruleId: 'schema/no-duplicate-shape',
    name: 'two routes reading the same path parameter',
    expect: 'pass',
    files: project(
      { [ISSUE_PARAMS]: dto('IssueInvoiceParams', 'invoiceId'), [VOID_PARAMS]: dto('VoidInvoiceParams', 'invoiceId') },
      SHARED,
    ),
  },
  {
    ruleId: 'schema/no-duplicate-shape',
    name: 'a project that does not say how it writes its schemas is not judged',
    expect: 'pass',
    files: project({
      [ISSUE_ACCEPTED]: dto('IssueInvoiceAccepted', 'id'),
      [VOID_ACCEPTED]: dto('VoidInvoiceAccepted', 'id'),
    }),
  },
];

export const SCHEMA_FIXTURES: readonly Fixture[] = [...PRESENTATION_ONLY, ...NO_DUPLICATE_SHAPE];
