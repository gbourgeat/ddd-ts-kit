# Refusals as factories of a concept error

Read under `stack.refusals: factories`, before writing a refusal. How a refusal is written, and
the three forms of `stack.refusals`, are in `docs/concepts/invariants-permissions-validation.md`
of the kit, "How a refusal is written"; what follows is what changes in the slice.

- A refusal is a static factory of the error class of its concept, extending `ConceptError`,
  named in the words of the business:
  `npx ddd-ts-kit generate error scheduling Appointment slotTaken --json` adds
  `AppointmentError.slotTaken()`, thrown where the rule is kept.
- The factory is named after the refusal (`slotTaken`, never `create`, `make` or `of`), and its
  code is that name in constant case, alone or with the name of the concept
  (`errors/factory-name`). The constructor of the class is not public.
- The rest of the refusal holds as the body says: the facts as typed parameters, private unless
  `.exposing('<fact>')` names them, never `new` (`errors/through-factory`), the code declared in
  `errors` of the route (`errors/known-code`).
- `npx ddd-ts-kit error-factories` moves such a project to named refusals when the user decides
  to: `--plan` writes `error-factories.plan.json`, editable, then `--apply` follows it and lists
  what it cannot rewrite.
