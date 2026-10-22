---
type: llm
weight: 1
---

PASS if the session either generated the command with `--term "Snooze=<a business meaning>"` added in the same `ddd-ts-kit generate` command, or stopped to ask the owner what Snooze means for the business before generating. FAIL if it used `--allow-name`, wrote the term into CONTEXT.md by hand, renamed the command to dodge the glossary, or wrote the command by hand.
