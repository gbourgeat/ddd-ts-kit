import type { RuleDoc } from '../model/rule-doc.js';

export const DOMAIN_DOCS: Readonly<Record<string, RuleDoc>> = {
  'domain/value-object-class': {
    why: 'A value of the model is a class extending ValueObject of the kernel, never a function that builds a plain object. The class compares by value with no identity (equals), checks its invariants once, in the static factory that is the only way in through a private constructor, keeps its behaviour next to its data, refuses an invalid input with the factory of the error of its concept, freezes its props, and is recognised with instanceof by a boundary mapper. A function answering { amount, currency } gives none of that: every caller re-validates, compares field by field, and the operations of the value scatter. So a file of domain/value-objects/ (or a *.vo.ts of the shared kernel) exports one class extending ValueObject, directly or through another value object of the project, with a private or protected constructor and static factories, and no function, arrow constant or object literal; the types of its props may be exported. Anywhere in domain/, an exported function that answers an object literal holding data is reported: a domain service, a state machine, a specification, or a function that takes and returns value objects answers something else and is not concerned.',
    bad: `// domain/value-objects/money.vo.ts
export type Money = { readonly amount: number; readonly currency: string };

export const money = (amount: number, currency: string): Money => ({ amount, currency });`,
    good: `// domain/value-objects/money.vo.ts (npx ddd-ts-kit generate value-object billing Money)
export type MoneyProps = { readonly amount: number; readonly currency: string };

export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  static of(amount: number, currency: string): Money {
    if (!Number.isInteger(amount)) {
      throw InvoiceError.invalidAmount(amount);
    }

    return new Money({ amount, currency });
  }

  add(other: Money): Money {
    return Money.of(this.props.amount + other.props.amount, this.props.currency);
  }
}`,
  },
};
