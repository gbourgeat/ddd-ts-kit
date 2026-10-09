# ddd-ts-kit/domain-value-object-immutability

Architecture id: `domain/value-object-immutability` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/value-objects/` of a context, tests excluded.

## Why

A value object is its value. If it can change, two holders of the same instance disagree about what they hold, and equality by value stops meaning anything.

## Reported

- a property or constructor parameter property without `readonly` (private and `#private` included)
- a `set` accessor
- outside the constructor, an assignment or an increment that starts at `this` (`this.props.cents += 1`)
- outside the constructor, an array mutator called on something of `this` (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`)

Incorrect:

```ts
export class Amount {
  constructor(private cents: number) {}
  add(other: Amount): void {
    this.cents += other.cents;
  }
}
```

Correct:

```ts
export class Amount extends ValueObject<AmountProps> {
  add(other: Amount): Amount {
    return new Amount({ cents: this.props.cents + other.props.cents });
  }
}
```

## Options

None.

`rules."domain/value-object-immutability"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line domain/value-object-immutability -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- Deep immutability of what a property holds (`readonly items: string[]`) is not checked: prefer `readonly string[]`.
- `Map`, `Set` and object mutation through method calls is not seen.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because the shape of a class needs a syntax tree.
