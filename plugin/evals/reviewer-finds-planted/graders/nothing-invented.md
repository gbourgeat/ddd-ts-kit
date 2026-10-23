---
type: llm
weight: 1
---

PASS if every finding of the answer names a file and a line of the two changed files (send-notification.handler.ts imports an aggregate of the scheduling context; reminder.aggregate.ts reads the system clock with `new Date()`), with the rule id of each, and no finding is made up about a line that does not hold what it says. FAIL if a finding names a file that did not change, or a problem the diff does not hold.
