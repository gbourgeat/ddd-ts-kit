import { describe, expect, it } from 'vitest';
import { createAspectFakes, withAspectRuntime } from '@ddd-ts-kit/aspects/testing';
import { InMemoryLogger } from '@ddd-ts-kit/kernel';
import { RemoteMailer } from '@/contexts/notification/infrastructure/external/remote-mailer.adapter';
import { aNotification } from '@/contexts/notification/test/builders/notification.builder';
import { FakeMailer } from '@/contexts/notification/test/fakes/mailer.fake';

class FlakyMailer extends RemoteMailer {
  calls = 0;

  protected override async transport(): Promise<unknown> {
    this.calls += 1;

    if (this.calls === 1) {
      throw new Error('unreachable');
    }

    return 'answered';
  }
}

class UnreachableMailer extends RemoteMailer {
  calls = 0;

  protected override async transport(): Promise<unknown> {
    this.calls += 1;

    throw new Error('unreachable');
  }
}

const reminder = aNotification()
  .sentTo('patient-9')
  .ofKind('reminder')
  .about('appointment-4', new Date('2026-03-05T14:30:00.000Z'));

describe('RemoteMailer', () => {
  it('sends again a call the outside system failed, and answers once it succeeds', async () => {
    const fakes = createAspectFakes();
    const adapter = new FlakyMailer(new InMemoryLogger());
    const pending = withAspectRuntime(fakes, () => adapter.send({ operation: 'ping', payload: {} }));

    await new Promise((resolve) => setImmediate(resolve));
    fakes.scheduler.advance(30_000);

    expect(await pending).toBe('answered');
    expect(adapter.calls).toBe(2);
  });

  it('writes the mail to the application log: the recipient, the kind and the appointment, never the address', async () => {
    const logger = new InMemoryLogger();
    const adapter = new RemoteMailer(logger);

    await withAspectRuntime(createAspectFakes(), () => adapter.deliver('ada@example.test', reminder.build()));

    expect(logger.entries).toMatchObject([
      {
        level: 'info',
        fields: { operation: 'deliver', recipientId: 'patient-9', kind: 'reminder', appointmentId: 'appointment-4' },
      },
    ]);

    expect(JSON.stringify(logger.entries)).not.toContain('ada@example.test');
  });

  it('takes what the fake takes: one mail per delivery, about the same notification', async () => {
    const logger = new InMemoryLogger();
    const fake = new FakeMailer();
    const notification = reminder.build();

    await withAspectRuntime(createAspectFakes(), () =>
      new RemoteMailer(logger).deliver('ada@example.test', notification),
    );

    await fake.deliver('ada@example.test', notification);

    expect(logger.entries).toHaveLength(1);

    expect(fake.delivered).toEqual([
      { address: 'ada@example.test', recipientId: 'patient-9', kind: 'reminder', appointmentId: 'appointment-4' },
    ]);
  });

  it('gives up after three attempts when the outside system stays unreachable, as the fake does on demand', async () => {
    const fakes = createAspectFakes();
    const adapter = new UnreachableMailer(new InMemoryLogger());
    const fake = new FakeMailer();

    const refused = withAspectRuntime(fakes, () => adapter.deliver('ada@example.test', reminder.build())).then(
      () => 'delivered',
      failureMessage,
    );

    await new Promise((resolve) => setImmediate(resolve));
    fakes.scheduler.advance(30_000);
    await new Promise((resolve) => setImmediate(resolve));
    fakes.scheduler.advance(30_000);
    await new Promise((resolve) => setImmediate(resolve));
    fakes.scheduler.advance(30_000);
    const outage = new Error('unreachable');

    fake.failAlwaysWith(outage);

    expect(await refused).toBe('unreachable');
    expect(adapter.calls).toBe(3);
    await expect(fake.deliver('ada@example.test', reminder.build())).rejects.toBe(outage);
  });
});

/** What a refused delivery says, as the test reads it. */
function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'failed';
}
