import { CONFIG_FILE } from '../../config/index.js';
import { aggregate } from './aggregate.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';
import { handler } from './handler.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { source } from './source.js';

const { ADAPTER, AGGREGATE, BILLING, HANDLER } = PATHS;

const ISSUE = 'src/platform/issue.ts';
const FIND = 'src/platform/find.ts';
const FIRST = 'src/platform/first.ts';

export const CLEAN_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'clean/stepdown',
    name: 'factories, public methods, then each private method after its caller',
    expect: 'pass',
    files: project({
      'src/platform/load.ts':
        'export function load(text: string): string[] {\n  return text.split(",").map(clean);\n}\n\nfunction clean(part: string): string {\n  return part.trim();\n}\n',
      [ADAPTER]: [
        'export class InMemoryInvoiceRepository {',
        '  private readonly rows = new Map<string, string>();',
        '',
        '  private constructor() {}',
        '',
        '  static empty(): InMemoryInvoiceRepository {',
        '    return new InMemoryInvoiceRepository();',
        '  }',
        '',
        '  save(id: string): void {',
        '    this.rows.set(id, this.normalize(id));',
        '  }',
        '',
        '  get size(): number {',
        '    return this.rows.size;',
        '  }',
        '',
        '  private normalize(id: string): string {',
        '    return this.trim(id);',
        '  }',
        '',
        '  private trim(id: string): string {',
        '    return id.trim();',
        '  }',
        '}',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'clean/stepdown',
    name: 'a private method declared before a public one',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]:
        'export class InMemoryInvoiceRepository {\n  private trim(id: string): string {\n    return id.trim();\n  }\n\n  save(id: string): string {\n    return this.trim(id);\n  }\n}\n',
    }),
  },
  {
    ruleId: 'clean/stepdown',
    name: 'a helper function declared above its caller',
    expect: { file: 'src/platform/load.ts' },
    files: project({
      'src/platform/load.ts':
        'function clean(part: string): string {\n  return part.trim();\n}\n\nexport function load(text: string): string[] {\n  return text.split(",").map(clean);\n}\n',
    }),
  },
  {
    ruleId: 'clean/stepdown',
    name: 'a private method declared above the private method that calls it',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]:
        'export class InMemoryInvoiceRepository {\n  save(id: string): string {\n    return this.normalize(id);\n  }\n\n  private trim(id: string): string {\n    return id.trim();\n  }\n\n  private normalize(id: string): string {\n    return this.trim(id);\n  }\n}\n',
    }),
  },
  {
    ruleId: 'clean/function-size',
    name: 'short functions, a constructor with many injected dependencies',
    expect: 'pass',
    files: project({
      [ADAPTER]:
        'export class InMemoryInvoiceRepository {\n  constructor(\n    readonly a: string,\n    readonly b: string,\n    readonly c: string,\n    readonly d: string,\n  ) {}\n\n  find(id: string, options: { limit: number; offset: number }, fallback = id): string {\n    return id + options.limit + fallback;\n  }\n}\n',
    }),
  },
  {
    ruleId: 'clean/function-size',
    name: 'a function with four parameters',
    expect: { file: ISSUE },
    files: project({
      [ISSUE]:
        'export function issue(id: string, customer: string, amount: number, currency: string): string {\n  return id + customer + amount + currency;\n}\n',
    }),
  },
  {
    ruleId: 'clean/function-size',
    name: 'a function longer than the limit',
    expect: { file: ISSUE },
    files: project({ [ISSUE]: functionOfLines(32) }),
  },
  {
    ruleId: 'clean/function-size',
    name: 'a function of exactly 100 lines, with the limit raised to the ceiling',
    expect: 'pass',
    files: project({ [ISSUE]: functionOfLines(100) }, { [CONFIG_FILE]: config({ limits: { maxFunctionLines: 100 } }) }),
  },
  {
    ruleId: 'clean/function-size',
    name: 'a function over the ceiling of 100 lines: an error whatever the limit and the severity',
    expect: { file: ISSUE },
    severity: 'error',
    files: project({ [ISSUE]: functionOfLines(101) }, { [CONFIG_FILE]: config({ limits: { maxFunctionLines: 100 } }) }),
  },
  {
    ruleId: 'clean/no-commented-out-code',
    name: 'prose, a why, an example in JSDoc and a directive',
    expect: 'pass',
    files: project({
      [ADAPTER]: [
        '// Rounded half-even: required by the tax authority (art. 242).',
        '// If the invoice is already issued, the adapter answers the stored one.',
        '/**',
        ' * Stores invoices in memory.',
        ' * @example',
        ' * const repository = new InMemoryInvoiceRepository();',
        ' * await repository.save(invoice);',
        ' */',
        'export class InMemoryInvoiceRepository {}',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'clean/no-commented-out-code',
    name: 'a statement left in a comment',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]:
        '// const total = lines.reduce((sum, line) => sum + line.amount, 0);\nexport class InMemoryInvoiceRepository {}\n',
    }),
  },
  {
    ruleId: 'clean/no-commented-out-code',
    name: 'a block of code in a block comment',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]: '/*\nif (invoice.issued) {\n  return invoice;\n}\n*/\nexport class InMemoryInvoiceRepository {}\n',
    }),
  },
  {
    ruleId: 'clean/no-noise-comment',
    name: 'comments that say why, a described parameter, an owned TODO, a TODO(review)',
    expect: 'pass',
    files: project({
      [FIND]: [
        '/**',
        ' * Keeps a copy of each invoice so that a caller mutating its own instance changes nothing here.',
        ' * @param id the business number, not the storage key',
        ' * @returns the stored copy, never the instance given to save',
        ' */',
        'export function find(id: string): string {',
        '  // TODO(billing-team): replace by the archive lookup, see #142.',
        '  // TODO(review): name the archive after its term in the glossary.',
        '  return id;',
        '}',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'clean/no-noise-comment',
    name: 'a JSDoc that repeats the member name',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]:
        'export class InMemoryInvoiceRepository {\n  /** Gets the order. */\n  getOrder(): string {\n    return "";\n  }\n}\n',
    }),
  },
  {
    ruleId: 'clean/no-noise-comment',
    name: 'a banner, a closing-brace label, an author, an empty tag and an ownerless TODO',
    expect: { file: FIND },
    files: project({
      [FIND]: [
        '// ---------- helpers ----------',
        '/**',
        ' * Finds what a caller stored earlier, by business number.',
        ' * @author Ada',
        ' * @param id',
        ' * @returns',
        ' */',
        'export function find(id: string): string {',
        '  if (id === "") {',
        '    return id;',
        '  } // end if',
        '',
        '  // TODO handle archives',
        '  return id;',
        '}',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'clean/no-escape-hatch',
    name: 'narrowing instead of asserting, a justified expectation',
    expect: 'pass',
    files: project({
      [FIRST]: [
        'export function first(values: readonly string[], many: unknown): string {',
        '  const [head] = values;',
        '  if (head === undefined || !many) {',
        '    throw new Error("empty");',
        '  }',
        '  // @ts-expect-error the vendor typings miss this overload, see #77',
        '  const company = head !== "" ? head : "any";',
        '',
        '  // eslint-disable-next-line no-console -- ADR-0001: startup banner requested by operations',
        '  return company;',
        '}',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'clean/no-escape-hatch',
    name: 'any and a non-null assertion',
    expect: { file: FIRST },
    files: project({
      [FIRST]:
        'export function first(values: any, map: Map<string, string>): string {\n  return (values as any)[0] + map.get("a")!.length;\n}\n',
    }),
  },
  {
    ruleId: 'clean/no-escape-hatch',
    name: 'suppressed diagnostics without a reason',
    expect: { file: 'src/platform/a.ts' },
    files: project({
      'src/platform/a.ts':
        '// @ts-ignore\nexport const a: number = "a";\n// @ts-expect-error\nexport const b: number = "b";\n// eslint-disable-next-line no-console\nexport const c = 1;\n',
    }),
  },
  {
    ruleId: 'clean/no-flag-argument',
    name: 'two intentions as two methods, a boolean carried by a command',
    expect: 'pass',
    files: project({
      ...aggregate(
        'export class Invoice {\n  issue(): void {}\n\n  issueMoney(): void {}\n\n  private apply(issued: boolean): boolean {\n    return issued;\n  }\n}\n',
      ),
      [`${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`]:
        'export class IssueInvoiceCommand {\n  constructor(readonly issue: boolean) {}\n}\n',
    }),
  },
  {
    ruleId: 'clean/no-flag-argument',
    name: 'a boolean parameter on a public method of an aggregate',
    expect: { file: AGGREGATE },
    files: project(
      aggregate('export class Invoice {\n  issue(money: boolean): boolean {\n    return money;\n  }\n}\n'),
    ),
  },
  {
    ruleId: 'clean/no-flag-argument',
    name: 'a defaulted flag on execute',
    expect: { file: HANDLER },
    files: project(
      handler(
        'export class IssueInvoiceHandler {\n  async execute(command: object, issue = false): Promise<boolean> {\n    return issue && command !== undefined;\n  }\n}\n',
      ),
    ),
  },
];

/** A function whose body holds exactly `count` lines of code. */
function functionOfLines(count: number): string {
  const steps = Array.from({ length: count - 1 }, (_, index) => `  const step${index} = id;`);

  return source('export function issue(id: string): string {', ...steps, '', '  return id;', '}');
}
