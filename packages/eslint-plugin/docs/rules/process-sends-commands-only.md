# ddd-ts-kit/process-sends-commands-only

Architecture id: `process/sends-commands-only`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `application/processes/*.process.ts` of a context, specs aside.

## Why

A process manager coordinates a long-running process: it reacts to events, keeps a state of its
own and decides what happens next. When it also loads and saves aggregates, it becomes a use case
nobody can send, with no permission, no audit and a transaction that spans what it should only
coordinate; when it writes the aggregate of another context, the boundary is gone. Its steps
answer a decision, and the commands of that decision do the work, each in its own handler.

## Reported

An import, in a process file, of:

- `domain/aggregates/`, `domain/entities/`, `domain/repositories/` or `domain/services/` of any
  context
- `application/ports/` of any context
- `infrastructure/` of any context

Incorrect:

```ts
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';

export class AppointmentReminderProcess { /* saves reminders itself */ }
```

Correct:

```ts
import { PlanReminderCommand } from '@/contexts/notification/application/commands/plan-reminder/plan-reminder.command';

export class AppointmentReminderProcess implements ProcessManager<ReminderProcessState> {
  booked(event: AppointmentBookedV1, current: ReminderProcessState | undefined): ProcessDecision<ReminderProcessState> | undefined {
    return { state: { appointmentId: event.payload.appointmentId, stage: 'waiting' }, commands: [new PlanReminderCommand(/* ... */)] };
  }
}
```

## Details

Commands, the published language of upstream contexts, value objects, vocabularies and the
kernel stay allowed: a process builds commands and reads events.

## Options

None.

`rules."process/sends-commands-only"` in `ddd-ts-kit.config.json` set to `off` silences the rule,
and `// ddd-ts-kit-disable-next-line process/sends-commands-only -- <reason>` silences one line,
exactly as for `ddd-ts-kit check`.

## Limits

- An import read by a dynamic expression is not followed.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files.
