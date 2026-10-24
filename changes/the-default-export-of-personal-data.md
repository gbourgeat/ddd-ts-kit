**The right of access and to portability comes built in: `KnexPersonalDataExport`,
`DrizzlePersonalDataExport`, `PrismaPersonalDataExport` and `TypeOrmPersonalDataExport` read the same
`personalFields` declarations as the erasure, `exportDataSubject` of the kernel gathers every export
into one dated document, `auditedPersonalDataExport` of the audit package leaves the entry of each
handover, and `generate repository --personal` writes the export of a context beside its erasure.**
Each adapter answers one `PersonalDataRecord` per row about the subject in every declared table, under
`<name>.<table>`, with the personal columns and the keys of the files as plain data, no other column
and nothing of anyone else; the same `tenant` option confines every statement to the tenant of the
work, a subject that is not an opaque identifier is refused before any statement, and each passes
`personalDataExportContract`, whose `source` now reads the name of the exporter alone or followed by
the table. `exportDataSubject(subject, { exports, inEveryTenant, clock, isKnown })` answers a
`PersonalDataExportDocument`: `format` (`ddd-ts-kit/personal-data-export@1`), `subject`, `exportedAt`,
`records`; the exports run in the order listed and one that fails stops the gathering, a mistyped id
is refused when `isKnown` denies it rather than answered with an empty document, and
`recordsInEachTenant(scope, tenants)` reaches every tenant as `inEachTenant` does for an erasure
(both over `eachTenant`). `auditedPersonalDataExport(port, trail, { scope, clock, ids })` wraps a
port so that every `exportOf` writes an entry of category `data-access` and action
`personal-data:export` (`PERSONAL_DATA_EXPORT_ACTION`), with the subject as resource, the context,
the number of records and never the values, before the records are handed over: when the entry
cannot be written, nothing is handed over. In a generated project, `src/platform/privacy/run-export.ts`
runs `exportDataSubject` over the exports, each wrapped when the trail is on, and
`scripts/privacy-export.ts` prints the document as JSON; `generate repository <ctx> <Aggregate>
--personal <column>,...` writes, once per context, the export port (`extends PersonalDataExport`),
the adapter over `<Orm>PersonalDataExport`, its fake and its line in `data-subject-exports.ts`, bound
where the context binds its adapters, and one spec `test/integration/<context>-personal-data.spec.ts`
proves the erasure and the export; a second table joins the declarations of both adapters, and
`init --force` lists the exports again. The concept page draws the export end to end with its
diagram, in both languages, and the kernel, audit, ORM and CLI READMEs, the audit trail page, the
proposal and the skills say it.
