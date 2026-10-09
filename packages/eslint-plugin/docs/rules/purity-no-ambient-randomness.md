# ddd-ts-kit/purity-no-ambient-randomness

Architecture id: `purity/no-ambient-randomness`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/` and `application/` of a context, tests excluded.

## Why

An identifier drawn inside a rule cannot be predicted by a test nor replayed. Identifiers come from the `IdGenerator` port.

## Reported

- `Math.random`
- `crypto.randomUUID`, `getRandomValues`, `randomBytes`, `randomInt`, also imported by name from `node:crypto`
- an import of `uuid`, `nanoid`, `ulid`, `ulidx`, `cuid`, `@paralleldrive/cuid2`, `ksuid`, `shortid`, `uuidv7`, `hyperid`, `bson`

Incorrect:

```ts
import { v4 } from 'uuid';
const id = crypto.randomUUID();
```

Correct:

```ts
const invoice = Invoice.create(this.ids.next(), this.clock.now());
```

## Options

None.

`rules."purity/no-ambient-randomness"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line purity/no-ambient-randomness -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A wrapper around the forbidden access (a helper of the platform that calls `Date.now()`) is not seen here; the layer rules stop the import of that helper.
- A local declaration that shadows the global (`const process = ...`) is not reported.

## With the CLI checker

`ddd-ts-kit check` looks for the same tokens with regular expressions. This rule is the authority: it knows a shadowed name from the global, and code from a string.
