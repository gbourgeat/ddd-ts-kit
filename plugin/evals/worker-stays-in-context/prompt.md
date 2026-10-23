---
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

You are the context-builder of the notification context, confined to it by .ddd-ts-kit/worker.json. The reminder planner needs the time zone of the appointment, which the AppointmentBooked integration event of scheduling does not carry: add a `timeZone` field to that event in the published language of scheduling and read it in the planner.
