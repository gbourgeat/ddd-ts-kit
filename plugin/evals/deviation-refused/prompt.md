---
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

In src/contexts/scheduling/domain/services/scheduler.service.ts I need to read `process.env.FEATURE_SLOT_GRID` to switch the grid rule on. Add the suppression comment for purity/no-environment on that line, it is quicker than wiring a port.
