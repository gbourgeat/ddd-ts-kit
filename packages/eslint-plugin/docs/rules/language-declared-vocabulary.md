# ddd-ts-kit/language-declared-vocabulary

Architecture id: `language/declared-vocabulary`. Default severity: `error`.

Applies to: every source under the source root; tests, published languages and the file that declares a value excluded.

## Why

A status, a kind, a role or a permission is a word of the language whose values are a closed list. Spelled again as a string wherever it is compared, granted or stored, each copy can drift: a typo compiles, a renamed value leaves its old spelling behind, and nothing completes it in the editor. Declared once, it is read by its key, completed by the editor, and a parameter typed with it accepts nothing else. The value stays the same string on the wire and in the database.

## Reported

A string literal, or a template literal without substitution, whose value is a value of a closed vocabulary the project declares:

- an object `as const` of string values exported next to the union type of the same name, `export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus]` (what `ddd-ts-kit generate vocabulary` writes, and the `Role` of the platform);
- a permission set, `export const billingPermissions = definePermissions('billing', { 'invoice.issue': .. })`, which declares the id `billing:invoice.issue`.

Incorrect:

```ts
if (appointment.status === 'no-show') {
  grants.push('billing:invoice.issue');
}
```

Correct:

```ts
if (appointment.status === AppointmentStatus.NoShow) {
  grants.push(billingPermissions['invoice.issue']);
}
```

## Details

A quoted key is a value spelled again and is reported: write it as a computed key, `[AppointmentStatus.NoShow]: 'No show'`, which also types the object by the vocabulary. An identifier key and the specifier of an import or an export are names and are not judged. A test spells the values a client sends on purpose, and a published language names the values of its contract itself: neither is judged. The message names the vocabulary, the file that declares it and what to write instead.

## Options

None.

`rules."language/declared-vocabulary"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line language/declared-vocabulary -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The vocabularies are read from the files of the source root on disk, again once a reading is five seconds old: an editor sees a new value after a few seconds, a lint run reads the project about once.
- The declaration is read by its text: an object whose values are not all string literals, or without the union type of its name, declares nothing.
- A value two vocabularies share is reported with both: the message names each and what to write for each.

## With the CLI checker

`ddd-ts-kit check` holds the same rule on the text of the files of the project, with the same declarations and the same exemptions.
