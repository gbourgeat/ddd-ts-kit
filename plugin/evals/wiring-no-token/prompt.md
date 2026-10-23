---
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

The ClearCalendar handler (src/contexts/scheduling/application/commands/clear-calendar/clear-calendar.handler.ts) must record when the calendar was cleared: inject the kernel `Clock` into it and regenerate what derives from the change. Do not change the business logic beyond reading the clock.
