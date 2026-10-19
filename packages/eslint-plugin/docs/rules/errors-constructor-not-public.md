**English** · [Français](errors-constructor-not-public.fr.md)

# ddd-ts-kit/errors-constructor-not-public

Architecture id: `errors/constructor-not-public`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: the production files of `domain/errors/` of a context, in a project whose config says `"stack.refusals": "named"` or `"factories"`.

## Why

A public constructor lets any caller build a refusal with a code and a message of its own. `DomainRefusal` (the base of a refusal under `named`) and `ConceptError` (the base of a concept class under `factories`) of `@ddd-ts-kit/kernel` have a protected constructor, and a class that extends one declares none: a refusal then exists only through a static factory.

## Reported

- a class that extends another one and declares a public constructor
- a class that extends `DomainError` and declares no constructor: it inherits a public one

An abstract class is not judged.

The message names the base of the form in use: `DomainRefusal` under `named`, `ConceptError` under `factories`.

Incorrect:

```ts
export class SlotTakenError extends DomainError {
  readonly code = 'SLOT_TAKEN';

  constructor(calendarId: string) {
    super(`The slot on calendar ${calendarId} is already held.`);
  }
}
```

Correct, under `named`:

```ts
export class SlotTaken extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTaken;

  static forCalendar(calendarId: string) {
    return SlotTaken.refusal(`The slot on calendar ${calendarId} is already held.`, { calendarId });
  }
}
```

Correct, under `factories`:

```ts
export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string) {
    return AppointmentError.refusal('SLOT_TAKEN', `The slot on calendar ${calendarId} is already held.`, { calendarId });
  }
}
```

## Options

None.

`rules."errors/constructor-not-public"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line errors/constructor-not-public -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A class that extends a base of the project and declares no constructor is trusted: the visibility it inherits is in another file.
- Nothing is fixed: making a constructor private breaks every `new` of the class. `ddd-ts-kit error-factories` moves a project to named refusals (or, with `--to factories`, to concept classes) as a whole.

## With the CLI checker

Held by this plugin alone: the shape of a class needs a syntax tree.
