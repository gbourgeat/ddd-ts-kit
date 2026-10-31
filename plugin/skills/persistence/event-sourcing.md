# Event sourcing: an aggregate stored as its events

Read under `stack.eventSourcing: on`, before writing an event-sourced aggregate, its stored
events or the erasure of its personal values. When to choose it, what it costs, the versioning
of stored events, crypto-shredding and the projections are in `docs/concepts/event-sourcing.md`
of the kit; what follows is what a session writes.

- Chosen per aggregate, `generate aggregate ... --event-sourced`, refused without
  `stack.eventSourcing: on`. `init --event-sourcing on` wires the stores
  (`persistence.eventSourcing`, schema `event_store`) and `src/platform/event-sourcing/`: the
  keys, wrapped by `auditedSubjectKeys` of `@ddd-ts-kit/audit` when the audit trail is on so that
  every erasure leaves a dated audit entry, and the cipher.
- The aggregate keeps the same port; its adapter delegates to `EventSourcedRepository` over the
  `EventStore` of the ORM package (`create<Orm>EventSourcing`).
- Its stored events are declared in `<aggregate>-events.mapper.ts` with a named data type, and a
  change of that type is a new version with its upcaster (`event-sourcing/*`).
  `ddd-ts-kit docs --stored-events` records a version once its shape is final, and
  `docs --check` fails while one is unrecorded.
- Personal values are sealed per data subject (`personalData`, `PersonalDataCipher`); erasing
  one destroys its key in the `SubjectKeyStore`, then rebuilds the projections that hold a clear
  copy. An event-sourced context has no erasure handler: the key destroyed erases its sealed
  values. The erasure of the tables beside it is in [personal-data.md](personal-data.md).
  `decode` reads a sealed value with `data.personalText`, `data.personalInstant` or
  `data.personal(field, ValueObject.of)`, which answer `undefined` once the subject is erased:
  a date or a value object read otherwise refuses `[erased]` and the aggregate no longer loads.
- Keep the keys in a store of their own in production, with a shorter backup retention than the
  events.
