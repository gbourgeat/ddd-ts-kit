**English** · [Français](errors-factory-name.fr.md)

# ddd-ts-kit/errors-factory-name

Architecture id: `errors/factory-name`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: the production files of `domain/errors/` of a context, in a project whose config says `"stack.refusals": "named"` or `"factories"`.

## Why

The factory is read by the developer who refuses, the code by the client, the mapper, the audit trail and the tests. They must meet the same words, and those words are the business's. Under `named`, the class says what is refused and the factory what the refusal is about: `SlotTaken.forCalendar`, never `SlotTakenError.create`. Under `factories`, the factory says what is refused and the code repeats it: `slotTaken` and `SLOT_TAKEN`, never `create` and `BOOKING_FAILED`.

## Reported

A factory is a public static method of an error class that calls `refusal(...)`.

Under `named`:

- a class whose name ends with `Error`: a refusal is named after what is refused (`SlotTaken`, `InsufficientFunds`), and the message proposes the name without the suffix
- a factory whose name does not start with `for`, `with`, `because`, `on` or `at` followed by an upper-case letter (`forAccountId`, `withNotice`, `becauseOf`, `onDate`, `atStart`): `slotTaken`, `create`, `format` and `onboard` are reported, and the message proposes `for` before the name
- a factory whose name holds a digit (`forAccount2`)

The code is not read here: under `named` a class reads its code from the `<context>.codes.ts` of its context, which `errors/code-listed` of the checker holds.

Incorrect, under `named`:

```ts
export class SlotTakenError extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTakenError;

  static slotTaken(calendarId: string) {
    return SlotTakenError.refusal('The slot is already held.', { calendarId });
  }
}
```

Correct, under `named`:

```ts
export class SlotTaken extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTaken;

  static forCalendar(calendarId: string) {
    return SlotTaken.refusal('The slot is already held.', { calendarId });
  }
}
```

Under `factories`:

- a name that says an error is built and not which rule refused: `create`, `make`, `of`, `from`, `build`, `new`, `error`, `failure`, `fail`, `refusal`, `refuse`, or a name holding a digit (`error1`)
- a code that is not a string literal, or not in constant case
- a code that is not the name of the factory in constant case, alone or with the name of the concept before or after it: `AppointmentError.notFound` sets `NOT_FOUND`, `APPOINTMENT_NOT_FOUND` or `NOT_FOUND_APPOINTMENT`

Incorrect, under `factories`:

```ts
static slotTaken(calendarId: string) {
  return AppointmentError.refusal('BOOKING_FAILED', 'The slot is already held.', { calendarId });
}
```

Correct, under `factories`:

```ts
static slotTaken(calendarId: string) {
  return AppointmentError.refusal('SLOT_TAKEN', 'The slot is already held.', { calendarId });
}
```

## Options

None.

`rules."errors/factory-name"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line errors/factory-name -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

A code already published under other words cannot change. Under `named` nothing has to give: the code is written in `<context>.codes.ts`, apart from the names of the class and its factories, and a migrated project keeps its published codes there. Under `factories`, rename the factory after the code, or keep the name and silence that line with the reason.

## Limits

- Whether a name is a business phrase cannot be decided by a tool: only the names that are certainly not are refused. Under `factories`, `language/glossary-term` holds the name of the class; under `named` it does not judge the classes of `domain/errors/`, since a refusal is a sentence and not a term.
- Under `factories`, the first `refusal(...)` call of the method is the one read.

## With the CLI checker

Held by this plugin alone. That a code is unique in its context is `errors/code-unique`, and under `named` that a class reads its code from the `<context>.codes.ts` of its context is `errors/code-listed`, both held by the checker.
