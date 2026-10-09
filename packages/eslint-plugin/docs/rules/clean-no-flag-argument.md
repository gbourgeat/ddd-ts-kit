# ddd-ts-kit/clean-no-flag-argument

Architecture id: `clean/no-flag-argument`. Default severity: `warn` in `recommended`, `error` in `strict`.

Applies to: public methods of classes in `domain/`, and `execute` in `application/`; tests excluded.

## Why

A boolean parameter says that the method does two things. The call site reads `close(true)` and nobody knows what is true.

## Reported

- a parameter typed `boolean` (also `boolean | undefined`, optional) or defaulting to `true` or `false`

Incorrect:

```ts
class Invoice {
  close(force: boolean): void {}
}
```

Correct:

```ts
class Invoice {
  close(): void {}
  forceClose(reason: string): void {}
}
```

## Details

Classes named `...Command` or `...Query` are messages and carry data: they are exempt. Private methods and constructors are exempt.

## Options

None.

`rules."clean/no-flag-argument"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/no-flag-argument -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The type is read from the annotation, not inferred: `flag = isReady()` is not seen.
- Functions outside classes are not judged.
- Without a `ddd-ts-kit.config.json` layout (file outside a context) the rule is silent.

## With the CLI checker

`ddd-ts-kit check` approximates this rule on the text of the file and stays the fast edit-time guard. This rule is the authority.
