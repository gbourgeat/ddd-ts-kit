import type { Message } from 'amqplib';
import { headersOf } from './headers-of.js';
import type { Publication } from './publication.js';

/** The same message, to send to another queue with `headers` added or replaced. */
export function republication(message: Message, headers: Record<string, string | number>): Publication {
  const { properties } = message;

  return {
    content: message.content,
    properties: {
      persistent: true,
      contentType: 'application/json',
      ...textProperty('messageId', properties.messageId),
      ...textProperty('type', properties.type),
      ...textProperty('correlationId', properties.correlationId),
      headers: { ...headersOf(message), ...headers },
    },
  };
}

function textProperty(name: string, value: unknown): Record<string, string> {
  return typeof value === 'string' ? { [name]: value } : {};
}
