**English** · [Français](clean-no-noise-comment.fr.md)

# ddd-ts-kit/clean-no-noise-comment

Architecture id: `clean/no-noise-comment`. Default severity: `warn` in `recommended`, `error` in `strict`.

Applies to: every linted file.

## Why

A comment is kept for what the code cannot say: why, a consequence, an external reference. Anything else is a second, unmaintained copy of the code.

## Reported

- a banner (`// ----- helpers -----`)
- a label after a closing brace (`} // end if`)
- an author, a date or a change journal
- `@param name` or `@returns` without description
- a `TODO` or `FIXME` without owner (`TODO(owner)`) nor reference (`#123`, `ABC-12`, a URL)
- a comment or JSDoc description that only repeats the name declared below it

Incorrect:

```ts
/** The invoice repository. */
export class InvoiceRepository {}

// TODO fix this
```

Correct:

```ts
/** Loads by number as well: support looks invoices up by what the customer reads. */
export class InvoiceRepository {}

// TODO(billing#142): retry with backoff
```

## Details

"Repeats the name" compares words with a small English inflection (`Issues the invoice` says `issueInvoice`), ignoring filler words.

## Options

None.

`rules."clean/no-noise-comment"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/no-noise-comment -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- Heuristics on wording: a short description made of the words of the name plus filler is flagged even if the author found it useful.
- Only the comment directly above a declaration is compared with a name.

## With the CLI checker

`ddd-ts-kit check` approximates this rule on the text of the file and stays the fast edit-time guard. This rule is the authority.
