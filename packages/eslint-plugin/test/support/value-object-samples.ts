import { at, BILLING, SAMPLE_CONFIG } from './rule-tester.js';

/** A project that writes its values as classes, as `init` writes it. */
export const CLASSES = { ...SAMPLE_CONFIG, stack: { values: 'classes' } };

export const MONEY = `${BILLING}/domain/value-objects/money.vo.ts`;
export const SERVICE = `${BILLING}/domain/services/invoice-total.service.ts`;

export const PROPS = 'export type MoneyProps = { readonly cents: number };';
export const KERNEL = "import { ValueObject } from '@ddd-ts-kit/kernel';";
export const IMPORT_MONEY = "import { Money } from '@/contexts/billing/domain/value-objects/money.vo';";

export const VALUE_OBJECT = `${KERNEL}
${PROPS}
export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) { super(props); }
  static of(cents: number): Money { return new Money({ cents }); }
  add(other: Money): Money { return Money.of(this.props.cents + other.props.cents); }
}`;

export const PLAIN = 'export const money = (cents: number, currency: string) => ({ cents, currency });';

/** `code` at `file` of a project that writes its values as classes. */
export function classes(file: string, code: string): ReturnType<typeof at> {
  return at(file, code, CLASSES);
}
