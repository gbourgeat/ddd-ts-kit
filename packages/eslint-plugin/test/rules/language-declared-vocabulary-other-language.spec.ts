import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
import { languageDeclaredVocabulary } from '../../src/rules/language-declared-vocabulary';
import { BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester';

// The cases of the checker's fixtures `other-language-fixtures.ts`, by the same names.

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-other-language-'));
const STATUS = `${BILLING}/domain/vocabularies/invoice-status.vocabulary.ts`;
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const HANDLER = `${BILLING}/application/integration/handlers/product-listed.integration-handler.ts`;
const PUBLISHER = `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`;
const TRANSLATOR = `${BILLING}/infrastructure/anti-corruption/catalog.translator.ts`;
const ERP_TRANSLATOR = `${BILLING}/infrastructure/anti-corruption/legacy-erp.translator.ts`;
const ERP_INVOICE = `${BILLING}/infrastructure/external/legacy-erp-invoice.ts`;
const NAMED = { ...SAMPLE_CONFIG, stack: { literals: 'named' } };

const READS_STATUS =
  "import { InvoiceStatus } from '@/contexts/billing/domain/vocabularies/invoice-status.vocabulary.js';";

const READS_LISTED =
  "import type { ProductListedV1Payload } from '@/contexts/catalog/published-language/product-listed.v1.payload.js';";

const READS_ISSUED =
  "import type { InvoiceIssuedV1Payload } from '@/contexts/billing/published-language/invoice-issued.v1.payload.js';";

const READS_ERP = "import type { ErpState } from 'legacy-erp';";
const LISTED_KEYS = ["'draft': InvoiceStatus.Draft", "'issued': InvoiceStatus.Issued"];

fs.mkdirSync(path.join(root, path.dirname(STATUS)), { recursive: true });

fs.writeFileSync(
  path.join(root, STATUS),
  "export const InvoiceStatus = {\n  Draft: 'draft',\n  Issued: 'issued',\n} as const;\n\nexport type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];\n",
);

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const lines = (...written: readonly string[]): string => `${written.join('\n')}\n`;

const table = (type: string, entries: readonly string[]): string =>
  lines(
    READS_LISTED,
    READS_STATUS,
    '',
    `export const STATUSES: ${type} = {`,
    ...entries.map((entry) => `  ${entry},`),
    '};',
  );

const translator = (name: string, received: string, field: string): readonly string[] => [
  `export class ${name} {`,
  `  translate(received: ${received}): InvoiceStatus {`,
  `    return STATUSES[received${field}];`,
  '  }',
  '}',
];

const inProject = (
  name: string,
  file: string,
  code: string,
): { name: string; code: string; settings: Record<string, unknown> } => ({
  name,
  code,
  settings: { 'ddd-ts-kit': { config: NAMED, filename: file, rootDir: root } },
});

const OF_STATUS = `InvoiceStatus (${STATUS})`;

/** The data of a report in a file that reads the payload of catalog. */
const besideListed = (value: string, written: string): Record<string, string> => ({
  value,
  vocabularies: OF_STATUS,
  written,
  other: 'ProductListedV1Payload of catalog/published-language',
  vocabulary: 'InvoiceStatus',
});

ruleTester.run('language-declared-vocabulary', languageDeclaredVocabulary, {
  valid: [
    inProject(
      'an integration handler keys its table by the published payload, and says by satisfies what a case and a comparison read',
      HANDLER,
      lines(
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
    ),
    inProject(
      'an anti-corruption translator keys its table by the record it declares as it arrives, as const satisfies',
      TRANSLATOR,
      lines(
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
    ),
    inProject(
      'an anti-corruption translator keys its table by a type imported from a package',
      ERP_TRANSLATOR,
      lines(
        READS_ERP,
        READS_STATUS,
        '',
        'const STATUSES: Readonly<Record<ErpState, InvoiceStatus>> = {',
        ...LISTED_KEYS.map((entry) => `  ${entry},`),
        '};',
        '',
        ...translator('LegacyErpTranslator', 'ErpState', ''),
      ),
    ),
    inProject(
      'a publisher maps the status to the words of its own published contract',
      PUBLISHER,
      lines(
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
    ),
    inProject(
      'an outside record described as it arrives in infrastructure/external',
      ERP_INVOICE,
      lines(
        "type LegacyErpState = 'draft' | 'issued';",
        '',
        'export interface LegacyErpInvoice {',
        '  readonly state: LegacyErpState;',
        "  readonly previousState: 'draft' | 'issued';",
        '}',
      ),
    ),
  ],
  invalid: [
    {
      ...inProject(
        'a table keyed by the vocabulary of the context, in an integration handler',
        HANDLER,
        table('Record<InvoiceStatus, string>', ["'draft': 'Draft'", "'issued': 'Issued'"]),
      ),
      errors: [
        { messageId: 'rawBesideOtherLanguage', line: 5, data: besideListed('draft', 'InvoiceStatus.Draft') },
        { messageId: 'rawBesideOtherLanguage', line: 6, data: besideListed('issued', 'InvoiceStatus.Issued') },
      ],
    },
    {
      ...inProject(
        'a value of the context in a table keyed by the published payload',
        HANDLER,
        table("Record<ProductListedV1Payload['state'], InvoiceStatus>", [
          "'draft': 'draft'",
          "'issued': InvoiceStatus.Issued",
        ]),
      ),
      errors: [
        {
          messageId: 'rawBesideOtherLanguage',
          line: 5,
          column: 12,
          data: besideListed('draft', 'InvoiceStatus.Draft'),
        },
      ],
    },
    {
      ...inProject(
        'a comparison to a word of the payload without satisfies',
        HANDLER,
        lines(
          READS_LISTED,
          '',
          "export const isIssued = (payload: ProductListedV1Payload): boolean => payload.state === 'issued';",
        ),
      ),
      errors: [{ messageId: 'rawBesideOtherLanguage', line: 3, data: besideListed('issued', 'InvoiceStatus.Issued') }],
    },
    {
      ...inProject(
        'a literal that satisfies the vocabulary of the context',
        HANDLER,
        lines(READS_STATUS, '', "export const ISSUED = 'issued' satisfies InvoiceStatus;"),
      ),
      errors: [{ messageId: 'raw', line: 3 }],
    },
    {
      ...inProject(
        'a type declared in an integration handler, which is not a place of an outside language',
        HANDLER,
        lines(
          READS_STATUS,
          '',
          "type Remote = 'issued';",
          '',
          "export const STATUSES: Record<Remote, InvoiceStatus> = { 'issued': InvoiceStatus.Issued };",
        ),
      ),
      errors: [
        { messageId: 'raw', line: 3 },
        { messageId: 'raw', line: 5 },
      ],
    },
    {
      ...inProject(
        'a table keyed by a type of a port of the context',
        HANDLER,
        lines(
          "import type { CatalogState } from '@/contexts/billing/application/ports/catalog-reader.port.js';",
          READS_STATUS,
          '',
          "export const STATUSES: Record<CatalogState, InvoiceStatus> = { 'issued': InvoiceStatus.Issued };",
        ),
      ),
      errors: [{ messageId: 'raw', line: 4 }],
    },
    {
      ...inProject(
        'a literal that satisfies a type of a package, in the model',
        AGGREGATE,
        lines(READS_ERP, '', "export const ISSUED = 'issued' satisfies ErpState;"),
      ),
      errors: [
        {
          messageId: 'raw',
          line: 3,
          data: { value: 'issued', vocabularies: OF_STATUS, written: 'InvoiceStatus.Issued' },
        },
      ],
    },
    {
      ...inProject(
        'a table keyed by a union of the payload and a type of the context',
        HANDLER,
        table("Record<ProductListedV1Payload['state'] | InvoiceStatus, InvoiceStatus>", LISTED_KEYS),
      ),
      errors: [
        { messageId: 'rawBesideOtherLanguage', line: 5 },
        { messageId: 'rawBesideOtherLanguage', line: 6 },
      ],
    },
  ],
});
