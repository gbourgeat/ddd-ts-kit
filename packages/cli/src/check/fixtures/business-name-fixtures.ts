import { CONFIG_FILE } from '../../config';
import { aggregate } from './aggregate';
import { config } from './config';
import type { Fixture } from './fixture';
import { handler } from './handler';
import { PATHS } from './paths';
import { project } from './project';
import { source } from './source';

const { ADAPTER, AGGREGATE, BILLING, HANDLER } = PATHS;

const RULE = 'naming/business-name';
const SHARED = 'src/shared-kernel/period.ts';
const SPEC = `${BILLING}/test/unit/invoice-lines.spec.ts`;

/** A handler written in the words of the business: a variable, a loop, a destructuring, a parameter, a property. */
const NAMED = source(
  'export class IssueInvoiceHandler {',
  '  private readonly issued: string[] = [];',
  '',
  '  async execute(command: IssueInvoiceCommand): Promise<string> {',
  '    const { invoiceId, lines } = command;',
  '    const invoice = await this.invoiceRepository.findById(invoiceId);',
  '',
  '    for (const line of lines) {',
  '      invoice.add(line);',
  '    }',
  '',
  '    this.issued.push(invoice.id);',
  '',
  '    return invoice.id;',
  '  }',
  '}',
);

export const BUSINESS_NAME_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a handler and an aggregate that speak the language of the context, the keys of an object literal',
    expect: 'pass',
    files: project({
      ...handler(NAMED),
      ...aggregate(
        source(
          'export class Invoice {',
          '  private readonly lines: InvoiceLine[] = [];',
          '',
          '  add(line: InvoiceLine): void {',
          '    this.lines.push(line);',
          '  }',
          '',
          '  toLines(): readonly Line[] {',
          '    return this.lines.map((line) => ({ item: line.label, data: line.amount }));',
          '  }',
          '}',
        ),
      ),
    }),
  },
  {
    ruleId: RULE,
    name: 'infrastructure, presentation, the platform and the tests are not judged',
    expect: 'pass',
    files: project({
      [ADAPTER]: source(
        'export class InMemoryInvoiceRepository {',
        '  private readonly items: string[] = [];',
        '',
        '  save(target: string): void {',
        '    this.items.push(target);',
        '  }',
        '}',
      ),
      [`${BILLING}/presentation/http/shared/invoice-line.serializer.ts`]: source(
        'export class InvoiceLineSerializer {',
        '  serialize(item: InvoiceLine): string {',
        '    return item.label;',
        '  }',
        '}',
      ),
      'src/platform/buses/logged.ts': source(
        'export function logged(info: MessageInfo): string {',
        '  return info.name;',
        '}',
      ),
      [SPEC]: source(
        "import { expect, it } from 'vitest';",
        '',
        "it('adds a line', () => {",
        '  const target = anInvoice();',
        '',
        '  expect(target.lines).toEqual([]);',
        '});',
      ),
    }),
  },
  {
    ruleId: RULE,
    name: 'a word the config allows, and a list the config replaces',
    expect: 'pass',
    files: project(handler(generic('const invoice =', 'const data =').replaceAll('invoice.', 'data.')), {
      [CONFIG_FILE]: config({ businessNames: { words: ['data', 'record'], allow: ['data'] } }),
    }),
  },
  {
    ruleId: RULE,
    name: 'a variable read from a repository named target',
    expect: { file: HANDLER },
    files: project(handler(generic('const invoice =', 'const target =').replaceAll('invoice.', 'target.'))),
  },
  {
    ruleId: RULE,
    name: 'a loop variable named item',
    expect: { file: HANDLER },
    files: project(
      handler(
        generic(
          '    for (const line of lines) {\n      invoice.add(line);',
          '    for (const item of lines) {\n      invoice.add(item);',
        ),
      ),
    ),
  },
  {
    ruleId: RULE,
    name: 'a destructured binding named data',
    expect: { file: HANDLER },
    files: project(
      handler(generic('const { invoiceId, lines } = command;', 'const { invoiceId, lines: data } = command;')),
    ),
  },
  {
    ruleId: RULE,
    name: 'a parameter of an aggregate named element',
    expect: { file: AGGREGATE },
    files: project(
      aggregate(
        source(
          'export class Invoice {',
          '  add(element: InvoiceLine): void {',
          '    this.record(element);',
          '  }',
          '}',
        ),
      ),
    ),
  },
  {
    ruleId: RULE,
    name: 'a property of an aggregate named info',
    expect: { file: AGGREGATE },
    files: project(aggregate(source('export class Invoice {', '  private readonly info: string = "";', '}'))),
  },
  {
    ruleId: RULE,
    name: 'a property of an interface of the shared kernel named things',
    expect: { file: SHARED },
    files: project({ [SHARED]: source('export interface Period {', '  readonly things: readonly string[];', '}') }),
  },
  {
    ruleId: RULE,
    name: 'the parameter of an arrow named obj, in a handler',
    expect: { file: HANDLER },
    files: project(
      handler(generic('    this.issued.push(invoice.id);', '    lines.forEach((obj) => invoice.add(obj));')),
    ),
  },
  {
    ruleId: RULE,
    name: 'a word the config adds to the list',
    expect: { file: HANDLER },
    files: project(handler(generic('const invoice =', 'const record =').replaceAll('invoice.', 'record.')), {
      [CONFIG_FILE]: config({ businessNames: { words: ['record'] } }),
    }),
  },
];

/** The same handler with one binding named by a generic word, what the line of `NAMED` becomes. */
function generic(line: string, written: string): string {
  return NAMED.replace(line, written);
}
