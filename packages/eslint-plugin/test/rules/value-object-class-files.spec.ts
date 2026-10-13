import { domainValueObjectClass } from '../../src/rules/domain-value-object-class.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';
import { classes, KERNEL, MONEY, PLAIN, PROPS, VALUE_OBJECT } from '../support/value-object-samples.js';

const INVOICE_MONEY = `${BILLING}/domain/value-objects/invoice-money.vo.ts`;
const SHARED = 'src/shared-kernel/money.vo.ts';

const PROTECTED = `${KERNEL}\nexport abstract class Money extends ValueObject<{ readonly cents: number }> { protected constructor(props: { readonly cents: number }) { super(props); } }`;

ruleTester.run('domain-value-object-class, the value object files', domainValueObjectClass, {
  valid: [
    classes(MONEY, VALUE_OBJECT),
    classes(SHARED, VALUE_OBJECT),
    classes(MONEY, PROTECTED),
    classes(
      INVOICE_MONEY,
      "import { Money } from '@/contexts/billing/domain/value-objects/money.vo';\nexport class InvoiceMoney extends Money { static due(cents: number): InvoiceMoney { return new InvoiceMoney({ cents }); } }",
    ),
    classes(
      MONEY,
      `${KERNEL}\nclass Quantity extends ValueObject<{ readonly n: number }> {}\nexport class Money extends Quantity { static of(n: number): Money { return new Money({ n }); } }`,
    ),
    classes(
      MONEY,
      `${KERNEL}\n${PROPS}\nexport class Money extends ValueObject<MoneyProps> { protected constructor(props: MoneyProps) { super(props); } static of(cents: number): Money { return new Money({ cents }); } }`,
    ),
    classes(
      MONEY,
      `${KERNEL}\nexport interface MoneyProps { readonly cents: number }\nexport class Money extends ValueObject<MoneyProps> { static zero(): Money { return new Money({ cents: 0 }); } }`,
    ),
    classes(MONEY, `${VALUE_OBJECT.replace('export class Money', 'class Money')}\nexport default Money;`),
    at(MONEY, `${PROPS}\n${PLAIN}`),
  ],
  invalid: [
    {
      ...classes(MONEY, `${PROPS}\n${PLAIN}`),
      errors: [{ messageId: 'noClass' }, { messageId: 'exportedFunction', data: { name: 'money' } }],
    },
    {
      ...classes(
        MONEY,
        'export class Money { private constructor(readonly cents: number) {} static of(cents: number): Money { return new Money(cents); } }',
      ),
      errors: [{ messageId: 'notValueObject', data: { className: 'Money' } }],
    },
    {
      ...classes(
        MONEY,
        `${KERNEL}\nexport class Money extends ValueObject<MoneyProps> { constructor(props: MoneyProps) { super(props); } static of(cents: number): Money { return new Money({ cents }); } }`,
      ),
      errors: [{ messageId: 'publicConstructor', data: { className: 'Money' } }],
    },
    {
      ...classes(
        MONEY,
        `${KERNEL}\nexport class Money extends ValueObject<MoneyProps> { private constructor(props: MoneyProps) { super(props); } }`,
      ),
      errors: [{ messageId: 'noFactory', data: { className: 'Money' } }],
    },
    {
      ...classes(
        MONEY,
        `${VALUE_OBJECT}\nexport function zero(): Money { return Money.of(0); }\nexport const ZERO = { cents: 0 } as const;`,
      ),
      errors: [
        { messageId: 'exportedFunction', data: { name: 'zero' } },
        { messageId: 'exportedLiteral', data: { name: 'ZERO' } },
      ],
    },
    {
      ...classes(MONEY, `${VALUE_OBJECT}\nexport { zero };\nfunction zero(): Money { return Money.of(0); }`),
      errors: [{ messageId: 'exportedFunction', data: { name: 'zero' } }],
    },
    {
      ...classes(MONEY, `${VALUE_OBJECT}\nconst zero = (): Money => Money.of(0);\nexport { zero };`),
      errors: [{ messageId: 'exportedFunction', data: { name: 'zero' } }],
    },
    {
      ...classes(MONEY, `${VALUE_OBJECT}\nexport const zero = function (): Money { return Money.of(0); };`),
      errors: [{ messageId: 'exportedFunction', data: { name: 'zero' } }],
    },
    {
      ...classes(MONEY, `${VALUE_OBJECT}\nexport const ZERO = { cents: 0 };`),
      errors: [{ messageId: 'exportedLiteral', data: { name: 'ZERO' } }],
    },
    {
      ...classes(MONEY, `${VALUE_OBJECT}\nexport const ZERO = ({ cents: 0 });`),
      errors: [{ messageId: 'exportedLiteral', data: { name: 'ZERO' } }],
    },
    {
      ...classes(MONEY, `${VALUE_OBJECT}\nexport const ZERO = { cents: 0 } satisfies MoneyProps;`),
      errors: [{ messageId: 'exportedLiteral', data: { name: 'ZERO' } }],
    },
    {
      ...classes(MONEY, `${VALUE_OBJECT}\nexport default { cents: 0 };`),
      errors: [{ messageId: 'exportedLiteral', data: { name: 'default' } }],
    },
    {
      ...classes(
        MONEY,
        `${VALUE_OBJECT}\nexport class InvoiceMoney extends ValueObject<MoneyProps> { static of(): InvoiceMoney { return new InvoiceMoney({ cents: 0 }); } }`,
      ),
      errors: [{ messageId: 'secondClass', data: { className: 'InvoiceMoney' } }],
    },
    {
      ...classes(SHARED, PLAIN),
      errors: [{ messageId: 'noClass' }, { messageId: 'exportedFunction' }],
    },
  ],
});
