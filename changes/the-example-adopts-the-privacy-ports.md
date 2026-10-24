**The scheduling example declares what it keeps of people and erases and exports it through the
ports of the kit: `personalFields` in each context, a `PersonalDataErasure` and a
`PersonalDataExport` per context over the adapters of `@ddd-ts-kit/knex`, `eraseDataSubject` and
`exportDataSubject` of the kernel, and the register and the privacy rules on.** The persons of
identity and the contacts of notification are deleted, the notes, the cancellation reasons, the
documents and the copied names of scheduling pseudonymised; notification keeps its own erasure,
which deletes a contact under a stamp so that a redelivered announcement does not bring the address
back. The hand-written erasure engine of the example is gone, its platform folder is
`src/platform/privacy/`, `npm run erase:patient` becomes `npm run privacy:erase`, and `npm run
privacy:export` hands over one dated document of what every context keeps of a person, every
handover audited. `identity.person.registered` and `identity.practice.member-added` declare their
personal fields, so the event catalog and AsyncAPI say so; `docs/privacy/register.md` is generated,
with the sections a controller writes filled in as an illustration.

To move: nothing for a project. For a reader of the example: run `npm run privacy:erase` where
`npm run erase:patient` was run; the report names each copy by its context (`identity`,
`notification`, `scheduling`) and counts the rows reached.
