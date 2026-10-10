import type { Message } from 'amqplib';

/** The headers of a message as a plain record, empty when it carries none. */
export function headersOf(message: Message): Record<string, unknown> {
  const headers: unknown = message.properties.headers;

  return typeof headers === 'object' && headers !== null ? { ...headers } : {};
}
