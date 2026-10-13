# ddd-ts-kit/domain-value-object-class

Architecture id: `domain/value-object-class`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: the value object files, `domain/value-objects/*` of a context and the `*.vo.ts` of the
shared kernel outside its `presentation/`, and every other file of `domain/` of a context, specs
aside.

## Why

A value of the model is a class extending `ValueObject` of `@ddd-ts-kit/kernel`, never a function
that builds a plain object. The class gives what the function cannot:

- **equality without identity**: `equals` compares the props, two equal values are interchangeable;
- **invariants checked once**: the constructor is private, the static factory is the only way in,
  so a value that exists is a valid one and no caller validates it again;
- **behaviour next to the data**: `add`, `overlaps`, `isWithin` are methods of the type they
  concern, not helpers repeated wherever two fields meet;
- **refusals from static factories**: `Money.of(..)` throws (or returns) the refusal of the concept,
  `InvoiceError.invalidAmount(..)`;
- **immutability**: the props are frozen, an operation returns a new instance;
- **`instanceof` in the boundary mappers**: a mapper or a serializer recognises the value and
  writes it, which a structural object never allows.

## Reported

In a value object file:

- no exported class, or a second one;
- an exported class that extends neither `ValueObject` nor another value object of the project
  (a class of the same file that does, or a class imported from a value object file);
- a public constructor, declared without `private` or `protected` (a class that declares none
  inherits the protected constructor of `ValueObject`);
- a concrete class without a static method that is not private: nothing can build it;
- an exported function, an exported constant bound to an arrow or a function expression, and an
  exported object literal (`as const` and `satisfies` included).

The exported types and interfaces of its props are allowed.

Anywhere else in `domain/`: an exported function, declared or bound to a constant, that answers
an object literal holding data, in the expression of an arrow or in a `return` of its own body.
An object literal of functions only (`{ isSatisfiedBy: (..) => .. }`) is behaviour, a
specification or a strategy, and is not reported; neither is what a callback nested in the
function returns.

Incorrect:

```ts
// domain/value-objects/money.vo.ts
export type Money = { readonly amount: number; readonly currency: string };

export const money = (amount: number, currency: string): Money => ({ amount, currency });
```

Correct:

```ts
// domain/value-objects/money.vo.ts (npx ddd-ts-kit generate value-object billing Money)
import { ValueObject } from '@ddd-ts-kit/kernel';

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
}
```

## Details

What is not reported in `domain/`: a domain service (a class), a state machine
(`export const lifecycle = defineStateMachine({ .. })`, a call), a vocabulary (an exported object
`as const`, not a function), a specification answering a boolean or an object of functions, and a
function that takes and returns value objects (`Money.of(..)`, `new Slot(..)` are not object
literals).

## Options

None.

`rules."domain/value-object-class"` in `ddd-ts-kit.config.json` set to `off` silences the rule,
and `// ddd-ts-kit-disable-next-line domain/value-object-class -- <reason>` silences one line,
exactly as for `ddd-ts-kit check`.

## Limits

- A function is judged by the object literals it answers itself: one that builds the object in a
  variable first (`const value = { .. }; return value;`) is not followed.
- A superclass imported from a value object file is trusted: that file is judged on its own.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files, with the same table of files.
