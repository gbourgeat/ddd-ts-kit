import { CONFIG_FILE } from '../../config';
import { aggregate } from './aggregate';
import { config } from './config';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';

const { AGGREGATE, BILLING, CATALOG, INTEGRATION_HANDLER, INTEGRATION_HANDLER_SPEC, PUBLISHER } = PATHS;
const STATUS = `${BILLING}/domain/vocabularies/invoice-status.vocabulary.ts`;
const LISTED = `${CATALOG}/published-language/product-listed.v1.payload.ts`;
const ISSUED = `${BILLING}/published-language/invoice-issued.v1.payload.ts`;
const TRANSLATOR = `${BILLING}/infrastructure/anti-corruption/catalog.translator.ts`;
const ERP_TRANSLATOR = `${BILLING}/infrastructure/anti-corruption/legacy-erp.translator.ts`;
const ERP_INVOICE = `${BILLING}/infrastructure/external/legacy-erp-invoice.ts`;
const PORT = `${BILLING}/application/ports/catalog-reader.port.ts`;

const READS_STATUS =
  "import { InvoiceStatus } from '@/contexts/billing/domain/vocabularies/invoice-status.vocabulary.js';";

const READS_LISTED =
  "import type { ProductListedV1Payload } from '@/contexts/catalog/published-language/product-listed.v1.payload.js';";

const READS_ISSUED =
  "import type { InvoiceIssuedV1Payload } from '@/contexts/billing/published-language/invoice-issued.v1.payload.js';";

const READS_ERP = "import type { ErpState } from 'legacy-erp';";

const DECLARED = {
  [STATUS]:
    "export const InvoiceStatus = {\n  Draft: 'draft',\n  Issued: 'issued',\n} as const;\n\nexport type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];\n",
  [LISTED]:
    "export interface ProductListedV1Payload {\n  readonly productId: string;\n  readonly state: 'draft' | 'issued';\n}\n",
  [ISSUED]:
    "export interface InvoiceIssuedV1Payload {\n  readonly invoiceId: string;\n  readonly status: 'draft' | 'issued';\n}\n",
  [INTEGRATION_HANDLER_SPEC]: SAMPLES.SPEC,
};

const lines = (...written: readonly string[]): string => `${written.join('\n')}\n`;

/** A table typed `type` holding `entries`, in a file that reads the status of billing and the payload of catalog. */
const table = (type: string, entries: readonly string[]): string =>
  lines(
    READS_LISTED,
    READS_STATUS,
    '',
    `export const STATUSES: ${type} = {`,
    ...entries.map((entry) => `  ${entry},`),
    '};',
  );

/** A translator class reading `STATUSES` by the field `field` of what it receives, typed `received`. */
const translator = (name: string, received: string, field: string): readonly string[] => [
  `export class ${name} {`,
  `  translate(received: ${received}): InvoiceStatus {`,
  `    return STATUSES[received${field}];`,
  '  }',
  '}',
];

const LISTED_KEYS = ["'draft': InvoiceStatus.Draft", "'issued': InvoiceStatus.Issued"];

const rule = 'language/declared-vocabulary';

