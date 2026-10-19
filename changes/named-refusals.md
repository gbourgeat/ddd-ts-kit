**`init` writes `"stack.refusals": "named"`: a refusal is a class of its own, named after what is refused, built by static factories named after what it is about, its code read from the closed list of its context.**
`throw SlotTaken.forCalendar(calendar.id, slot.startsAt)`, where `SlotTaken` extends `DomainRefusal` in
`domain/errors/slot-taken.error.ts` and reads `readonly code = SchedulingCodes.SlotTaken` from
`domain/errors/codes.ts`, the list `SchedulingCodes` of every code of the context and its union type
`SchedulingCode`. `ddd-ts-kit generate error <context> <Refusal> <factory> [--code CODE]`
(`generate error banking InsufficientFunds forAccountId`) writes the class, its entry in `codes.ts`, the
factory and its spec case, each when absent; run again, it changes nothing. A factory starts with `for`,
`with`, `because`, `on` or `at` (`forCalendar`, `withNotice`, `becauseOf`); the code defaults to the refusal
in constant case and is unique in the context. Under `named`, `errors/through-factory`,
`errors/constructor-not-public`, `errors/code-unique` and `errors/known-code` judge the classes of
`DomainRefusal` and the values of `codes.ts`; `errors/factory-name` refuses a class named `...Error` and a
factory without one of the five prefixes; the new `errors/code-listed` of `ddd-ts-kit check` holds the list
(each refusal class reads its code under its own name, `codes.ts` exists as soon as one does, every key is a
refusal class of the context, every value a string literal in constant case, the list is `as const`);
`language/glossary-term` judges every class of `domain/errors/` under `named` as it judges an aggregate,
each word of its name a term of the glossary of its context, a refusal class allowed the qualifiers
`invalid`, `unknown`, `already`, `too`, `no`, `missing` and `required` besides (`SlotTaken`, `BookingTooLate`
and `InvalidAppointment` pass with `Slot`, `Take`, `Booking`, `Late` and `Appointment` in the glossary);
`codes.ts` is not judged. `generate error` refuses a refusal named with a word the glossary does not define,
and `--term "<Term>=<meaning>"` adds it in the same command. `generate domain-error` is refused under
`named`, pointing to `generate error`. The two earlier
forms keep working as they are: a project that says `"factories"` (one `ConceptError` class per concept)
is judged by the rules of that form, and a config without the key is still `classes`.
`ddd-ts-kit error-factories` now moves a project to `named` (`--to named`, the default), from either form: `--plan`
proposes, per refusal, a class (the PascalCase of its code, which it keeps) and a factory (`for<Concept>`),
both editable; `--apply` writes `codes.ts` in each context, one class file per refusal and its spec,
rewrites every usage (`AppointmentError.ended(a, b)` becomes `AppointmentEnded.forAppointment(a, b)`,
`AppointmentError.is(error, 'APPOINTMENT_ENDED')` becomes `AppointmentEnded.is(error)`, imports included),
removes the concept classes left empty, sets the key, and lists what it cannot rewrite (a bare
`AppointmentError.is(error)`, `CodeOf<typeof AppointmentError>`); `--plan` and `--apply` both list each class
whose name uses words the glossary of its context does not define. `--to factories` keeps the earlier move
from one class per error to concept classes.

To move: nothing is required, a project keeps its form. To adopt named refusals, run
`npx ddd-ts-kit error-factories --plan`, edit the class and factory names in `error-factories.plan.json`,
then `npx ddd-ts-kit error-factories --apply`, run the formatter and `npx ddd-ts-kit check`, and settle
the lines it lists as left to you.
