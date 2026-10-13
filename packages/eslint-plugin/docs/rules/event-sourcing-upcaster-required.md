**English** · [Français](event-sourcing-upcaster-required.fr.md)

# ddd-ts-kit/event-sourcing-upcaster-required

Architecture id: `event-sourcing/upcaster-required`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every source of a context that calls `defineStoredEvent(Event, { ... })`, tests excluded.

## Why

Stored events are never rewritten: an event stored years ago is read by today's code. The type of the data of a stored event is its contract with the past, so it is named and declared next to the codec, and a change of it is a new version read through an upcaster.

## Reported

- an `encode` whose return type is not a named type
- a named type not declared in the file
- a named type the data reaches (a field typed `SlotData`, an `extends`, a type argument) that the file does not declare, the kit's own `PersonalValue` aside: a change of it would change the stored shape and not its fingerprint
- a `version` above 1 without an upcaster from each version below it

Incorrect:

```ts
'scheduling.attendance-record.no-show-noted': defineStoredEvent(NoShowNoted, {
  version: 2,
  encode: (event) => ({ appointmentId: event.appointmentId, reason: event.reason }),
  decode,
}),
```

Correct:

```ts
interface NoShowNotedData { readonly appointmentId: string; readonly reason: string }

'scheduling.attendance-record.no-show-noted': defineStoredEvent(NoShowNoted, {
  version: 2,
  encode: (event): NoShowNotedData => ({ appointmentId: event.appointmentId, reason: event.reason }),
  decode,
  upcasters: { 1: (data) => ({ ...data, reason: '' }) },
}),
```

## Options

None.

`rules."event-sourcing/upcaster-required"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line event-sourcing/upcaster-required -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A shape changed in place without raising the version is seen by `ddd-ts-kit check` only, against `stored-events.lock.json`: this rule reads one file.

## With the CLI checker

`ddd-ts-kit check` holds the same checks and, alone, the lock: the fingerprint of each version recorded by `ddd-ts-kit docs --stored-events` in `stored-events.lock.json` (the data type and every type of the file it reaches), a recorded shape that changed, a version below the last recorded.

Which gate holds what: ESLint and `ddd-ts-kit check` judge each codec as written; `ddd-ts-kit docs --check` (`npm run docs:check`, run by the generated pipeline) fails while a version declared in a codec is not recorded in the lock, so a version cannot reach the main branch unrecorded; and `ddd-ts-kit check` then refuses any change of a recorded shape.
