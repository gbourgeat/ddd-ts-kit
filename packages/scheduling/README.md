# @ddd-ts-kit/scheduling

Scheduled jobs for a project built with the kit. A job is a class of the application layer that
says when it runs and triggers use cases: it decides nothing, the business rules stay in the
domain. The scheduler opens an execution scope around each run, makes sure one instance of the
application runs a given occurrence, and records what became of it.

```
npm i @ddd-ts-kit/scheduling
```

| Entry | Holds | Imports |
|---|---|---|
| `@ddd-ts-kit/scheduling` | `InProcessJobScheduler`, `nextOccurrence`, `latestOccurrence`, `systemJobTimers`, the `JobTimers` and `JobCheckpoints` ports, `JobTimeoutError`, `JobAbortedError`, `JobLockUnavailableError`, the metric names | the kernel |
| `@ddd-ts-kit/scheduling/testing` | `ManualJobScheduler`, `ManualJobTimers` | the kernel |

The declaration (`@Scheduled`), the port (`JobScheduler`) and the schedule parser live in
`@ddd-ts-kit/kernel`, so `application/` imports the kernel and nothing else.
`@ddd-ts-kit/di` binds `JobScheduler` to an `InProcessJobScheduler` in its kernel module and
registers the declared jobs: an application built with it needs no line of this README but
the job itself.

`JobScheduler` is not the `Scheduler` of `@ddd-ts-kit/aspects`. That one is a timer for retry
and timeout (`schedule(work, delayMs)`); this one knows jobs, schedules and instances.

## A job

```ts
// src/contexts/billing/application/scheduling/send-payment-reminders.job.ts
import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { Scheduled, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';
import { SendPaymentReminders } from '../commands/send-payment-reminders/send-payment-reminders.command.js';

@Scheduled('billing.send-payment-reminders', { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' }, [CommandBus])
export class SendPaymentRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(
      new SendPaymentReminders(systemActor('billing.send-payment-reminders'), execution.scheduledAt),
    );
  }
}
```

- **Where**: `application/scheduling/`, in a file named `*.job.ts`, one job per file.
- **The name** is `<context>.<job-name>`, in lower case, written as a string literal and unique
  in the application: it is the system actor the job runs as, the key of its lock, its label in
  the metrics and the key of its settings. It survives the renaming of the class.
- **The dependency list** names the ports of the constructor parameters in order, and the
  compiler checks it, as for every declaration of the kit. A port is an abstract class, and the
  class is what is listed: `[CommandBus]`. A job receives buses and ports. It does not receive
  a repository: what it would do with one is a use case.
- **`run(execution)`** receives:

  | Field | |
  |---|---|
  | `scheduledAt` | the instant the run was due. Pass it to the command: "the reminders of that morning" is the same work whenever it really runs |
  | `startedAt` | the instant it started: later by the jitter, a queue or a catch-up |
  | `attempt` | 1 with this scheduler, which never retries |
  | `signal` | aborted when the run exceeds its timeout or the scheduler stops; a long job checks it between two steps |

- **The command is sent as the system actor of the job**, as an integration event handler does
  for its consumer. With `@ddd-ts-kit/auth`, grant that actor the permission of the command,
  or declare the command `@Public()` when nothing else can send it.
- **Checked when the file loads**: a name that is not `<context>.<job-name>`, a cron that
  cannot be read or never fires, a zero interval, an unknown time zone and an option out of
  its values throw a `DeclarationError` that names the job.

### The execution scope

The scheduler opens an `ExecutionScope` around each run, so the job writes none of it:

| Field of the context | Value |
|---|---|
| `origin` | `schedule` |
| `actor` | `systemActor('<job name>')` |
| `correlationId` | a fresh one for each run, from the `IdGenerator` |
| `scheduledAt` | the instant the run was due |
| `deadline` | the start plus `timeoutMs`, when the job has one |

Audit columns, the audit trail, log fields, tracing and the correlation stamped on published
events therefore work as for a request. A job has no tenant: persistence helpers that need
one (`tenantScopeOf`) are for the use case, which receives the tenant in its command, one
command per tenant when the work is per tenant.

## Schedules

```ts
{ every: '15m' }                                    // or a number of milliseconds
{ cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' }   // timeZone defaults to UTC
```

