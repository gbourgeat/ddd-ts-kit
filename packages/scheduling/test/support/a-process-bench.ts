import { CommandBus, InMemoryProcessStore, InMemoryUnitOfWork, type Command, type ResultOf } from '@ddd-ts-kit/kernel';
import { StoredProcessRunner } from '../../src/index.js';
import { aQueueBench, type QueueBench } from './a-queue-bench.js';
import { DunningProcess } from './dunning-process.js';

/** A command bus that records what it is sent, and refuses what a spec tells it to. */
export class RecordingCommandBus extends CommandBus {
  readonly sent: Command<unknown>[] = [];

  refusing: ((command: Command<unknown>) => boolean) | undefined;

  async execute<C extends Command<unknown>>(command: C): Promise<ResultOf<C>> {
    if (this.refusing?.(command) === true) {
      throw new Error(`${command.constructor.name} refused`);
    }

    this.sent.push(command);

    return undefined as ResultOf<C>;
  }
}

export interface ProcessBench extends QueueBench {
  readonly processes: InMemoryProcessStore;
  readonly commands: RecordingCommandBus;
  readonly runner: StoredProcessRunner;
  readonly dunning: DunningProcess;
}

/** The runner on in-memory stores, its timeouts delivered by the worker of a queue bench. */
export function aProcessBench(): ProcessBench {
  const queueBench = aQueueBench();
  const processes = new InMemoryProcessStore();
  const commands = new RecordingCommandBus();

  const runner = new StoredProcessRunner({
    store: processes,
    jobs: queueBench.queue,
    commands,
    unitOfWork: new InMemoryUnitOfWork(),
  });

  const dunning = new DunningProcess();

  queueBench.worker.register({
    name: 'billing.dunning-timeout',
    run: (payload, execution) => {
      const { id, timeout } = payload as { id: string; timeout: string };

      return runner.timeout(DunningProcess, { id, timeout, jobId: execution.jobId }, (current) =>
        dunning.timedOut(timeout, current),
      );
    },
  });

  return { ...queueBench, processes, commands, runner, dunning };
}
