**The scheduling example erases a person from every copy the contexts keep, not from the sealed
words alone.** `npm run erase:patient` destroyed the key the words of a patient were sealed with
and rebuilt the projections, and left the person named and reachable in the tables: the person of
`identity` (name and address), the contact of `notification`, the notes the staff wrote on their
appointments, the reasons of their cancellations, the documents attached to those appointments and
the name the practitioner directory of `scheduling` copied. The erasure now reaches each of them,
network by network (`NETWORKS`), after the key and before the rebuilds: `identity` forgets the
person (`PersonRepository.erase`), `notification` deletes the contact, `scheduling` replaces the
notes and the reasons by `[erased]` and deletes the documents from the file storage
(`KnexPatientErasure`). The report of the script counts the rows each copy reached; a copy that
fails does not stop the others and running the script again completes the erasure; a run again
once nothing is left is refused and recorded. The README of the example says what an erasure does
not reach: the events published before it, the backups, the opaque ids of the audit trail. The
first part of the proposal [privacy by design](../docs/proposals/privacy-by-design.md) built; the
hand-written steps are the specification of the erasure port the next parts bring to the kit.
