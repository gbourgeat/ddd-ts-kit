# ddd-ts-kit/clean-file-size

Architecture id: `clean/file-size`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every linted file, tests included.

## Why

A file that does not fit in one sitting holds more than one responsibility: two classes that grew together, a function and the helpers of another one, a spec that tests three behaviours. The limit is a signal to split by responsibility, not a number to reach.

## Reported

- a file of more than 350 lines: every physical line counts, comments and blank lines included; a final newline adds none

Incorrect:

```ts
// invoice.aggregate.spec.ts: 600 lines, issuing, paying and voiding in one file
```

Correct:

```ts
// invoice-issuing.spec.ts, invoice-payment.spec.ts, invoice-voiding.spec.ts: one behaviour each
```

## Details

The finding is reported once, on line 351. Declaration files (`*.d.ts`) and any file under a directory named `generated` are exempt: nobody reads them in one sitting, and nobody writes them.

## Options

None: the limit is 350 lines and is not configurable.

`rules."clean/file-size"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/file-size -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The rule says that a file is too long, not where to cut it: split by responsibility, and name each file after what it holds (`clean/one-export-per-file`).

## With the CLI checker

`ddd-ts-kit check` reports the same id with the same count. Both tools agree.
