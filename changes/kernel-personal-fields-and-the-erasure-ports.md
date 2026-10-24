**The kernel declares the personal fields of a table and erases a data subject end to end: the
key, every copy in every tenant, the rebuilds.** `personalFields(table, { subject, fields,
erasure, files? })` says, next to the mapper, which columns of a table are personal, whose they
are and how the rows of a subject are erased, `row` deleted or `pseudonymise` read as `[erased]`,
the files they name deleted from the storage. Two ports a context extends and names, as it extends
`Repository`: `PersonalDataErasure` (`erase(subject)` answers the rows reached, none the second
time) and `PersonalDataExport` (`exportOf(subject)` answers one `PersonalDataRecord` per row,
each personal column as plain data). `eraseDataSubject`, lifted from the scheduling example,
destroys the key, erases every copy in every tenant (`inEachTenant` runs a copy in the context of
the work given each tenant, since a write of tenant data is never widened), rebuilds the
projections fed by the store, and reports `{ erased, copies, rebuilt }`; a copy that fails does
not stop the others, and running the erasure again completes it; a subject that is not an opaque
identifier is refused before any key is touched, and an id nothing is left of is refused before
the rebuilds. `InMemoryPersonalData` implements both ports over one declaration, and
`personalDataErasureContract` and `personalDataExportContract` of `@ddd-ts-kit/testing` hold it
and every adapter to the same behaviour. The adapters of the persistence packages, the platform
folder `init` writes and the register come with the next parts of
[privacy by design](../docs/proposals/privacy-by-design.md). The persistence skill says it.
