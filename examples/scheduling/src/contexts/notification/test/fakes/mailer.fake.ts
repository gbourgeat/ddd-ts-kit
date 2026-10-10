import type { Mailer } from '../../application/ports/mailer.port.js';
import type { Notification } from '../../domain/aggregates/notification.aggregate.js';

interface DeliveredMail {
  readonly address: string;
  readonly recipientId: string;
  readonly kind: string;
  readonly appointmentId: string;
}

export class FakeMailer implements Mailer {
  /** What the provider took, in order. */
  readonly delivered: DeliveredMail[] = [];

  /** Every call, the refused ones included. */
  attempts = 0;

  private readonly failures: Error[] = [];

  private outage: Error | undefined;

  /** The next delivery fails with this error, then the mailer works again. */
  failNextWith(error: Error): void {
    this.failures.push(error);
  }

  /** Every delivery fails with this error, until `recover`. */
  failAlwaysWith(error: Error): void {
    this.outage = error;
  }

  recover(): void {
    this.outage = undefined;
  }

  async deliver(address: string, notification: Notification): Promise<void> {
    this.attempts += 1;

    const failure = this.outage ?? this.failures.shift();

    if (failure !== undefined) {
      throw failure;
    }

    this.delivered.push({
      address,
      recipientId: notification.recipientId,
      kind: notification.kind.value,
      appointmentId: notification.appointmentId,
    });
  }
}
