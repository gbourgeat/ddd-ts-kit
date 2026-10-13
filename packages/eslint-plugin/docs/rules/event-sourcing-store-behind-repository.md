# ddd-ts-kit/event-sourcing-store-behind-repository

Architecture id: `event-sourcing/store-behind-repository`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/` and `application/` of a context, tests excluded.

## Why

The domain and the use cases see an event-sourced aggregate as they see any other: loaded by its repository port, changed by its methods, saved by the same port. A handler that reads a stream itself decides how events become state, which is the aggregate's job, and ties the use case to a storage technique.

## Reported

- an import of `EventStore`, `SnapshotStore`, `CheckpointStore`, `EventSourcedRepository`, `EventSerializer`, `CatchUpSubscription` or `InMemoryEventStore` from `@ddd-ts-kit/kernel`

Incorrect:

```ts
constructor(private readonly store: EventStore) {}
```

Correct:

```ts
constructor(private readonly records: AttendanceRecordRepository) {}
```

## Options

None.

`rules."event-sourcing/store-behind-repository"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line event-sourcing/store-behind-repository -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The store reached through a port of the project that wraps it is not recognised: the port is then the place to look at.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the import statements.
