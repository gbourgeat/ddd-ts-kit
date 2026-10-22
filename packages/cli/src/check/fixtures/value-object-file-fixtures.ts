import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';
import { VALUE_FILES, VALUES } from './value-object-files';

const { RULE, MONEY, INVOICE_MONEY, SHARED, PROPS, PRIVATE, OF, PLAIN, KERNEL } = VALUES;
const { classes, money, VALUE_OBJECT, valueObject } = VALUE_FILES;

const passing = (name: string, files: Fixture['files']): Fixture => ({ ruleId: RULE, name, expect: 'pass', files });

/** A value object file holding `content`: the rule reports it in that file. */
const failing = (name: string, content: string, also?: readonly string[]): Fixture => ({
  ruleId: RULE,
  name,
  expect: { file: MONEY },
  ...(also === undefined ? {} : { also }),
  files: classes(valueObject(content)),
});

const PROTECTED = '  protected constructor(props: MoneyProps) {\n    super(props);\n  }\n\n';

/** What `domain/value-object-class` says of the files of `domain/value-objects/` and of the `*.vo.ts` of the shared kernel. */
export const VALUE_OBJECT_FILE_FIXTURES: readonly Fixture[] = [
  passing(
    'a value object class with a private constructor, a static factory and the type of its props',
    classes(valueObject(VALUE_OBJECT)),
  ),
  passing(
    'a value object extending another one of the project, and one of the shared kernel',
    classes({
      ...valueObject(money(PROTECTED, '').replace('export class Money', 'export abstract class Money')),
      [INVOICE_MONEY]: `${VALUES.IMPORT_MONEY}export class InvoiceMoney extends Money {\n  static due(cents: number): InvoiceMoney {\n    return new InvoiceMoney({ cents });\n  }\n}\n`,
      [`${PATHS.BILLING}/test/unit/invoice-money.vo.spec.ts`]: SAMPLES.SPEC,
      [SHARED]: VALUE_OBJECT,
    }),
  ),
  passing(
    'a concrete value object with a protected constructor, and one that declares none',
    classes({
      ...valueObject(money(PROTECTED, VALUES.OF)),
      [INVOICE_MONEY]: `${KERNEL}\nexport class InvoiceMoney extends ValueObject<{ readonly cents: number }> {\n  static zero(): InvoiceMoney {\n    return new InvoiceMoney({ cents: 0 });\n  }\n}\n`,
      [`${PATHS.BILLING}/test/unit/invoice-money.vo.spec.ts`]: SAMPLES.SPEC,
    }),
  ),
  passing(
    'a value object class exported after its declaration, by `export default`',
    classes(valueObject(`${VALUE_OBJECT.replace('export class Money', 'class Money')}\nexport default Money;\n`)),
  ),
  passing(
    'a value object file written as a function, in a project whose config does not say "values"',
    project(valueObject(`${PROPS}\n${PLAIN}`)),
  ),
  failing('a value object file holding an arrow function that builds a plain object', `${PROPS}\n${PLAIN}`),
  failing(
    'a value object class that does not extend ValueObject',
    money('  private constructor(private readonly props: MoneyProps) {}\n\n', OF, ''),
  ),
  failing(
    'a value object class with a public constructor',
    money('  constructor(props: MoneyProps) {\n    super(props);\n  }\n\n', OF),
  ),
  failing('a value object class without a static factory', money(PRIVATE, '')),
  failing(
    'a value object file that also exports a function',
    `${VALUE_OBJECT}\nexport function zero(): Money {\n  return Money.of(0);\n}\n`,
    ['clean/one-export-per-file'],
  ),
  failing(
    'a value object file that exports a function by an export list',
    `${VALUE_OBJECT}\nexport { zero };\n\nfunction zero(): Money {\n  return Money.of(0);\n}\n`,
    ['clean/one-export-per-file'],
  ),
  failing(
    'a value object file that exports an arrow constant by an export list',
    `${VALUE_OBJECT}\nconst zero = (): Money => Money.of(0);\n\nexport { zero };\n`,
    ['clean/one-export-per-file'],
  ),
  failing(
    'a value object file that exports a constant bound to a function expression',
    `${VALUE_OBJECT}\nexport const zero = function (): Money {\n  return Money.of(0);\n};\n`,
    ['clean/one-export-per-file'],
  ),
  failing(
    'a value object file that also exports an object literal',
    `${VALUE_OBJECT}\nexport const ZERO = { cents: 0 };\n`,
  ),
  failing(
    'a value object file that exports a parenthesized object literal',
    `${VALUE_OBJECT}\nexport const ZERO = ({ cents: 0 });\n`,
  ),
  failing(
    'a value object file that exports an object literal `as const`',
    `${VALUE_OBJECT}\nexport const ZERO = { cents: 0 } as const;\n`,
  ),
  failing(
    'a value object file that exports an object literal that `satisfies` its props',
    `${VALUE_OBJECT}\nexport const ZERO = { cents: 0 } satisfies MoneyProps;\n`,
  ),
  failing(
    'a value object file whose default export is an object literal',
    `${VALUE_OBJECT}\nexport default { cents: 0 };\n`,
  ),
  failing(
    'a value object file that exports a second class',
    `${VALUE_OBJECT}\nexport class InvoiceMoney extends ValueObject<MoneyProps> {\n  static of(): InvoiceMoney {\n    return new InvoiceMoney({ cents: 0 });\n  }\n}\n`,
    ['clean/one-export-per-file', 'naming/one-concept-per-file'],
  ),
  {
    ruleId: RULE,
    name: 'a value object of the shared kernel written as a function',
    expect: { file: SHARED },
    files: classes({ [SHARED]: PLAIN }),
  },
];
