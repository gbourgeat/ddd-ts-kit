**English** · [Français](domain-no-generic-error.fr.md)

# ddd-ts-kit/domain-no-generic-error

Architecture id: `domain/no-generic-error` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/` and `application/` of a context, tests excluded.

## Why

An expected business failure has a name and a stable code that presentation maps to a status in one place. `new Error("...")` gives the caller a sentence to parse.

## Reported

- `throw new Error(...)` and `throw Error(...)`

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

- Only the global `Error` is reported: `TypeError` and friends are left to review.
- A generic error returned in a `Result` (`err(new Error())`) or rejected (`Promise.reject`) is not seen.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because the shape of a class needs a syntax tree.
