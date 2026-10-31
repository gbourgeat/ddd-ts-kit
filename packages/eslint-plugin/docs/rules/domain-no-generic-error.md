**English** · [Français](domain-no-generic-error.fr.md)

# ddd-ts-kit/domain-no-generic-error

Architecture id: `domain/no-generic-error` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/` and `application/` of a context, tests excluded.

## Why

An expected business failure has a name and a stable code that presentation maps to a status in one place. `new Error("...")` gives the caller a sentence to parse.

## Reported

- `throw new Error(...)` and `throw Error(...)`
- the other errors of the language: `TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`, `EvalError`, `URIError`, `AggregateError`
- one of them thrown through a `const` (`const failure = new Error('x'); throw failure;`) or built under a `const` alias of its class (`const Failure = Error`)

The message names the step that writes the refusal in the form of the project: `generate error <context> <Refusal> for<Subject>` under `"stack.refusals": "named"`, `generate error <context> <Concept> <refusal>` under `factories` and `classes`.

Incorrect:

```ts
throw new Error('Invoice already issued');
```

Correct:

```ts
throw new InvoiceAlreadyIssued(this.id);
```

## Options

None.

`rules."domain/no-generic-error"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line domain/no-generic-error -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- An error built under a `let`, passed as a parameter or returned by a function before it is thrown is not followed.
- A generic error returned in a `Result` (`err(new Error())`) or rejected (`Promise.reject`) is not seen.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because the shape of a class needs a syntax tree.
