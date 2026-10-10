# ddd-ts-kit/scheduling-job-name

Architecture id: `scheduling/job-name`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every linted file; the `systemActor` check applies to `*.job.ts` files.

## Why

The name of a job is its identity: the lock that keeps an occurrence to one run, its settings, its metrics, its line in the audit trail are keyed by it. It is written once as a string literal, never derived from a class name that may be renamed, and it starts with the context the job belongs to, so that it leaves with the context when it is extracted.

## Reported

- a first argument of `@Scheduled(..)` or of `job(..)` (in a statement ending with `handledBy` or `handledByFactory`) that is not a string literal
- a name that is not `<context>.<job-name>`: two segments in lower-case kebab-case
- a name whose first segment is not the context of the file (in a module file, the context of the module)
- in a `*.job.ts` file: a `systemActor(..)` call that does not pass the name the job is declared with

Incorrect:

```ts
@Scheduled('SendReminders', { every: '15m' }, [CommandBus])
export class SendRemindersJob implements ScheduledJob {
  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendRemindersCommand(systemActor('reminders'), execution.scheduledAt));
  }
}
```

Correct:

```ts
@Scheduled('billing.send-reminders', { every: '15m' }, [CommandBus])
export class SendRemindersJob implements ScheduledJob {
  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendRemindersCommand(systemActor('billing.send-reminders'), execution.scheduledAt));
  }
}
```

## Details

A template literal without substitution counts as a string literal. Outside a context (`main.ts`, the platform) the format is checked and the first segment is free. In a job file without `@Scheduled` (the explicit style, where the name is written in the module file), `systemActor(..)` must pass a literal that is a job name of the context of the file.

## Options

None.

`rules."scheduling/job-name"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line scheduling/job-name -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- That a job name is unique in the project is a fact of the project: `ddd-ts-kit check` holds it.
- In the explicit style the name given to `systemActor` in the job file is not compared with the name written in the module file.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files, and is alone to check that a name is unique project-wide.
