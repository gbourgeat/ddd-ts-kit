import {
  UnreadableProcessStateError,
  type BackgroundJobType,
  type CommandBus,
  type JobQueue,
  type ProcessDecision,
  type ProcessRunner,
  type ProcessStore,
  type ProcessTimeoutDue,
  type ProcessType,
  type StoredProcess,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import { NoTimeoutJobError } from './no-timeout-job-error.js';

export interface StoredProcessRunnerOptions {
  readonly store: ProcessStore;
  /** Where the timeouts are enqueued, as delayed background jobs. */
  readonly jobs: JobQueue;
  readonly commands: CommandBus;
  /** The step, its state, its timeouts and its commands commit together. */
  readonly unitOfWork: UnitOfWork;
}

type Timeouts = Readonly<Record<string, string>>;

interface Instance {
  readonly name: string;
  readonly id: string;
  readonly stored: StoredProcess | undefined;
  readonly timeouts: Timeouts;
}

/** The `ProcessRunner` of the kernel on a `ProcessStore` and a `JobQueue`. */
export class StoredProcessRunner implements ProcessRunner {
  constructor(private readonly options: StoredProcessRunnerOptions) {}

  run<State>(
    process: ProcessType<State>,
    id: string,
    step: (current: State | undefined) => ProcessDecision<State> | undefined,
  ): Promise<void> {
    return this.options.unitOfWork.run(async () => {
      const stored = await this.options.store.load(process.processName, id);

      if (stored?.ended === true) {
        return;
      }

      const current = stored === undefined ? undefined : stateOf(process, stored);
      const instance = { name: process.processName, id, stored, timeouts: stored?.timeouts ?? {} };

      await this.apply(process, instance, step(current));
    });
  }

  timeout<State>(
    process: ProcessType<State>,
    due: ProcessTimeoutDue & { readonly jobId: string },
    step: (current: State) => ProcessDecision<State> | undefined,
  ): Promise<void> {
    return this.options.unitOfWork.run(async () => {
      const stored = await this.options.store.load(process.processName, due.id);

      if (stored === undefined || stored.ended || stored.timeouts[due.timeout] !== due.jobId) {
        return;
      }

      const timeouts = without(stored.timeouts, [due.timeout]);
      const instance = { name: process.processName, id: due.id, stored, timeouts };

      await this.apply(process, instance, step(stateOf(process, stored)));
    });
  }

  /** Disarms, arms, saves, then sends the commands: everything in the unit of work of the step. */
  private async apply<State>(
    process: ProcessType<State>,
    instance: Instance,
    decision: ProcessDecision<State> | undefined,
  ): Promise<void> {
    if (decision === undefined) {
      return;
    }

    const disarmed = await this.disarm(instance.timeouts, decision.cancel ?? []);
    const timeouts = await this.arm(process, { ...instance, timeouts: disarmed }, decision);
    const { name, id, stored } = instance;
    const version = (stored?.version ?? 0) + 1;

    await this.options.store.save({
      name,
      id,
      state: decision.state,
      version,
      ended: decision.ended === true,
      timeouts,
    });

    for (const command of decision.commands ?? []) {
      await this.options.commands.execute(command);
    }
  }

  private async disarm(timeouts: Timeouts, names: readonly string[]): Promise<Timeouts> {
    for (const name of names) {
      const jobId = timeouts[name];

      if (jobId !== undefined) {
        await this.options.jobs.cancel(jobId);
      }
    }

    return without(timeouts, names);
  }

  /** A timeout armed again replaces the one of the same name, whose job no longer counts. */
  private async arm<State>(
    process: ProcessType<State>,
    instance: Instance,
    decision: ProcessDecision<State>,
  ): Promise<Timeouts> {
    let armed = instance.timeouts;

    for (const { name, at } of decision.timeouts ?? []) {
      armed = await this.disarm(armed, [name]);

      const { id: jobId } = await this.options.jobs.enqueue(
        timeoutJobOf(process),
        { id: instance.id, timeout: name },
        { runAt: at },
      );

      armed = { ...armed, [name]: jobId };
    }

    return armed;
  }
}

function stateOf<State>(process: ProcessType<State>, stored: StoredProcess): State {
  if (!process.isState(stored.state)) {
    throw new UnreadableProcessStateError(process.processName, stored.id);
  }

  return stored.state;
}

function without(timeouts: Timeouts, names: readonly string[]): Timeouts {
  return Object.fromEntries(Object.entries(timeouts).filter(([name]) => !names.includes(name)));
}

/** The background job that delivers the timeouts: the runner only names it, the context declares it. */
function timeoutJobOf<State>(process: ProcessType<State>): BackgroundJobType<ProcessTimeoutDue> {
  const { timeoutJob } = process;

  if (timeoutJob === undefined) {
    throw new NoTimeoutJobError(process.processName);
  }

  return { jobName: timeoutJob, prototype: { run: () => Promise.resolve() } };
}
