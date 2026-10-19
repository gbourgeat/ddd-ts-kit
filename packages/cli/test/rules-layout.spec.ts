import { describe, expect, it } from 'vitest';
import { runCheck } from '../src/check/engine/run-check.js';
import { kebabCaseOf } from '../src/check/exports/kebab-case-of.js';
import { matchesGlob } from '../src/check/exports/matches-glob.js';
import { namedAfter } from '../src/check/exports/named-after.js';
import { loadProject } from '../src/check/project/load-project.js';
import { lines, projectWith, reported } from './rules-support.js';

const RULE = 'clean/one-export-per-file';

describe('the name of a file', () => {
  it('is the kebab-case of what it exports', () => {
    const names = [
      'RabbitMqEventBus',
      'TypeOrmOutboxStore',
      'StandardSchemaV1',
      'HTTPServer',
      'NO_POLICY',
      'invoiceIssuedV1',
    ];

    expect(names.map(kebabCaseOf)).toEqual([
      'rabbit-mq-event-bus',
      'type-orm-outbox-store',
      'standard-schema-v1',
      'http-server',
      'no-policy',
      'invoice-issued-v1',
    ]);
  });

  it('reads every dot as a hyphen, or keeps the name before a role the export does not end with', () => {
    expect(namedAfter('issue-invoice.handler', 'IssueInvoiceHandler')).toBe(true);
    expect(namedAfter('invoice.aggregate', 'Invoice')).toBe(true);
    expect(namedAfter('payment-gateway.port', 'PaymentGateway')).toBe(true);
    expect(namedAfter('issue.handler', 'IssueInvoiceHandler')).toBe(false);
    expect(namedAfter('invoice-handler.handler', 'InvoiceHandler')).toBe(false);
    expect(namedAfter('product-listed.integration-handler', 'ProductListedHandler')).toBe(false);
    expect(namedAfter('product-listed.integration-handler', 'ProductListedIntegrationHandler')).toBe(true);
  });

  it('is not asked of a file that exports no class, interface nor function', () => {
    expect(
      messagesOf({ 'src/platform/settings.ts': 'export const PORT = 3000;\n\nexport type Mode = string;\n' }),
    ).toEqual([]);
  });

  it('matches the files of onePerFile.allow by path or by glob', () => {
    expect(matchesGlob('src/platform/http-*.ts', 'src/platform/http-server.ts')).toBe(true);
    expect(matchesGlob('src/platform/*.ts', 'src/platform/auth/roles/roles.ts')).toBe(false);
    expect(matchesGlob('src/**/roles.ts', 'src/platform/auth/roles/roles.ts')).toBe(true);
    expect(matchesGlob('src/**/roles.ts', 'src/roles.ts')).toBe(true);
  });
});

describe('clean/one-export-per-file', () => {
  it('takes a function with the function derived from it, and a family returning a type the file imports', () => {
    const retry = lines(
      'export function retry(): Advice {',
      '  return retryAdvice();',
      '}',
      '',
      'export function retryAdvice(): Advice {',
      '  return advice;',
      '}',
    );

    const selectors = lines(
      "import type { Selector } from './selector.js';",
      '',
      'export function byId(): Selector {',
      '  return selector;',
      '}',
      '',
      'export function byName(): Selector {',
      '  return selector;',
      '}',
    );

    expect(messagesOf({ 'src/platform/retry.ts': retry, 'src/platform/selectors.ts': selectors })).toEqual([]);
  });

  it('reports two functions nothing ties together, on the second one, and still asks for the name', () => {
    const helpers = lines(
      'export function first(): number {',
      '  return 1;',
      '}',
      '',
      'export function second(): string {',
      "  return '';",
      '}',
    );

    expect(messagesOf({ 'src/platform/helpers.ts': helpers })).toEqual([
      'src/platform/helpers.ts:1 "helpers.ts" is not named after what it exports (first, second).',
      'src/platform/helpers.ts:5 The file exports 2 classes, interfaces or functions (first, second).',
    ]);
  });

  it('exempts an allowed file from the count, never from its name', () => {
    const server = lines('export class HttpServer {}', '', 'export class HttpServerError {}');
    const allow = [{ file: 'src/platform/*.ts', reason: 'One boundary.' }];

    expect(
      messagesOf(
        { 'src/platform/http-server.ts': server, 'src/platform/listener.ts': server },
        { onePerFile: { allow } },
      ),
    ).toEqual([
      'src/platform/listener.ts:1 "listener.ts" is not named after what it exports (HttpServer, HttpServerError).',
    ]);
  });

  it('lets an entry file re-export, import for a side effect and hold an empty export, and nothing else', () => {
    const entry = lines(
      "import 'reflect-metadata';",
      "import { helper } from './helper.js';",
      "export * from './a.js';",
      "export { b, type C } from './b.js';",
      "export type { D } from './d.js';",
      'export {};',
      'export { helper };',
      'const local = 1;',
    );

    expect(
      messagesOf({ 'src/platform/index.ts': entry }).map((message) => message.split(':')[1]?.split(' ')[0]),
    ).toEqual(['2', '7', '8']);
  });

  it('judges neither tests nor the files of a test directory', () => {
    const two = lines('export class First {}', '', 'export class Second {}');

    expect(
      messagesOf({
        'src/platform/two.spec.ts': two,
        'src/contexts/billing/test/fakes/fakes.ts': two,
        'src/platform/test/doubles.ts': two,
      }),
    ).toEqual([]);
  });
});

