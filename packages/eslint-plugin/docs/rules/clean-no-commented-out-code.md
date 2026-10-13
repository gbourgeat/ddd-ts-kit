**English** · [Français](clean-no-commented-out-code.fr.md)

# ddd-ts-kit/clean-no-commented-out-code

Architecture id: `clean/no-commented-out-code`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every linted file.

## Why

Code in a comment does not run, is not type-checked and is never deleted. Version control keeps the old version.

## Reported

- a `//` paragraph or a `/* */` block whose text parses as statements, as a function body or as class members, and holds a declaration, a control statement, a call or an assignment
- an opening line left alone (`if (x) {`, `items.forEach((item) => {`)

Incorrect:

```ts
// const total = lines.reduce(add, 0);
// if (invoice.isPaid()) {
//   return;
// }
```

Correct:

```ts
// The vendor rounds half up (contract 4.2), so we round before summing.
```

## Details

The comment body is given to the parser configured for the file, so TypeScript syntax is understood. Prose is filtered before and after parsing: a sentence of plain words, a lone identifier, a label (`note: ...`), a type expression, `name (unit)`, a `TODO`, a URL and tool directives are never code. JSDoc blocks are skipped: their `@example` and fenced samples are documentation.

## Options

None.

`rules."clean/no-commented-out-code"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/no-commented-out-code -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A one-line call such as `// validate(input);` is reported even when it was meant as a mention: quote it in backticks inside a sentence.
- Code written as a sentence, or without any punctuation of code (`return value`), is not seen.

## With the CLI checker

`ddd-ts-kit check` approximates this rule on the text of the file, with the same exemption of JSDoc blocks, and stays the fast edit-time guard. This rule is the authority.
