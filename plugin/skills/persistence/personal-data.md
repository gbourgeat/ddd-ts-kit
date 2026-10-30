# Personal data: declared, erased, exported, purged

Read under `stack.privacy: on` (the default with an ORM) when a table keeps something of a
person, or when a `privacy/*` rule reports. What a generated project holds, the erasure and the
export end to end, the retention and the register are in `docs/concepts/personal-data.md` of the
kit, which draws both; what follows is the commands and the order a session needs.

## Declare it with the repository

```bash
npx ddd-ts-kit generate repository <ctx> <Aggregate> --personal <column>,... [--subject <column>] [--erasure pseudonymise|row] [--retention ended_at:36m] --json
```

What a table keeps of a person in clear is declared next to its mapper with `personalFields`
(the subject column, the personal columns, `row` or `pseudonymise`, the columns that hold a
file) and erased through a `PersonalDataErasure` port of the context
(`export abstract class PatientErasure extends PersonalDataErasure {}`). The command writes all
of it:

- the columns in the storage, and the declaration `<aggregate>.personal-fields.ts`, spelled as
  the erasure of the ORM reads it;
- once per context, the erasure and the export: the ports (`extends PersonalDataErasure`,
  `extends PersonalDataExport`), the adapters over `<Orm>PersonalDataErasure` and
  `<Orm>PersonalDataExport`, their fakes, one spec on the test database, and their lines in the
  copies and in the exports.

The adapter of a context extends the one of its ORM package (`KnexPersonalDataErasure`,
`DrizzlePersonalDataErasure`, `PrismaPersonalDataErasure`, `TypeOrmPersonalDataErasure`), given
the declarations, the scope for tenant data and the file storage. A personal column that is not
a text accepts null, or the rows are erased with `row`. `personalDataErasureContract` of
`@ddd-ts-kit/testing` holds the adapter and the fake (`InMemoryPersonalData`) to the same
behaviour.

## Erase and export

- A context lists its port in `src/platform/privacy/data-subject-copies.ts`, its export port in
  `data-subject-exports.ts` (`init --privacy on`, the default with an ORM, writes the folder and
  the scripts `privacy:erase` and `privacy:export`).
- `eraseDataSubject` of the kernel runs the key, every copy in every tenant (`inEachTenant`), the
  copies no tenant confines (`shared`) and the rebuilds, in that order. `npm run privacy:erase --
  <subject-id>` reaches them all, the key first when the project has an event store
  ([event-sourcing.md](event-sourcing.md)), then announces `privacy.data-subject.erased` through
  the outbox for the services that keep a copy (`generate erasure-handler <ctx>`, for a table). An
  id that reached nothing is refused and announced to nobody; `--rerun` says it is expected.
- The erasure also reaches what the platform keeps: the fields a `personal` option lists, in the
  records of the outbox (`personal-events.ts`, which `docs` writes), and the jobs enqueued with the
  person as `subject`. So a job about a person is enqueued with `{ subject: personId }`, its payload
  holds identifiers rather than a name or an email, and a personal field of an event is declared.
- `npm run privacy:export -- <subject-id>` hands over one dated document (`exportDataSubject`,
  `PersonalDataExportDocument`), each export wrapped by `auditedPersonalDataExport` when the
  trail is on, never the values in the entry.

## Retention

How long the rows keep the person goes on the same declaration, `retention: { after: 'ended_at',
months: 36 }` (`generate repository ... --retention ended_at:36m`): the job
`privacy.purge-expired` erases what outlived it every night, `npm run privacy:purge` by hand. A
period the project reads from configuration and purges by itself is not a literal: declare
`configuredRetention: 'RETENTION_PERIODS'` (the key, never the value, and never beside
`retention`) so the register says "configured by" it instead of "until erased".

## What the rules report

`privacy/declared-field` (a warning) reports a column named like personal data (`email`,
`phone`, `birth_date`, `address`... plus `privacy.vocabulary` of the config) that no declaration
of its context names, and `privacy/subject-is-opaque` a subject that is personal data itself:
declare the column, or record why it holds nothing of a person.
