**`ddd-ts-kit check` holds a project whose `stack.privacy` is `on` to its declarations of personal
data, with five new rules, all warnings: `privacy/declared-field`, `privacy/event-payload-declared`,
`privacy/erasure-reaches-copies`, `privacy/subject-is-opaque` and `privacy/no-personal-data-in-logs`.**
The erasure, the export, the retention and the register read the `personalFields` declarations and
the `personal` option of the integration events, never the columns: a copy of a person nobody
declared is a copy nobody erases, and nothing failed until now.

- `privacy/declared-field`: a column of a table of a context (Knex, Drizzle, TypeORM, and the Prisma
  models in the schema of the context) whose name holds a word of the personal vocabulary and that
  no declaration of its context names.
- `privacy/event-payload-declared`: a field of the payload of an integration event named like
  personal data that its `personal` option does not list.
- `privacy/erasure-reaches-copies`: a context that consumes an event carrying personal data (a
  handler, a projection, a process manager) and declares no `PersonalDataErasure` and handles no
  `privacy.data-subject.erased`.
- `privacy/subject-is-opaque`: the subject of a declaration or of an event that is personal data
  itself, or one of its personal fields.
- `privacy/no-personal-data-in-logs`: a call to the logger or to the metrics that names a declared
  personal field.

The identity preset declares what it keeps of people when `stack.privacy` is `on`: the address and
the name of an account (pseudonymised when the person is erased) and the address an invitation was
sent to (the row deleted thirty days after the invitation expired, by the nightly purge), with the
erasure and the export of the context written and listed in the platform, not confined to a tenant
since its tables belong to none.

The vocabulary is the one of the kit (`email`, `phone`, `first_name`, `birth_date`, `address`,
`iban`, `ip_address` and the others listed in the configuration reference); the new config key
`privacy`, `{ "vocabulary": [...], "allow": [...] }`, adds the words of the business and removes a
word that never names a person in the project. A project with `stack.privacy` off, or whose config
predates the choice, is not judged.

To move: nothing blocks. `npx ddd-ts-kit check --rule privacy/declared-field` (and the four others)
lists what to take up: declare the column (`generate repository ... --personal`), list the field in
`personal: { subject, fields }`, erase the copy (`generate erasure-handler` for a service of its own),
or record a column that holds nothing of a person, `// ddd-ts-kit-disable-next-line
privacy/declared-field -- ADR-NNNN: <why>` or a word of `privacy.allow`. The rules become errors one
minor version later.
