import { Retry, Timeout } from '@ddd-ts-kit/aspects/decorators';
import { Logger } from '@ddd-ts-kit/kernel';
import { Adapter } from '@ddd-ts-kit/kernel/declarations';
import { Mailer } from '@/contexts/notification/application/ports/mailer.port';
import type { Notification } from '@/contexts/notification/domain/aggregates/notification.aggregate';
import { ownPolicy } from '@/platform/resilience/own-policy';

interface OutboundCall {
  readonly operation: string;
  readonly payload: Readonly<Record<string, string>>;
}

/**
 * The mailer of development: no provider behind it, the mail is written to the application log.
 * Identifiers only reach the log, never the address nor the body of a mail.
 */
@Adapter(Mailer, { kind: 'external', aspects: [ownPolicy()] })
export class RemoteMailer implements Mailer {
  constructor(private readonly logger: Logger) {}

  async deliver(address: string, notification: Notification): Promise<void> {
    await this.send({
      operation: 'deliver',
      payload: {
        recipientId: notification.recipientId,
        kind: notification.kind.value,
        appointmentId: notification.appointmentId,
      },
    });
  }

  @Retry({ attempts: 3, backoff: { baseMs: 100 } })
  @Timeout(2000, { signal: true })
  async send(call: OutboundCall, signal?: AbortSignal): Promise<unknown> {
    return this.transport(call, signal);
  }

  protected async transport(call: OutboundCall, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted();

    this.logger.info('mail handed to the development mailer', {
      context: 'notification',
      operation: call.operation,
      ...call.payload,
    });

    return undefined;
  }
}