**Intervals** are a whole number of milliseconds or a number and a unit: `'500ms'`, `'30s'`,
`'15m'`, `'2h'`, `'1d'`. They are **aligned on the Unix epoch**, not on the start of the
process: `'15m'` falls at :00, :15, :30 and :45, `'1d'` at midnight UTC. This is what makes every
instance name the same instants, and a restart keep them. An interval that does not divide a
day (`'7h'`) drifts against the wall clock, and none follows a time zone: for "every morning",
write a cron.

**Cron** has the five standard fields, no seconds:

| Field | Values | Names |
|---|---|---|
| minute | 0-59 | |
| hour | 0-23 | |
| day of month | 1-31 | |
| month | 1-12 | `jan` to `dec` |
| day of week | 0-7, 0 and 7 are Sunday | `sun` to `sat` |

Each field takes `*`, a value, a range `a-b`, a step on either (`*/15`, `8-18/2`) and lists of
those (`0,30`, `mon-fri`). Names ignore case. When the day of month and the day of week are
both restricted (neither starts with `*`), a day that fits either one fits, as in every cron:
`0 0 13 * fri` is the 13th and every Friday. Not supported: `@daily` and the like, `?`, `L`,
`W`, `#`, a step on a single value (`5/15`), a range that wraps (`fri-mon`).

**Time zones** are IANA names, evaluated with `Intl.DateTimeFormat`, without a dependency: the
rules are those of the runtime, updated with it. The fields are read on the clocks of the zone,
day fields included.

| When clocks are | A job pinned to an hour (`30 2 * * *`) | A job of every hour (`0 * * * *`, `*/20 * * * *`) |
|---|---|---|
| set forward (02:00 to 03:00) | a local time that does not exist is **skipped**: no run that day, nothing is moved to 03:00 | keeps its rhythm: 01:00, then 03:00, one hour later |
| set back (03:00 to 02:00) | a local time that occurs twice **runs once**, the first time | keeps its rhythm: the repeated hour is run through twice |

A job is "of every hour" when its hour field starts with `*`: it follows elapsed time. Any
other job follows the clocks. Do not schedule in the changed hour what must run every day:
`30 2 * * *` in `Europe/Paris` has no run on the last Sunday of March.

`nextOccurrence(parseJobSchedule(schedule), after)` and `latestOccurrence(parsed, { after,
notAfter })` answer the instants, for a screen that shows when a job runs next.

## Options

Written next to the schedule: `{ every: '15m', overlap: 'queue', timeoutMs: 60_000 }`.

| Option | Default | |
|---|---|---|
| `overlap` | `'skip'` | an occurrence that comes while the previous run is in progress is not started (`skipped-overlap`). `'queue'` starts it when the run ends; one occurrence waits at most, the next ones are skipped |
| `missed` | `'skip'` | occurrences the scheduler did not reach in time are dropped (`missed`) and the job waits for its next one. `'run-once'` runs the latest of them, once, however many passed |
| `timeoutMs` | none | the signal of a longer run is aborted with a `JobTimeoutError` and the run is recorded `failed`, `JOB_TIMEOUT` |
| `jitterMs` | `0` | a random delay up to this before each run, so that jobs do not all start on the minute |
| `enabled` | `true` | `false` never starts the job by time; `runNow` still runs it |
| `singleInstance` | `true` | one instance runs an occurrence: see below |

**Missed** means reached later than `lateAfterMs` (60 s by default, an option of the
scheduler) after the instant, jitter aside: the process was down, asleep, or its event loop
blocked. A timer a few seconds late still runs its occurrence. What passed **while the process
was down** is only known with `checkpoints`:

```ts
// the port, exported by this package
export abstract class JobCheckpoints {
  abstract read(job: string): Promise<Date | undefined>;

  abstract write(job: string, handled: Date): Promise<void>;
}

// src/platform/scheduling/knex-job-checkpoints.ts, your adapter
export class KnexJobCheckpoints implements JobCheckpoints {
  constructor(private readonly database: Database) {}

  async read(job: string): Promise<Date | undefined> { /* one row per job */ }

  async write(job: string, handled: Date): Promise<void> { /* upsert */ }
}
```

The scheduler writes there the last occurrence it handled for each job and reads it when it
starts. Without it a restart forgets: every job starts from the instant of the start, and
`run-once` only covers what was missed while the process was alive. The store is yours, a
table or a key shared by the instances. It is given to the scheduler where the scheduler is
built: see "Replacing the scheduler".

