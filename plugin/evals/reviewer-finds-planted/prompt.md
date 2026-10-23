---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash]
---

Review the uncommitted changes of this working tree (`git diff`) against the rules of the kit, as the architecture-reviewer would: list each finding with its file and line and the rule id it breaks, blocking or not, and what to do. Invent nothing: a finding names a line that holds what it says.
