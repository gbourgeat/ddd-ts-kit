import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';

const { BILLING } = PATHS;

/** The files and sources the fixtures of `domain/value-object-class` share. */
export const VALUES = {
  RULE: 'domain/value-object-class',
  MONEY: `${BILLING}/domain/value-objects/money.vo.ts`,
  INVOICE_MONEY: `${BILLING}/domain/value-objects/invoice-money.vo.ts`,
  SERVICE: `${BILLING}/domain/services/invoice-total.service.ts`,
  SHARED: 'src/shared-kernel/money.vo.ts',
  SHARED_PLAIN: 'src/shared-kernel/money.ts',
  KERNEL: "import { ValueObject } from '@ddd-ts-kit/kernel';\n",
  PROPS: 'export type MoneyProps = {\n  readonly cents: number;\n};\n',
  PRIVATE: '  private constructor(props: MoneyProps) {\n    super(props);\n  }\n\n',
  OF: '  static of(cents: number): Money {\n    return new Money({ cents });\n  }\n\n',
  PLAIN: 'export const money = (cents: number, currency: string) => ({ cents, currency });\n',
  IMPORT_MONEY: "import { Money } from '@/contexts/billing/domain/value-objects/money.vo.js';\n\n",
} as const;

/** The value object every passing fixture starts from: a private constructor and a static factory. */
const VALUE_OBJECT = money(VALUES.PRIVATE, VALUES.OF);

/** The builders of the fixtures of `domain/value-object-class`. */
export const VALUE_FILES = { money, classes, service, valueObject, VALUE_OBJECT };

/** `Money`, a class of `money.vo.ts` with the constructor, the factories and the heritage given. */
function money(constructor: string, factory: string, base = 'extends ValueObject<MoneyProps> '): string {
  return `${VALUES.KERNEL}\n${VALUES.PROPS}\nexport class Money ${base}{\n${constructor}${factory}  add(other: Money): Money {\n    return Money.of(this.props.cents + other.props.cents);\n  }\n}\n`;
}

/** A project that writes its values as classes, as `init` writes it, holding `files`. */
function classes(files: FixtureFiles): FixtureFiles {
  return project(files, { [CONFIG_FILE]: config({ stack: { values: 'classes' } }) });
}

/** The value object and a domain service holding `content`, each with its spec. */
function service(content: string): FixtureFiles {
  return {
    ...valueObject(VALUE_OBJECT),
    [VALUES.SERVICE]: `${VALUES.IMPORT_MONEY}${content}`,
    [`${BILLING}/test/unit/invoice-total.service.spec.ts`]: SAMPLES.SPEC,
  };
}

/** `money.vo.ts` holding `content`, with its spec. */
function valueObject(content: string): FixtureFiles {
  return { [VALUES.MONEY]: content, [`${BILLING}/test/unit/money.vo.spec.ts`]: SAMPLES.SPEC };
}
