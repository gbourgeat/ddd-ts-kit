**`ddd-ts-kit docs` writes the register of personal data from the code: a Personal data section in
each `CONTEXT.md`, and with `--privacy on` the file `docs/privacy/register.md`, held to the code by
`docs --check`.** It reads every `personalFields` call of `infrastructure/persistence/*.personal-fields.ts`,
the one `generate repository --personal` writes or one written by hand (several per file), and the
`personal` option of the integration events. Each table is one row: the column that names the
person, the personal columns and files, what an erasure does (`pseudonymised`, `row deleted`), how
long the rows are kept (`36 months after ended_at`, or `until erased`); the columns are named as the
database names them on the four ORMs, a Drizzle or TypeORM declaration read back through the table it
names. The register adds the integration events that carry personal data and the contexts
downstream of their producer. It is not the record of processing activities of GDPR article 30:
the purposes, the lawful basis, the recipients outside the system and what the code does not purge
are sections around the markers that the controller writes and `docs` keeps.

To move: nothing to do. The next `npx ddd-ts-kit docs` (or `generate`) of a project with
`stack.privacy: "on"` creates `docs/privacy/register.md`, and adds the Personal data section to the
`CONTEXT.md` of each context that declares personal data; commit both, `docs --check` holds them
from then on.