export const OTHER_LANGUAGE_FIXTURES: readonly Fixture[] = [
  {
    ruleId: rule,
    name: 'an integration handler keys its table by the published payload, and says by satisfies what a case and a comparison read',
    expect: 'pass',
    files: named({
      [INTEGRATION_HANDLER]: lines(
        READS_LISTED,
        READS_STATUS,
        '',
        "const STATUSES: Record<ProductListedV1Payload['state'], InvoiceStatus> = {",
        ...LISTED_KEYS.map((entry) => `  ${entry},`),
        '};',
        '',
        'export class ProductListedIntegrationHandler {',
        '  statusOf(payload: ProductListedV1Payload): InvoiceStatus {',
        '    switch (payload.state) {',
        "      case 'issued' satisfies ProductListedV1Payload['state']:",
        '        return STATUSES[payload.state];',
        '      default:',
        "        return payload.state === ('draft' satisfies ProductListedV1Payload['state']) ? InvoiceStatus.Draft : InvoiceStatus.Issued;",
        '    }',
        '  }',
        '}',
      ),
    }),
  },
  {
    ruleId: rule,
    name: 'an anti-corruption translator keys its table by the record it declares as it arrives, as const satisfies',
    expect: 'pass',
    files: named({
      [TRANSLATOR]: lines(
        READS_STATUS,
        '',
        'export interface CatalogRecord {',
        "  readonly state: 'draft' | 'issued';",
        '}',
        '',
        'const STATUSES = {',
        ...LISTED_KEYS.map((entry) => `  ${entry},`),
        "} as const satisfies Readonly<Record<CatalogRecord['state'], InvoiceStatus>>;",
        '',
        ...translator('CatalogTranslator', 'CatalogRecord', '.state'),
      ),
    }),
  },
  {
    ruleId: rule,
    name: 'an anti-corruption translator keys its table by a type imported from a package',
    expect: 'pass',
    files: named({
      [ERP_TRANSLATOR]: lines(
        READS_ERP,
        READS_STATUS,
        '',
        'const STATUSES: Readonly<Record<ErpState, InvoiceStatus>> = {',
        ...LISTED_KEYS.map((entry) => `  ${entry},`),
        '};',
        '',
        ...translator('LegacyErpTranslator', 'ErpState', ''),
      ),
    }),
  },
  {
    ruleId: rule,
    name: 'a publisher maps the status to the words of its own published contract',
    expect: 'pass',
    files: named({
      [PUBLISHER]: lines(
        READS_ISSUED,
        READS_STATUS,
        '',
        "const STATUSES: Record<InvoiceStatus, InvoiceIssuedV1Payload['status']> = {",
        "  [InvoiceStatus.Draft]: 'draft',",
        "  [InvoiceStatus.Issued]: 'issued',",
        '};',
        '',
        'export class InvoiceIssuedPublisher {',
        "  statusOf(status: InvoiceStatus): InvoiceIssuedV1Payload['status'] {",
        '    return STATUSES[status];',
        '  }',
        '}',
      ),
    }),
  },
  {
    ruleId: rule,
    name: 'an outside record described as it arrives in infrastructure/external',
    expect: 'pass',
    files: named({
      [ERP_INVOICE]: lines(
        "type LegacyErpState = 'draft' | 'issued';",
        '',
        'export interface LegacyErpInvoice {',
        '  readonly state: LegacyErpState;',
        "  readonly previousState: 'draft' | 'issued';",
        '}',
      ),
    }),
  },
  {
    ruleId: rule,
    name: 'a table keyed by the vocabulary of the context, in an integration handler',
    expect: { file: INTEGRATION_HANDLER },
    files: named({
      [INTEGRATION_HANDLER]: table('Record<InvoiceStatus, string>', ["'draft': 'Draft'", "'issued': 'Issued'"]),
    }),
  },
  {
    ruleId: rule,
    name: 'a value of the context in a table keyed by the published payload',
    expect: { file: INTEGRATION_HANDLER },
    files: named({
      [INTEGRATION_HANDLER]: table("Record<ProductListedV1Payload['state'], InvoiceStatus>", [
        "'draft': 'draft'",
        "'issued': InvoiceStatus.Issued",
      ]),
    }),
  },
  {
    ruleId: rule,
    name: 'a comparison to a word of the payload without satisfies',
    expect: { file: INTEGRATION_HANDLER },
    files: named({
      [INTEGRATION_HANDLER]: lines(
        READS_LISTED,
        '',
        "export const isIssued = (payload: ProductListedV1Payload): boolean => payload.state === 'issued';",
      ),
    }),
  },
  {
    ruleId: rule,
    name: 'a literal that satisfies the vocabulary of the context',
    expect: { file: INTEGRATION_HANDLER },
    files: named({
      [INTEGRATION_HANDLER]: lines(READS_STATUS, '', "export const ISSUED = 'issued' satisfies InvoiceStatus;"),
    }),
  },
  {
    ruleId: rule,
    name: 'a type declared in an integration handler, which is not a place of an outside language',
    expect: { file: INTEGRATION_HANDLER },
    files: named({
      [INTEGRATION_HANDLER]: lines(
        READS_STATUS,
        '',
        "type Remote = 'issued';",
        '',
        "export const STATUSES: Record<Remote, InvoiceStatus> = { 'issued': InvoiceStatus.Issued };",
      ),
    }),
  },
  {
    ruleId: rule,
    name: 'a table keyed by a type of a port of the context',
    expect: { file: INTEGRATION_HANDLER },
    files: named({
      [PORT]: "export type CatalogState = 'draft' | 'issued';\n",
      [INTEGRATION_HANDLER]: lines(
        "import type { CatalogState } from '@/contexts/billing/application/ports/catalog-reader.port.js';",
        READS_STATUS,
        '',
        "export const STATUSES: Record<CatalogState, InvoiceStatus> = { 'issued': InvoiceStatus.Issued };",
      ),
    }),
  },
  {
    ruleId: rule,
    name: 'a literal that satisfies a type of a package, in the model',
    expect: { file: AGGREGATE },
    also: ['layer/domain-purity'],
    files: named(aggregate(lines(READS_ERP, '', "export const ISSUED = 'issued' satisfies ErpState;"))),
  },
  {
    ruleId: rule,
    name: 'a table keyed by a union of the payload and a type of the context',
    expect: { file: INTEGRATION_HANDLER },
    files: named({
      [INTEGRATION_HANDLER]: table(
        "Record<ProductListedV1Payload['state'] | InvoiceStatus, InvoiceStatus>",
        LISTED_KEYS,
      ),
    }),
  },
];

/** A project that names its literals, billing reading the payload of catalog. */
function named(files: FixtureFiles): FixtureFiles {
  return project({ ...DECLARED, ...files }, { [CONFIG_FILE]: config({ stack: { literals: 'named' } }) });
}
