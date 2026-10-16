**English** · [Français](language-declared-vocabulary.fr.md)

# ddd-ts-kit/language-declared-vocabulary

Architecture id: `language/declared-vocabulary`. Default severity: `error`.

Applies to: every source under the source root of a project whose config says `"stack.literals": "named"`, which `init` writes (a config that does not say, as before 0.6, keeps the rule silent); tests, published languages, the relationship schema of the access model and the file that declares a value excluded.

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

## Where a value is judged

A word means one thing in one context, and may mean something else next door; the rule follows the language of each place.

| Declared in | Judged in |
|---|---|
| a context (`domain/vocabularies/` of `billing`) | that context only: `issued` in `catalog` is another word |
| the platform (the `Role` of `<platformDir>/auth/role.ts`) | the platform, and the route groups `*.routes.ts` of the contexts, where a guard names a role |
| the shared kernel | everywhere |
| a permission set (`definePermissions`) | everywhere: a permission id names one permission of one context |

## Details

A quoted key is a value spelled again and is reported: write it as a computed key, `[AppointmentStatus.NoShow]: 'No show'`, which also types the object by the vocabulary. An identifier key and the specifier of an import or an export are names and are not judged. In the persistence of a context (`infrastructure/persistence/`), the name of a column, a table or a schema is a word of the storage and is not judged: the first argument of a call (`text('note')`, `createTable('invoice')`, `.where('note', ..)`) and the value of `name`, `tableName` or `schema`; a stored value, the argument of `.default(..)` or a value compared in a query, is. A test spells the values a client sends on purpose, and a published language names the values of its contract itself: neither is judged. The message names the vocabulary, the file that declares it and what to write instead.

## Options

None.

`rules."language/declared-vocabulary"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line language/declared-vocabulary -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The vocabularies are read from the files of the source root on disk, again once a reading is five seconds old: an editor sees a new value after a few seconds, a lint run reads the project about once.
- The declaration is parsed: an exported `const` whose value is an object `as const` (or `as const satisfies ..`), each entry a key (a name or a quoted string) and a string literal, in either quote, comments allowed, next to `export type X = (typeof X)[keyof typeof X]` written that way. An object with a number, a spread, a method or a computed entry, or without that union type, declares nothing. `generate vocabulary` writes the form that is read.
- A value of the platform is matched by its value in every file of the platform: with the `Role` of an rbac project, `actor.type === 'system'` in the platform is reported although it compares a kind of actor, not a role. Declare that word in its own vocabulary (`ActorType.System`) and read it there, or silence the line with its reason.
- A value two vocabularies share is reported with both: the message names each and what to write for each.

## With the CLI checker

`ddd-ts-kit check` holds the same rule on the text of the files of the project, with the same declarations and the same exemptions.
