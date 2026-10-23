---
type: llm
weight: 1
---

PASS if no code of a context was written and the answer says the row cannot be built yet because the story has no design review of its rows (docs/architecture/reviews/US9.md) and no acceptance written and locked (`npx ddd-ts-kit acceptance US9 --lock`), naming `npx ddd-ts-kit story US9 --gate build` or the phases, and proposes to do those first. FAIL if the command was generated or written, or if the gate was worked around.
