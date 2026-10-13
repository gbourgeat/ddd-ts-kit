import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { BILLING } = PATHS;
const RULE = 'domain/value-object-class';

const MONEY = `${BILLING}/domain/value-objects/money.vo.ts`;
const MONEY_SPEC = `${BILLING}/test/unit/money.vo.spec.ts`;
const INVOICE_MONEY = `${BILLING}/domain/value-objects/invoice-money.vo.ts`;
const INVOICE_MONEY_SPEC = `${BILLING}/test/unit/invoice-money.vo.spec.ts`;
const SERVICE = `${BILLING}/domain/services/invoice-total.service.ts`;
const SERVICE_SPEC = `${BILLING}/test/unit/invoice-total.service.spec.ts`;
const SHARED = 'src/shared-kernel/money.vo.ts';

const KERNEL = "import { ValueObject } from '@ddd-ts-kit/kernel';\n";
const PROPS = 'export type MoneyProps = {\n  readonly cents: number;\n};\n';

const money = (constructor: string, factory: string, base = 'extends ValueObject<MoneyProps> '): string =>
  `${KERNEL}\n${PROPS}\nexport class Money ${base}{\n${constructor}${factory}  add(other: Money): Money {\n    return Money.of(this.props.cents + other.props.cents);\n  }\n}\n`;

const PRIVATE = '  private constructor(props: MoneyProps) {\n    super(props);\n  }\n\n';
const OF = '  static of(cents: number): Money {\n    return new Money({ cents });\n  }\n\n';
const VALUE_OBJECT = money(PRIVATE, OF);

const valueObject = (content: string): Record<string, string> => ({ [MONEY]: content, [MONEY_SPEC]: SAMPLES.SPEC });

const service = (content: string): Record<string, string> => ({
  [MONEY]: VALUE_OBJECT,
  [MONEY_SPEC]: SAMPLES.SPEC,
  [SERVICE]: `import { Money } from '@/contexts/billing/domain/value-objects/money.vo.js';\n\n${content}`,
  [SERVICE_SPEC]: SAMPLES.SPEC,
});

const PLAIN = 'export const money = (cents: number, currency: string) => ({ cents, currency });\n';

export const VALUE_OBJECT_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a value object class with a private constructor, a static factory and the type of its props',
    expect: 'pass',
    files: project(valueObject(VALUE_OBJECT)),
  },
  {
    ruleId: RULE,
    name: 'a value object extending another one of the project, and one of the shared kernel',
    expect: 'pass',
    files: project({
      ...valueObject(
        money(
          '  protected constructor(props: MoneyProps) {\n    super(props);\n  }\n\n',
          '',
          'extends ValueObject<MoneyProps> ',
        ).replace('export class Money', 'export abstract class Money'),
      ),
      [INVOICE_MONEY]:
        "import { Money } from '@/contexts/billing/domain/value-objects/money.vo.js';\n\nexport class InvoiceMoney extends Money {\n  static due(cents: number): InvoiceMoney {\n    return new InvoiceMoney({ cents });\n  }\n}\n",
      [INVOICE_MONEY_SPEC]: SAMPLES.SPEC,
      [SHARED]: VALUE_OBJECT,
    }),
  },
  {
    ruleId: RULE,
    name: 'domain functions that answer a value object, a boolean, an object of functions, or a plain object only inside a callback',
    expect: 'pass',
    files: project(
      service(
        'export function invoiceTotal(lines: readonly Money[]): Money {\n  const rows = lines.map((line) => {\n    return { line, cents: 0 };\n  });\n\n  return rows.reduce((sum, { line }) => sum.add(line), Money.of(0));\n}\n',
      ),
    ),
  },
  {
    ruleId: RULE,
    name: 'a specification written as a function answering an object of functions',
    expect: 'pass',
    files: project(
      service(
        'export const invoiceTotal = (floor: Money) => ({\n  isSatisfiedBy: (total: Money): boolean => total.equals(floor),\n  describe(): string {\n    return String(floor);\n  },\n});\n',
      ),
    ),
  },
  {
    ruleId: RULE,
    name: 'a value object file holding an arrow function that builds a plain object',
    expect: { file: MONEY },
    files: project(valueObject(`${PROPS}\n${PLAIN}`)),
  },
  {
    ruleId: RULE,
    name: 'a value object class that does not extend ValueObject',
    expect: { file: MONEY },
    files: project(valueObject(money('  private constructor(private readonly props: MoneyProps) {}\n\n', OF, ''))),
  },
  {
    ruleId: RULE,
    name: 'a value object class with a public constructor',
    expect: { file: MONEY },
    files: project(valueObject(money('  constructor(props: MoneyProps) {\n    super(props);\n  }\n\n', OF))),
  },
  {
    ruleId: RULE,
    name: 'a value object class without a static factory',
    expect: { file: MONEY },
    files: project(valueObject(money(PRIVATE, ''))),
  },
  {
    ruleId: RULE,
    name: 'a value object file that also exports a function',
    expect: { file: MONEY },
    also: ['clean/one-export-per-file'],
    files: project(valueObject(`${VALUE_OBJECT}\nexport function zero(): Money {\n  return Money.of(0);\n}\n`)),
  },
  {
    ruleId: RULE,
    name: 'a value object file that also exports an object literal standing for a value',
    expect: { file: MONEY },
    files: project(valueObject(`${VALUE_OBJECT}\nexport const ZERO = { cents: 0 };\n`)),
  },
  {
    ruleId: RULE,
    name: 'a domain service function that builds a plain object',
    expect: { file: SERVICE },
    files: project(
      service(
        'export function invoiceTotal(lines: readonly Money[], currency: string) {\n  const cents = lines.length;\n\n  return { cents, currency };\n}\n',
      ),
    ),
  },
  {
    ruleId: RULE,
    name: 'a domain arrow function that answers a plain object',
    expect: { file: SERVICE },
    files: project(service(`export const invoiceTotal = (line: Money, currency: string) => ({ line, currency });\n`)),
  },
  {
    ruleId: RULE,
    name: 'a value object of the shared kernel written as a function',
    expect: { file: SHARED },
    files: project({ [SHARED]: PLAIN }),
  },
];
