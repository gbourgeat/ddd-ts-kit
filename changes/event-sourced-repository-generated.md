**`generate repository` on an event-sourced aggregate writes the adapter over `EventSourcedRepository`, not a table.**
When the class of the aggregate extends `EventSourcedAggregate`, `generate repository` (and the
first `generate command --aggregate` that needs one) writes `event-store-<name>.repository.ts`,
which delegates to `EventSourcedRepository` of the kernel over the `EventStore` and the
`PersonalDataCipher` the platform binds, with the codec of `<name>-events.mapper.ts` and its
snapshot policy left as a `TODO(domain)`; no table, no row mapper. The fake is that adapter over
the in-memory stores, and the repository contract runs on the fake and on the adapter over
`InMemoryEventStore`, its stale-save case pending until a `mutate` that records an event is added. It is bound where the project
binds its adapters (the declarations, the module of the context, or the hand-written platform).
The event store keeps no tenant, so `--tenant-scoped` changes nothing and the note says who
decides who may load an id; `--personal` is refused, the personal values being sealed in the
events. A project that deleted the table adapter and wrote this one by hand can regenerate it
and compare.
