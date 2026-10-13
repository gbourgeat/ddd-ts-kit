**English** · [Français](scheduling-job-triggers-use-case.fr.md)

# ddd-ts-kit/scheduling-job-triggers-use-case

Architecture id: `scheduling/job-triggers-use-case`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: production files of a context.

## Why

A job is a schedule, not a use case. It sends a command, and the work is in the handler of that command, where it is authorized, transactional, audited and tested like any other use case, and where an operator can also trigger it by hand. A job that loads aggregates and saves them is a use case that escaped all of that.

## Reported

In `application/scheduling/*.job.ts`:

- no exported class implementing `ScheduledJob`
- a `run` method that calls no `<something>.execute(..)`, or no `run` method
- a repository (a class imported from `domain/repositories/`) in the dependency list or as the type of a constructor parameter
- an import from `domain/aggregates/`, `domain/entities/`, `domain/services/` or `infrastructure/`

Anywhere else in a context:

- a class carrying `@Scheduled`
- `job(..).handledBy(Class, ..)` naming a class imported from a file that is not `application/scheduling/*.job.ts`

Incorrect:

```ts
// application/scheduling/send-reminders.job.ts
@Scheduled('billing.send-reminders', { every: '15m' }, [InvoiceRepository, Mailer])
export class SendRemindersJob implements ScheduledJob {
  async run(): Promise<void> {
    for (const invoice of await this.invoices.overdue()) {
      await this.mailer.remind(invoice);
    }
  }
}
```

Correct:

```ts
// application/scheduling/send-reminders.job.ts
@Scheduled('billing.send-reminders', { every: '15m' }, [CommandBus])
export class SendRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendRemindersCommand(systemActor('billing.send-reminders'), execution.scheduledAt));
  }
}
```

## Details

The rule holds in both styles: an explicit-style job is the same class without `@Scheduled`, registered by `builder.job('<context>.<job>', schedule).handledBy(Job, [CommandBus])` in the module file. Value objects, events, errors and the commands of `application/commands/` may be imported by a job. That a job file of a declared-style project carries `@Scheduled` is `declarations/role-declared`.

## Options

None.

`rules."scheduling/job-triggers-use-case"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line scheduling/job-triggers-use-case -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A command sent through a helper of another file (`this.trigger()`) is not seen: call `execute` in `run`.
- A job registered with `handledByFactory` names no class and is not followed.
- A class carrying `@Scheduled` outside a context (the platform) is not judged.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files. This rule is the authority for the code.
