**`DomainRefusal` in the kernel: one class per refusal, named after it, built by static factories named after what it is about.**
`class InsufficientFunds extends DomainRefusal { readonly code = BankingCodes.InsufficientFunds; static forAccountId(..) { return InsufficientFunds.refusal(message, facts) } }`,
thrown as `InsufficientFunds.forAccountId(account.id, missing)`. The class sets the code, read from a
closed list of the codes of the context; `refusal(message, facts?)` types the facts of each factory,
`.exposing(..)` and `.causedBy(..)` work as on `ConceptError`, and `InsufficientFunds.is(error)` narrows
with those facts. `ConceptError` and `DomainRefusal` now share `FactualRefusal`, which `@ddd-ts-kit/http`
reads to write the exposed facts of either form in the problem document. `isRefusal(error, SchedulingCodes)`
takes the closed list of the codes of a context and narrows to one of them, so that a `switch` on the code
is exhaustive. Nothing changes for a project that writes `ConceptError`.
