import { Command, CommandBus, ErrorReporter } from '@ddd-ts-kit/kernel';
import { defineContextModule, kernelModule } from '@ddd-ts-kit/di';
import { createApplication } from '@ddd-ts-kit/di/tsyringe';
import { afterEach, expect, it } from 'vitest';
import { SentryErrorReporter } from '../src';
import { aTracker, type Tracker } from './support/a-tracker';

class CloseLedger extends Command<void> {}

class CloseLedgerHandler {
  execute(): Promise<void> {
    return Promise.reject(new Error('connection reset'));
  }
}

const billing = defineContextModule({
  name: 'billing',
  register(builder) {
    builder.command(CloseLedger).public().handledBy(CloseLedgerHandler, []);
  },
});

let tracker: Tracker | undefined;

afterEach(async () => {
  await tracker?.stop();
});

it('is one option of the kernel module: the failed command is an event once the application stopped', async () => {
  tracker = await aTracker();

  const app = createApplication({ modules: [kernelModule({ errorReporter: tracker.errors }), billing] });

  await app.start();
  await expect(app.resolve(CommandBus).execute(new CloseLedger())).rejects.toThrow('connection reset');
  await app.stop();

  expect(app.resolve(ErrorReporter)).toBeInstanceOf(SentryErrorReporter);

  expect(tracker.server.events).toMatchObject([
    {
      tags: { origin: 'command', operation: 'CloseLedger' },
      exception: { values: [{ type: 'Error', value: 'connection reset' }] },
    },
  ]);
});
