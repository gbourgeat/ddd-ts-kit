import type { ConfirmChannel } from 'amqplib';
import type { Publication } from '../codec/publication.js';
import { PublishNotConfirmedError } from '../errors/publish-not-confirmed-error.js';

/** Sends a message to a queue through the default exchange and waits for its confirmation. */
export function sendConfirmed(
  channel: ConfirmChannel,
  queue: string,
  publication: Publication,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const confirmed = (error: unknown): void => {
      if (error === null || error === undefined) {
        resolve();
      } else {
        reject(new PublishNotConfirmedError(String(publication.properties.messageId)));
      }
    };

    try {
      channel.sendToQueue(queue, publication.content, publication.properties, confirmed);
    } catch {
      confirmed(new Error('channel closed'));
    }
  });
}
