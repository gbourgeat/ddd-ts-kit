import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { source } from './source';

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
const SHARED_SLOT = `${BILLING}/presentation/http/shared/slot.schema.ts`;
const ISSUE_BODY = `${HTTP}/issue-invoice/issue-invoice.body.ts`;
const CATALOG_ACCEPTED = `${PATHS.CATALOG}/presentation/http/products/list-product/list-product.accepted.ts`;
const ISSUE_LINE = `${HTTP}/search-invoices/search-invoices.line.ts`;
const VOID_LINE = `${HTTP}/search-voided-invoices/search-voided-invoices.line.ts`;

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

/** A line as `generate query --search` writes it: an identifier and the mark of what is left to declare. */
const generatedLine = (name: string): string =>
  source(
    "import { IsString } from 'class-validator';",
    '',
    `export class ${name} {`,
    '  @IsString()',
    "  id = '';",
    '',
    '  // TODO(domain): declare the fields that are part of the public contract.',
    '}',
  );

const GENERATED_ZOD_LINE = 'z.object({\n  id: z.string(),\n  // TODO(domain): declare the public fields.\n})';

const REVIEWED_ZOD_LINE =
  'z.object({\n  id: z.string(),\n  // TODO(review): share this line with the other search once both are filled.\n})';

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
    name: 'two contexts declaring the same shape, each in its own words',
    expect: 'pass',
    files: project(
      { [ISSUE_ACCEPTED]: dto('IssueInvoiceAccepted', 'id'), [CATALOG_ACCEPTED]: dto('ListProductAccepted', 'id') },
      SHARED,
    ),
  },
  {
    ruleId: 'schema/no-duplicate-shape',
    name: 'a context copying a shape of presentation/ of the shared kernel',
    expect: { file: CATALOG_ACCEPTED },
    files: project({ [MONEY_SCHEMA]: money('Money'), [CATALOG_ACCEPTED]: money('ListProductAccepted') }, SHARED),
  },
  {
    ruleId: 'schema/no-duplicate-shape',
    name: 'a route copying a shape its context shares, though its path sorts first',
    expect: { file: ISSUE_BODY },
    files: project({ [SHARED_SLOT]: money('Slot'), [ISSUE_BODY]: money('IssueInvoiceBody') }, SHARED),
  },
  {
    ruleId: 'schema/no-duplicate-shape',
    name: 'two search lines the generator left to fill',
    expect: 'pass',
    files: project(
      { [ISSUE_LINE]: generatedLine('SearchInvoicesLine'), [VOID_LINE]: generatedLine('SearchVoidedInvoicesLine') },
      SHARED,
    ),
  },
  {
    ruleId: 'schema/no-duplicate-shape',
    name: 'two zod search lines the generator left to fill',
    expect: 'pass',
    files: project(
      {
        [AMEND_CONTROLLER]: controller(GENERATED_ZOD_LINE),
        [ISSUE_CONTROLLER]: controller(GENERATED_ZOD_LINE),
      },
      SHARED,
    ),
  },
  {
    ruleId: 'schema/no-duplicate-shape',
    name: 'two zod shapes a review left a TODO(review) in',
    expect: 'pass',
    files: project(
      {
        [AMEND_CONTROLLER]: controller(REVIEWED_ZOD_LINE),
        [ISSUE_CONTROLLER]: controller(REVIEWED_ZOD_LINE),
      },
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
