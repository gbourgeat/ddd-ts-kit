# ddd-ts-kit/domain-aggregate-encapsulation

Architecture id: `domain/aggregate-encapsulation` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/aggregates/` and `domain/entities/` of a context, tests excluded.

## Why

An aggregate guards its invariants. A public constructor lets anyone build an invalid one, a public mutable property or a setter lets anyone change it without the rule that should have run.

## Reported

- a public constructor (abstract classes are exempt)
- a class without constructor and without base class
- a public property that is neither `readonly` nor a method, including `public` constructor parameter properties and `accessor` fields
- a public `set` accessor, and a public `setX` method whose body only assigns to `this`

Incorrect:

```ts
export class Invoice {
  constructor(public status: string) {}
  setStatus(status: string): void {
    this.status = status;
  }
}
```

Correct:

```ts
export class Invoice extends AggregateRoot<string> {
  private constructor(id: string, private state: InvoiceState) {
    super(id);
  }
  static create(id: string, now: Date): Invoice {
    return new Invoice(id, { createdAt: now });
  }
  issue(at: Date): void {
    this.state = { ...this.state, issuedAt: at };
    this.record(new InvoiceIssued(this.id, at));
  }
}
```

## Details

A class that extends another one and declares no constructor inherits the visibility of its base: `AggregateRoot` and `Entity` of the kernel are protected.

## Options

None.

`rules."domain/aggregate-encapsulation"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line domain/aggregate-encapsulation -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The visibility of an inherited constructor is not checked (no type information is used).
- A `setX` method that does anything besides assigning is trusted to be an intention.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because the shape of a class needs a syntax tree.
