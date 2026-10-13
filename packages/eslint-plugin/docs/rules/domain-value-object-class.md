# ddd-ts-kit/domain-value-object-class

Architecture id: `domain/value-object-class`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: a project whose config says `"stack.values": "classes"`, which `init` writes (a
config that does not say is `free`, and the rule is silent: [CONFIG.md](../../../../docs/CONFIG.md#stack)
gives the steps to move). There, the value object files, `domain/value-objects/*` of a context
and the `*.vo.ts` of the shared kernel outside its `presentation/`, and every other file of
`domain/` of a context and of the shared kernel outside its `presentation/`, specs aside.

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
  exported object literal (parenthesized, `as const` and `satisfies` included), whether exported
  inline, by an export list (`export { zero }`) or by default.

The exported types and interfaces of its props are allowed.

In the other files of `domain/` and of the shared kernel: an exported function (declared, bound
to a constant, exported by a list or by default) that answers a **record of data**, in the
expression of an arrow or in a `return` of its own body. Each entry of the object literal is
read for what it holds:

| Entry | Reads as | Examples |
|---|---|---|
| a literal, a parameter, an operation on them, a call of the language | data | `amount`, `'EUR'`, `cents * 100`, `Math.round(cents)`, `new Date(at)` |
| any other call or `new`, or a name bound to one in the module | built by the model | `Money.of(1)`, `total.add(tax)`, `new Slot(..)` |
| a function, a method, or a name bound to one in the module | behaviour | `isSatisfiedBy: (x) => ..`, `describe() {}`, `{ isSatisfiedBy }` |
| `...state` | derived | `{ ...state, status }` |

The object is a record of data, and the function is reported, when it holds data, nothing built
by the model and no spread. A function that declares a return type of a package
(`): EventStamp` of the kernel) is not judged: the shape is the library's.

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

What is not reported:

```ts
// a state machine: the result of a call, not a function
export const invoiceLifecycle = defineStateMachine({ states: ['draft', 'issued'] /* .. */ });

// a domain service: a class
export class InvoiceTotalService {
  total(lines: readonly Money[]): Money { /* .. */ }
}

// a specification: a boolean, or functions only, literal or local closures
export const isOverdue = (invoice: Invoice, now: Date): boolean => invoice.dueAt < now;
export const dueBefore = (day: Date) => {
  const isSatisfiedBy = (invoice: Invoice): boolean => invoice.dueAt < day;

  return { isSatisfiedBy };
};

// an operation of the model: value objects it builds
export const split = (total: Money) => ({ first: Money.of(1), rest: total.subtract(Money.of(1)) });

// a reducer: derives a record that exists
export const evolve = (state: InvoiceState, status: string): InvoiceState => ({ ...state, status });
```

What is reported, and decided so:

```ts
// a decision answered as a record: throw the refusal from a factory
// (`throw InvoiceError.refused(reason)`), or make it a value object (`Decision.refused(reason)`)
export const decide = (reason: string) => ({ kind: 'refused' as const, reason });

// a record of data with closures: a value with behaviour, which is a class
export const money = (cents: number) => ({ cents, doubled: (): number => cents * 2 });

// a record that only gathers parameters, value objects included: a pair that means something
// is a value with a name
export const period = (start: Instant, end: Instant) => ({ start, end });
```

## Options

None.

`rules."domain/value-object-class"` in `ddd-ts-kit.config.json` set to `warn` or `off` relaxes the
rule, and `// ddd-ts-kit-disable-next-line domain/value-object-class -- <reason>` silences one
line, exactly as for `ddd-ts-kit check`. The rule defaults to `error`: relaxing it is a deviation,
recorded under `deviations` with the ADR that says why and until when
(`governance/recorded-deviation`). A project not ready for the rule keeps `"stack.values": "free"`
instead, which records nothing.

## Limits

The rule reads the text and the syntax of one file, without the types. What it does not follow:

- an object built in a variable first, then returned (`const value = { .. }; return value;`);
- an object answered through a condition (`cond ? { .. } : { .. }`), inside an array, or as the
  argument of a call;
- a name is resolved by its first declaration in the module, whatever its scope: a parameter
  named like a function of the module reads as that function;
- a call is read by the name it starts from: `name.trim()` on a parameter reads as built by the
  model, so a record holding it is not reported;
- the package exemption reads the name the declared return type starts with, not an inferred one;
- a superclass imported from a value object file is trusted: that file is judged on its own.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files, with the same table of files.