**A timeout does not kill.** A run is a promise, and nothing can stop a promise: the scheduler
aborts the signal, stops waiting and frees the job for its next occurrence. A job that ignores
its signal goes on behind, and then overlaps the next run. Pass the signal on, or check it.

## Switching a job off, per environment

A job is switched off, rescheduled or tuned by configuration, never by a code change. With
`@ddd-ts-kit/di`:

```ts
createApplication({
  modules,
  jobs: {
    settings: {
      'billing.send-payment-reminders': { enabled: config.jobs.reminders.enabled },
      'billing.export-ledger': { schedule: { cron: config.jobs.ledgerCron, timeZone: 'Europe/Paris' } },
    },
  },
});
```

Settings for a job no module declares are refused (`UNKNOWN_JOB`), so a renamed job cannot stay
on by a stale key; settings that cannot be read are refused too (`INVALID_JOB_SETTINGS`).

## Several instances

Every instance of a horizontally scaled application runs a scheduler and computes the same
instants. Before running an occurrence of a `singleInstance` job, the scheduler takes the
kernel `Lock` under the key `job:<name>:<scheduled instant>`. The instance that gets it runs;
the others record `skipped-locked`.

- **The lock is not released when the run ends.** An instance whose timer fires a little later
  would take it and run the occurrence again. It is kept until this instance handles the next
  occurrence of the job, or until its time to live has passed: `timeoutMs` (15 minutes for a
  job without timeout, `lockTtlMs`) plus the jitter and `lateAfterMs`.
- **With `InMemoryLock`**, the default of `kernelModule()`, the lock excludes inside one
  process only: two instances both run every job. It is correct for a single instance and for
  tests, and nothing more.
- **With a lock between processes** (`RedisLock` of `@ddd-ts-kit/redis`, bound to `Lock`), the
  guarantee is real, and it is this one: **at most one run per occurrence, best effort**.

What is not guaranteed, so that you design for it:

- An occurrence may run **twice**: the lock expires while its holder is paused or the run
  outlives the time to live and a late instance arrives; the lock store fails over and forgets
  a key; an instance restarts with `missed: 'run-once'` after the lock of the occurrence it
  catches up has expired; clocks disagree by more than the time to live.
- An occurrence may run **zero times**: the instance that took the lock crashes before or
  during the run (nobody retries, the lock stays), every instance is down at the instant
  (`missed`), or the lock store cannot be reached, in which case the occurrence is not run and
  is recorded `failed`, `JOB_LOCK_UNAVAILABLE`, rather than run everywhere.
- `runNow` takes no lock: it is one deliberate run.

