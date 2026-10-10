import { describe, expect, it } from 'vitest';
import { InMemoryErrorReporter, InMemoryLogger, Logger, NoopLogger } from '@ddd-ts-kit/kernel';
import { createApplication, createTestApplication, defineContextModule, fake, kernelModule } from '../src/index.js';

/** What happened while the application stopped, in order. */
type Journal = string[];

class JournalledLogger extends InMemoryLogger {
  constructor(private readonly journal: Journal) {
    super();
  }

  override flush(): Promise<void> {
    this.journal.push(`logger flushed after ${String(this.entries.length)} entries`);

    return super.flush();
  }
}

class JournalledReporter extends InMemoryErrorReporter {
  constructor(private readonly journal: Journal) {
    super();
  }

  override flush(): Promise<boolean> {
    this.journal.push('reporter flushed');

    return super.flush();
  }
}

class BrokenLogger extends NoopLogger {
  override flush(): Promise<void> {
    return Promise.reject(new Error('disk full'));
  }
}

/** A module that logs while it stops, as an adapter closing its connection does. */
const closing = defineContextModule({
  name: 'closing',
  register: () => undefined,
  onStop: ({ resolve }) => {
    resolve(Logger).info('connection closed');
  },
});

describe('an application that stops', () => {
  it('flushes the logger last, after the modules stopped and the reporter was flushed', async () => {
    const journal: Journal = [];

    const app = createApplication({
      modules: [kernelModule({ logger: new JournalledLogger(journal), errorReporter: new JournalledReporter(journal) }), closing],
    });

    await app.start();
    await app.stop();

    expect(journal).toEqual(['reporter flushed', 'logger flushed after 1 entries']);
  });

  it('stops all the same when the logger cannot be flushed', async () => {
    const app = createApplication({ modules: [kernelModule({ logger: new BrokenLogger() })] });

    await app.start();

    await expect(app.stop()).resolves.toBeUndefined();
  });

  it('stops without the kernel module, where no logger is bound', async () => {
    const app = createApplication({ modules: [closingNothing] });

    await app.start();

    await expect(app.stop()).resolves.toBeUndefined();
  });
});

describe('the test application', () => {
  it('flushes its logger when it stops, the one of the kernel or the fake given for it', async () => {
    const journal: Journal = [];
    const app = createTestApplication({ modules: [closing], fakes: [fake(Logger, new JournalledLogger(journal))] });
    const plain = createTestApplication({ modules: [closing] });

    await app.start();
    await app.stop();
    await plain.start();
    await plain.stop();

    expect(journal).toEqual(['logger flushed after 1 entries']);
    expect(plain.logger.entries).toMatchObject([{ message: 'connection closed' }]);
  });
});

const closingNothing = defineContextModule({ name: 'idle', register: () => undefined });
