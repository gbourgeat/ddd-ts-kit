import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { source } from './source.js';

const { ADAPTER, BILLING, PORT } = PATHS;

const RESULT = `${BILLING}/application/commands/issue-invoice/issue-invoice.result.ts`;
const LINES = 'src/platform/lines.ts';
const TOTAL = 'src/platform/total.ts';
const GATEWAYS = `${BILLING}/application/ports/gateways.port.ts`;

const HASH_PRIVATE: readonly Fixture[] = [
  {
    ruleId: 'clean/no-hash-private',
    name: 'private members, a hash in a string and in a comment',
    expect: 'pass',
    files: project({
      [ADAPTER]: source(
        'export class InMemoryInvoiceRepository {',
        '  // The #rows of the first version are gone.',
        '  private readonly rows = new Map<string, string>();',
        '',
        '  find(id: string): string {',
        "    return this.rows.get(id) ?? '#none';",
        '  }',
        '}',
      ),
    }),
  },
  {
    ruleId: 'clean/no-hash-private',
    name: 'a hash field and a hash method',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]: source(
        'export class InMemoryInvoiceRepository {',
        '  readonly #rows = new Map<string, string>();',
        '',
        '  find(id: string): string | undefined {',
        '    return this.#read(id);',
        '  }',
        '',
        '  #read(id: string): string | undefined {',
        '    return this.#rows.get(id);',
        '  }',
        '}',
      ),
    }),
  },
];

const BLANK_LINES: readonly Fixture[] = [
  {
    ruleId: 'clean/blank-lines',
    name: 'a return set apart, alone in its block, under a label or under its comment',
    expect: 'pass',
    files: project({
      'src/platform/label.ts': source(
        'export function label(status: string, issued: boolean): string {',
        '  if (!issued) return status;',
        '',
        '  switch (status) {',
        "    case 'paid':",
        "      return 'Paid';",
        '    default: {',
        '      // Anything else is still due.',
        "      return 'Due';",
        '    }',
        '  }',
        '}',
      ),
      [TOTAL]: source(
        'export function total(amounts: readonly number[]): number {',
        '  const sum = amounts.reduce((left, right) => left + right, 0);',
        '',
        '  // Rounded to cents: amounts are stored as integers.',
        '  return Math.round(sum);',
        '}',
      ),
    }),
  },
  {
    ruleId: 'clean/blank-lines',
    name: 'a return right after a statement',
    expect: { file: TOTAL },
    files: project({ [TOTAL]: source('export function total(amounts: readonly number[]): number {', '  const sum = amounts.reduce((left, right) => left + right, 0);', '  return Math.round(sum);', '}') }),
  },
  {
    ruleId: 'clean/blank-lines',
    name: 'a block padded with blank lines',
    expect: { file: TOTAL },
    files: project({ [TOTAL]: source('export function total(amounts: readonly number[]): number {', '', '  return amounts.length;', '', '}') }),
  },
];

const ONE_EXPORT: readonly Fixture[] = [
  {
    ruleId: 'clean/one-export-per-file',
    name: 'one class with the types of its signature, a result, a union with its constructors, accessors of one state, an index that re-exports',
    expect: 'pass',
    files: project({
      [ADAPTER]: source(
        'export interface FindOptions {',
        '  readonly limit: number;',
        '}',
        '',
        'export const DEFAULT_LIMIT = 50;',
        '',
        'export class InMemoryInvoiceRepository {',
        '  find(options: FindOptions): number {',
        '    return options.limit;',
        '  }',
        '}',
      ),
      [RESULT]: source('export interface IssueInvoiceResult {', '  readonly invoiceId: string;', '}'),
      'src/shared-kernel/outcome.ts': source(
        'export interface Success {',
        '  readonly ok: true;',
        '}',
        '',
        'export interface Failure {',
        '  readonly ok: false;',
        '}',
        '',
        'export type Outcome = Success | Failure;',
        '',
        'export function success(): Success {',
        '  return { ok: true };',
        '}',
        '',
        'export function failure(): Failure {',
        '  return { ok: false };',
        '}',
      ),
      'src/platform/counters.ts': source(
        'const counters = new Map<string, number>();',
        '',
        'export function increment(name: string): void {',
        '  counters.set(name, countOf(name) + 1);',
        '}',
        '',
        'export function countOf(name: string): number {',
        '  return counters.get(name) ?? 0;',
        '}',
      ),
      'src/platform/index.ts': source("export { countOf, increment } from './counters.js';", "export type { Outcome } from '../shared-kernel/outcome.js';"),
    }),
  },
  {
    ruleId: 'clean/one-export-per-file',
    name: 'several exports that are one thing, allowed in the config with their reason',
    expect: 'pass',
    files: project(
      { 'src/platform/http-server.ts': source('export class HttpServer {}', '', 'export class HttpServerError extends Error {}') },
      { [CONFIG_FILE]: config({ onePerFile: { allow: [{ file: 'src/platform/http-*.ts', reason: 'The server and the error it raises are one boundary.' }] } }) },
    ),
  },
  {
    ruleId: 'clean/one-export-per-file',
    name: 'two ports in one file',
    expect: { file: GATEWAYS },
    files: project({ [GATEWAYS]: source('export abstract class PaymentGateway {}', '', 'export abstract class TaxGateway {}') }),
  },
  {
    ruleId: 'clean/one-export-per-file',
    name: 'a file that is not named after what it exports',
    expect: { file: PORT },
    files: project({ [PORT]: 'export abstract class TaxRates {}\n' }),
  },
  {
    ruleId: 'clean/one-export-per-file',
    name: 'an index file that declares something',
    expect: { file: 'src/platform/index.ts' },
    files: project({ 'src/platform/index.ts': source("export * from './counters.js';", '', 'export const platformName = 1;') }),
  },
];

const FILE_SIZE: readonly Fixture[] = [
  {
    ruleId: 'clean/file-size',
    name: 'a file of exactly 350 lines',
    expect: 'pass',
    files: project({ [LINES]: listOfLines(350) }),
  },
  {
    ruleId: 'clean/file-size',
    name: 'a file of 351 lines',
    expect: { file: LINES },
    files: project({ [LINES]: listOfLines(351) }),
  },
];

export const LAYOUT_FIXTURES: readonly Fixture[] = [...HASH_PRIVATE, ...BLANK_LINES, ...ONE_EXPORT, ...FILE_SIZE];

/** A source of exactly `count` lines: a list written one entry per line. */
function listOfLines(count: number): string {
  return source('export const lines = [', ...Array.from({ length: count - 2 }, (_, index) => `  ${index},`), '];');
}
