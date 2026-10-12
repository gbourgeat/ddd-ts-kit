# ddd-ts-kit/event-sourcing-projection-never-appends

Architecture id: `event-sourcing/projection-never-appends`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `application/projections/` of a context, and any file of a context that declares a class with `@Projection`, tests excluded.

## Why

A projection turns facts into a read model and is replayed from position zero at every rebuild. One that appends to a stream would append again at each rebuild, and makes the read side decide facts.

## Reported

- an import of `EventStore` or `EventSourcedRepository` from `@ddd-ts-kit/kernel`
- an import of anything of `domain/repositories/`

Incorrect:

```ts
constructor(private readonly history: AttendanceHistory, private readonly records: AttendanceRecordRepository) {}
```

Correct:

```ts
@Projection('scheduling.attendance-history', { feed: 'event-store' })
export class AttendanceHistoryProjection {
  constructor(private readonly history: AttendanceHistory) {}
}
```

## Options

None.

`rules."event-sourcing/projection-never-appends"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line event-sourcing/projection-never-appends -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- An aggregate reached through a port of `application/ports/` is not recognised.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the import statements and the text `@Projection(`.
