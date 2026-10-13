**English** · [Français](errors-factory-name.fr.md)

# ddd-ts-kit/errors-factory-name

Architecture id: `errors/factory-name`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: the production files of `domain/errors/` of a context, in a project whose config says `"stack.refusals": "factories"`.

## Why

The factory is read by the developer who refuses, the code by the client, the mapper, the audit trail and the tests. They must meet the same words, and those words are the business's: `slotTaken` and `SLOT_TAKEN`, never `create` and `BOOKING_FAILED`.

## Reported

A factory is a public static method of an error class that calls `refusal(...)`.

- a name that says an error is built and not which rule refused: `create`, `make`, `of`, `from`, `build`, `new`, `error`, `failure`, `fail`, `refusal`, `refuse`, or a name holding a digit (`error1`)
- a code that is not a string literal, or not in constant case
- a code that is not the name of the factory in constant case, alone or with the name of the concept before or after it: `AppointmentError.notFound` sets `NOT_FOUND`, `APPOINTMENT_NOT_FOUND` or `NOT_FOUND_APPOINTMENT`

Incorrect:

```ts
static slotTaken(calendarId: string) {
  return AppointmentError.refusal('BOOKING_FAILED', 'The slot is already held.', { calendarId });
}
```

Correct:

```ts
static slotTaken(calendarId: string) {
  return AppointmentError.refusal('SLOT_TAKEN', 'The slot is already held.', { calendarId });
}
```

## Options

None.

`rules."errors/factory-name"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line errors/factory-name -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

A code already published under other words cannot change: rename the factory after it, or keep the name and silence that line with the reason.

## Limits

- Whether a name is a business phrase cannot be decided by a tool: only the names that are certainly not are refused. `language/glossary-term` holds the name of the class.
- The first `refusal(...)` call of the method is the one read.

## With the CLI checker

Held by this plugin alone. That a code is unique in its context is `errors/code-unique`, held by the checker.
