**English** · [Français](errors-through-factory.fr.md)

# ddd-ts-kit/errors-through-factory

Architecture id: `errors/through-factory`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every file of a context, tests included, in a project whose config says `"stack.refusals": "named"` or `"factories"`. A config without the key was written when an error was a class built with `new`: nothing is reported there.

## Why

The code that refuses reads as a sentence: `throw SlotTaken.forCalendar(calendar.id, slot.startsAt)` under `named`, where each refusal is a class of its own, and `throw AppointmentError.slotTaken(calendar.id, slot.startsAt)` under `factories`, where the refusals of one concept live in one class. The factory writes the code, the message and the facts once. A `new` is a refusal whose code and message are whatever the caller wrote.

## Reported

- `new X(...)` where `X` is imported from a file of `domain/errors/`
- under `named` only, `new X(...)` where `X` is a class of the same file that extends `DomainRefusal`, in its own factories too: a factory builds the refusal with `X.refusal(message, facts)`

Incorrect, under `named`:

```ts
import { SlotTaken } from '@/contexts/scheduling/domain/errors/slot-taken.error';

throw new SlotTaken(`The slot at ${slot.startsAt.toISOString()} is held.`);
```

Correct, under `named`:

```ts
import { SlotTaken } from '@/contexts/scheduling/domain/errors/slot-taken.error';

throw SlotTaken.forCalendar(calendar.id, slot.startsAt);
```

Incorrect, under `factories`:

```ts
import { SlotTakenError } from '@/contexts/scheduling/domain/errors/slot-taken.error';

throw new SlotTakenError(calendar.id, slot.startsAt);
```

Correct, under `factories`:

```ts
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';

throw AppointmentError.slotTaken(calendar.id, slot.startsAt);
```

## Options

None.

`rules."errors/through-factory"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line errors/through-factory -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- An error class is known by where it is imported from: a class declared elsewhere than `domain/errors/` is not seen (`naming/suffix` keeps errors there).
- The errors of the kit (`NotFoundError`, `InvariantViolation`, `ValidationError`...) are each one refusal with a fixed code and stay built with `new`.
- Nothing is fixed: which factory replaces a constructor is a decision. `ddd-ts-kit error-factories` writes the plan of a migration and applies it.

## With the CLI checker

Held by this plugin alone: the checker lists the rule and judges nothing. The compiler refuses the same thing outside the class once it extends `DomainRefusal` or `ConceptError`, whose constructors are protected.