**Therefore a job is idempotent, or the command it sends is.** A run that happens twice must
leave the same state as once: derive what to do from the state ("invoices due and not yet
reminded"), not from the fact of being called, or key the work on `scheduledAt` behind a unique
constraint. The kernel says it of `Lock` itself: an efficiency tool, never the guard of an
invariant. Work that must happen exactly once and survive a crash is not a scheduled job but
a row in a table, processed by a job that is safe to repeat.

Instances should keep their clocks within a few seconds of each other (NTP): the instants are
computed from the `Clock`, and the lock key is the instant.

## A dedicated worker process

By default every process that starts the application runs the jobs. To run them in one
deployment and serve requests in another, tell the others not to:

```ts
// src/main.ts, the process that serves requests
const app = createApplication({ modules, jobs: { start: false } });

// src/apps/worker/main.ts, the process that runs the jobs: the same modules, no HTTP server
const app = createApplication({ modules, jobs: { settings: jobSettings(config) } });
await app.start();
process.on('SIGTERM', () => void app.stop());
```

With `start: false` the jobs are still registered and described, and `runNow` still runs one,
which gives an operations endpoint for free. One composition root reading a flag
(`jobs: { start: config.runJobs }`) is the same thing with one entry point. Keep
`singleInstance` on even with one worker: a rolling deployment runs two for a while.

A context extracted as its own service takes its jobs with it: they are declarations of the
context, registered by the application that lists its module. Nothing is global.

In a project generated by the CLI: `ddd-ts-kit generate job` writes the job and its line in
`src/platform/job-settings.ts` (switched off with `JOB_<CONTEXT>_<JOB>_ENABLED=false`),
`main.ts` passes `jobs: { start: config.runJobs, settings: jobSettings(process.env) }`
(`RUN_JOBS`), and `ddd-ts-kit generate worker` writes `src/apps/worker/main.ts` and turns the
default of `RUN_JOBS` off for the API.

## Lifecycle

`application.start()` starts the scheduler last, once the consumers are subscribed, and
`application.stop()` stops it first. `stop()` starts no new run, waits for the runs in
progress up to `graceMs` (30 s by default), then aborts their signals with a `JobAbortedError`
and returns; a run that waited in a queue is dropped and recorded `missed`. Set the grace
below the termination grace of the platform.

### Replacing the scheduler

`kernelModule()` builds the scheduler on the kernel ports it binds: `Clock`, `Lock`,
`ExecutionScope`, `IdGenerator`, `Logger` and `Metrics`, with `reportFailedRuns` on the bound
`ErrorReporter` as `onRun`. To build it otherwise (with checkpoints, another grace period,
another observer), give the kernel module yours:

```ts
import { Clock, ExecutionScope, IdGenerator, Lock, Logger, Metrics } from '@ddd-ts-kit/kernel';
import { createApplication, kernelModule } from '@ddd-ts-kit/di';
import { InProcessJobScheduler, JobCheckpoints } from '@ddd-ts-kit/scheduling';

const kernel = kernelModule({
  jobScheduler: (resolve) =>
    new InProcessJobScheduler({
      clock: resolve(Clock),
      // asked at each occurrence: building the scheduler must not open a connection
      lock: { acquire: (key, options) => resolve(Lock).acquire(key, options) },
      scope: resolve(ExecutionScope),
      ids: resolve(IdGenerator),
      logger: resolve(Logger),
      metrics: resolve(Metrics),
      checkpoints: resolve(JobCheckpoints),
      graceMs: 10_000,
    }),
});

const app = createApplication({ modules: [kernel, platformModule, billingModule] });
```

with, in the module of the platform, `builder.bind(JobCheckpoints).toClass(KnexJobCheckpoints, [Database])`.
A later module replaces the scheduler the same way, with
`builder.rebind(JobScheduler).toFactory((resolve) => new InProcessJobScheduler({ ... }))`, and
so does another implementation of the `JobScheduler` port (on a database, on a queue).

Without `@ddd-ts-kit/di`:

```ts
const scheduler = new InProcessJobScheduler({ clock, lock, scope, ids, logger, metrics });
scheduler.register({ name: 'billing.send-payment-reminders', schedule: { every: '15m' }, run: (execution) => job.run(execution) });
await scheduler.start();
```

| Option | Default | |
|---|---|---|
| `clock`, `lock`, `scope`, `ids` | required | every instant comes from the `Clock`; the system clock is never read |
| `logger`, `metrics` | write and measure nothing | |
| `timers` | `systemJobTimers` | how it sleeps; `ManualJobTimers` in a test |
| `checkpoints` | none | see "Options" |
| `lateAfterMs` | `60000` | later than this, an occurrence is missed |
| `graceMs` | `30000` | how long `stop()` waits |
| `lockTtlMs` | `900000` | time to live of the lock of a job without `timeoutMs` |
| `random` | `Math.random` | draws the jitter |
| `onRun` | none | `(run, error?, detail?) => void` for every occurrence handled, with what the job threw and the correlation id of the run: `reportFailedRuns(errorReporter)` is the observer that reports to the kernel `ErrorReporter` every run that failed with anything but a `DomainError` |

It sleeps at most one hour at a time and computes again when it wakes, so a clock that is
corrected, or a suspended machine, is noticed within the hour.

## Observability

`scheduler.describe()` answers, for each job, `name`, `schedule` (`every 15m`,
`cron 0 7 * * 1-5 (Europe/Paris)`), `enabled`, `running`, `nextRunAt` and `lastRun`, as data.
`application.describe().jobs` lists the declared jobs with the settings they run with.

Every occurrence handled has one outcome, recorded three times:

| Outcome | Means | Log level |
|---|---|---|
| `succeeded` | the job ran | info |
| `failed` | the job threw, timed out, was aborted, or its lock could not be asked | error |
| `skipped-overlap` | the previous run was still in progress | warn |
| `skipped-locked` | another instance runs this occurrence | debug |
| `missed` | the occurrence passed and was not run | warn |

- **Log**: one entry, `Scheduled job <outcome>`, with `job`, `context`, `outcome`,
  `scheduledAt`, and for a run `durationMs`, `correlationId`, `errorCode`, `errorType`.
- **Metrics**: the counter `scheduled_job_runs_total` and, for a run, the histogram
  `scheduled_job_duration_ms`, labelled `job`, `context`, `status` (the outcome) and
  `error_code`. An alert on "no `succeeded` for this job since N intervals" catches every way a
  job stops running, which an alert on failures does not.
- **`onRun`**: the same record, plus the error and the correlation id of the run.

`missed` is recorded once for a gap, with the first instant that was missed, not once per
instant. The `errorCode` is the `code` of what was thrown (a `DomainError`, `JOB_TIMEOUT`,
`JOB_ABORTED`, `JOB_LOCK_UNAVAILABLE`) or `UNEXPECTED_ERROR`. **The message of an error is
never recorded**: it quotes data. A job that fails stops neither the scheduler nor the other
jobs, and its next occurrence runs as usual: there is no retry, the next occurrence is the
retry.

## Testing

A spec of a job is a spec of the use case it triggers: run the job, assert the fakes. Time is
not involved, and the test application of `@ddd-ts-kit/di` never starts jobs by time.

```ts
const app = createTestApplication({ modules: [contextModule('billing', billing)], fakes: [fake(Mailer, mailer)] });

await app.jobs.runNow('billing.send-payment-reminders');

expect(mailer.sent).toHaveLength(2);
```

`app.jobs.runNow(name)` runs the job as the scheduler would (scope of origin `schedule`,
system actor, lock aside) and throws what the job threw. For a spec about time itself,
`app.jobs.scheduler` is a `ManualJobScheduler` on the clock of the application:

```ts
import { FixedClock, FixedExecutionScope, InMemoryLock, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { ManualJobScheduler } from '@ddd-ts-kit/scheduling/testing';

const clock = new FixedClock(new Date('2026-03-02T09:58:30Z'));
const scheduler = new ManualJobScheduler({ clock, lock: new InMemoryLock(clock), scope: new FixedExecutionScope(), ids: new SequentialIdGenerator() });
scheduler.register({ name: 'billing.send-payment-reminders', schedule: { every: '15m' }, run });
await scheduler.start();

await scheduler.advance(32 * 60_000);

expect(scheduler.runs.map((run) => run.scheduledAt.toISOString())).toEqual(['2026-03-02T10:00:00.000Z', '2026-03-02T10:15:00.000Z', '2026-03-02T10:30:00.000Z']);
```

- `advance(ms)` moves the clock and fires each timer at its instant, in order. When it
  resolves, every job that waits on promises alone has ended; a job the test keeps blocked is
  still running, which is how overlap, timeout and stop are tested.
- `runs` lists every occurrence handled with its outcome, `failures` what the failed runs
  threw, `runsOf(job)` the runs of one job. There is no jitter.
- `ManualJobTimers` alone drives an `InProcessJobScheduler` built by hand, for a spec that sets
  `random` or `checkpoints`.
- Two schedulers sharing a clock and a lock are two instances: this is how the single-instance
  behaviour is specified in this package.

Another scheduler (on a database, on a queue) implements the `JobScheduler` port of the kernel
and passes `jobSchedulerContract` of `@ddd-ts-kit/testing/contracts`.

## Limits

- **No persistence of its own.** Runs, outcomes and `lastRun` live in the memory of the
  instance; `describe()` is the view of one instance, and only `checkpoints` crosses a restart.
- **No retry and no backoff.** A failed occurrence is over. Put retry where the failure is: an
  aspect on the adapter (`retry` of `@ddd-ts-kit/aspects`), or a command that is safe to send
  again at the next occurrence.
- **Minute resolution for cron**, millisecond for intervals; an interval under a second is
  possible and rarely wise, as each occurrence costs a lock.
- **At most once per occurrence is best effort**, as said above. Exactly-once does not exist
  here.
- **Not a queue.** A job does a bounded amount of work on a schedule. Work that arrives, must
  not be lost and must be retried belongs to the outbox and to integration events.
- **One process, one event loop.** A job that blocks the loop delays every other job; past
  `lateAfterMs` their occurrences are missed.
- **Time zone rules are those of the runtime.** A zone whose rules changed needs an updated
  Node. Two changes of offset within two days of each other, which no zone has, are not
  handled.