describe('clean/function-size', () => {
  const long = lines(
    'export function longest(): number {',
    ...Array.from({ length: 101 }, (_, index) => `  const step${index} = ${index};`),
    '',
    '  return step0;',
    '}',
  );

  it('reports a function over the ceiling as an error whatever the severity, unless the rule is off', () => {
    const severityUnder = (rules: Record<string, string>): string[] => {
      const deviations = Object.keys(rules).map((id) => ({ what: `rules.${id}`, adr: '0001', reason: 'Recorded.' }));

      const root = projectWith(
        { 'src/platform/longest.ts': long, 'docs/adr/0001-sizes.md': '# Sizes\n' },
        { rules, deviations },
      );

      return runCheck(loadProject(root), { rules: ['clean/function-size'] }).violations.map(({ severity }) => severity);
    };

    expect(severityUnder({})).toEqual(['error']);
    expect(severityUnder({ 'clean/function-size': 'warn' })).toEqual(['error']);
    expect(severityUnder({ 'clean/function-size': 'off' })).toEqual([]);
  });
});

describe('clean/blank-lines', () => {
  it('reads a comment above a return as part of it, and leaves a blank line inside a literal to the formatter', () => {
    const source = lines(
      'export function total(): number {',
      '',
      '  const sum = 1;',
      '  // Rounded.',
      '  return sum;',
      '}',
      '',
      'export const table = {',
      '',
      '  a: 1,',
      '};',
    );

    expect(
      reported(projectWith({ 'src/platform/total.ts': source }), 'clean/blank-lines').map(
        ({ line, message }) => `${line} ${message}`,
      ),
    ).toEqual(['2 A blank line pads the start of a block.', '5 No blank line before this `return`.']);
  });
});

describe('clean/braces', () => {
  const braces = (...written: string[]): string[] =>
    reported(projectWith({ 'src/platform/total.ts': lines(...written) }), 'clean/braces').map(
      ({ line, message }) => `${line} ${message}`,
    );

  it('reports each branch and loop without braces, a body on the line of its braces and an else set apart', () => {
    const found = braces(
      'export async function run(steps: readonly (() => Promise<void>)[], ready: boolean): Promise<number> {',
      '  if (!ready) return 0;',
      '  for (const step of steps) await step();',
      '  for await (const step of steps) { await step(); }',
      '  while (ready) steps.keys();',
      '  do steps.keys(); while (ready);',
      '  if (ready) {',
      '    return 1;',
      '  }',
      '  else return 2;',
      '}',
    );

    expect(found).toEqual([
      '2 The body of this `if` has no braces.',
      '3 The body of this `for` has no braces.',
      '4 The body of this `for` shares a line with its braces.',
      '5 The body of this `while` has no braces.',
      '6 The body of this `do` has no braces.',
      '10 This `else` starts a line instead of following the closing brace.',
    ]);
  });

  it('reads a body on the next line, a comment after the brace and a keyword in a string or a comment as ESLint does', () => {
    const found = braces(
      'export function label(status: string): string {',
      '  // if (legacy) return status;',
      '  if (status === "paid")',
      '    return "Paid";',
      '',
      '  if (status === "due") { // still open',
      '    return "if (due) else";',
      '  } else if (status === "void") {',
      '    return `while (${status}) do`;',
      '  }',
      '',
      '  return status;',
      '}',
    );

    expect(found).toEqual(['3 The body of this `if` has no braces.']);
  });
});

describe('config/valid', () => {
  it('reports each incomplete entry of onePerFile.allow on its own line', () => {
    const allow = [
      { file: 'src/a.ts', reason: 'One thing.' },
      { file: 'src/b.ts', reason: ' ' },
      { reason: 'No file.' },
      'src/c.ts',
    ];

    const root = projectWith({}, { onePerFile: { allow } });

    expect(
      reported(root, 'config/valid').flatMap(({ message }) => (message.startsWith('Entry') ? [message] : [])),
    ).toEqual([
      'Entry 2 of "onePerFile.allow" has no reason: it is ignored.',
      'Entry 3 of "onePerFile.allow" has no file: it is ignored.',
      'Entry 4 of "onePerFile.allow" has no file and no reason: it is ignored.',
    ]);
  });
});

describe('clean/file-size', () => {
  const long = lines('export const entries = [', ...Array.from({ length: 400 }, (_, index) => `  ${index},`), '];');

  it('does not judge the generated barrel and dependency file at the root of a context', () => {
    const root = projectWith({
      'src/contexts/billing/billing.declarations.ts': long,
      'src/contexts/shipping/shipping.dependencies.ts': long,
    });

    expect(reported(root, 'clean/file-size')).toEqual([]);
  });

  it('judges a file named like a generated one anywhere else, or after another context', () => {
    const root = projectWith({
      'src/contexts/billing/domain/billing.declarations.ts': long,
      'src/contexts/billing/shipping.declarations.ts': long,
    });

    expect(reported(root, 'clean/file-size').map(({ file }) => file)).toEqual([
      'src/contexts/billing/domain/billing.declarations.ts',
      'src/contexts/billing/shipping.declarations.ts',
    ]);
  });
});

function messagesOf(files: Readonly<Record<string, string>>, config: Record<string, unknown> = {}): string[] {
  return reported(projectWith(files, config), RULE).map(({ file, line, message }) => `${file}:${line} ${message}`);
}
