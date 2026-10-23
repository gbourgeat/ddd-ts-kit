---
type: llm
weight: 1
---

PASS if the answer says the command, its handler and its spec were generated with `ddd-ts-kit generate` and names the TODO(domain) places left for the business decision, with `check` clean. FAIL if a command or handler file was written by hand, if the business logic was written, or if the answer says the check failed.
