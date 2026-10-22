import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
import { languageDeclaredVocabulary } from '../../src/rules/language-declared-vocabulary';
import { BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester';

// The shapes of type a word of another language is written with: which say so, and which do not.

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-type-shapes-'));
const STATUS = `${BILLING}/domain/vocabularies/invoice-status.vocabulary.ts`;
const TRANSLATOR = `${BILLING}/infrastructure/anti-corruption/edge.translator.ts`;
const NAMED = { ...SAMPLE_CONFIG, stack: { literals: 'named' } };

const READS = [
  "import type * as erp from 'legacy-erp';",
  "import { type ErpCode, toCode } from 'legacy-kit';",
  "import type { Wire } from '@/contexts/billing/infrastructure/external/legacy-erp-invoice.js';",
  "import type { ListedState } from '@/contexts/catalog/published-language/product-listed.v1.payload.js';",
  "import { clock } from '@/platform/clock.js';",
  "import { InvoiceStatus } from '@/contexts/billing/domain/vocabularies/invoice-status.vocabulary.js';",
  '',
];

fs.mkdirSync(path.join(root, path.dirname(STATUS)), { recursive: true });

fs.writeFileSync(
  path.join(root, STATUS),
  "export const InvoiceStatus = {\n  Draft: 'draft',\n  Issued: 'issued',\n} as const;\n\nexport type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];\n",
);

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const at = (file: string, ...written: readonly string[]): { code: string; settings: Record<string, unknown> } => ({
  code: `${written.join('\n')}\n`,
  settings: { 'ddd-ts-kit': { config: NAMED, filename: file, rootDir: root } },
});

const translator = (...written: readonly string[]): { code: string; settings: Record<string, unknown> } =>
  at(TRANSLATOR, ...READS, ...written);

/** One literal reported, in a translator that reads other languages, on the line after the imports. */
const reportedOnce = (
  written: string,
): {
  code: string;
  settings: Record<string, unknown>;
  errors: { messageId: 'rawBesideOtherLanguage'; line: number }[];
} => ({
  ...translator(written),
  errors: [{ messageId: 'rawBesideOtherLanguage', line: READS.length + 1 }],
});

ruleTester.run('language-declared-vocabulary', languageDeclaredVocabulary, {
  valid: [
    translator(
      'export default interface Remote {',
      "  readonly state: 'draft';",
      '}',
      '',
      'class Holder {',
      "  private readonly byWire: Partial<Record<Wire, InvoiceStatus>> = { 'draft': InvoiceStatus.Draft };",
      "  accessor byCode: Required<Readonly<Record<ErpCode, InvoiceStatus>>> = { 'issued': InvoiceStatus.Issued };",
      '}',
      '',
      "export function read(table: Record<erp.State, InvoiceStatus> = { 'draft': InvoiceStatus.Draft }): unknown {",
      '  return [table, Holder, toCode, clock];',
      '}',
      '',
      "export const keyed: Record<keyof typeof erp, number> = { 'draft': 1 };",
      "export const indexed: Record<(typeof erp)['x'], number> = { 'issued': 1 };",
      "export const listed = { 'draft': 1 } satisfies Record<ListedState, number>;",
      "export const named = 'issued' satisfies erp.Codes.State;",
    ),
  ],
  invalid: [
    reportedOnce("export const both: Readonly<Record<ErpCode, number>> & { extra: 1 } = { 'draft': 1, extra: 1 };"),
    reportedOnce("export const map: Map<ErpCode, number> = { 'draft': 1 };"),
    reportedOnce("export const qualified: erp.Record<ErpCode, number> = { 'draft': 1 };"),
    reportedOnce("export const wrapped: Readonly<Record<ErpCode, number>, 1> = { 'draft': 1 };"),
    reportedOnce("export const three: Record<ErpCode, number, 1> = { 'draft': 1 };"),
    reportedOnce("export const tuple: [Record<ErpCode, number>] = [{ 'draft': 1 }];"),
    reportedOnce("export const imported = 'draft' satisfies typeof import('legacy-erp');"),
    reportedOnce("export const array = 'draft' satisfies ErpCode[];"),
    reportedOnce("export const operator = 'draft' satisfies readonly ErpCode[];"),
    reportedOnce("export const method = { 'draft'() { return 1; } } satisfies Record<ErpCode, () => number>;"),
    reportedOnce("export const constant = { 'draft': 1 } as const;"),
    reportedOnce("export const asserted = { 'draft': 1 } as Record<ErpCode, number>;"),
    reportedOnce("export const valueOnly: Record<toCode, number> = { 'draft': 1 };"),
    reportedOnce("export const platform: Record<clock, number> = { 'draft': 1 };"),
    {
      ...at(
        `${BILLING}/infrastructure/edge.translator.ts`,
        'export interface Remote {',
        "  readonly state: 'draft';",
        '}',
      ),
      errors: [{ messageId: 'raw', line: 2 }],
    },
  ],
});
