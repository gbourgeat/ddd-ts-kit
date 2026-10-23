---
type: llm
weight: 1
---

PASS if the uncommitted changes, which touch two contexts (a note in a notification handler and a note in a scheduling handler), were committed as two conventional commits, each scoped by its context (`<type>(notification): ...`, `<type>(scheduling): ...`), nothing else staged with them. FAIL if one commit took both, or if a message is not a conventional commit subject.
