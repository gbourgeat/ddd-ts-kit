import type { MessageProperties, Options } from 'amqplib';
import type { Arguments, StoredMessage } from './model';

export const SERVER_PROPERTIES = {
  host: 'in-memory',
  product: 'InMemoryAmqp',
  version: '0',
  platform: 'Node.js',
  information: 'the broker of the unit run',
};

export function argumentsOf(options: Options.AssertQueue): Arguments {
  const record: unknown = options.arguments;
  const given = typeof record === 'object' && record !== null ? Object.fromEntries(Object.entries(record)) : {};

  return {
    ...given,
    ...(options.messageTtl === undefined ? {} : { 'x-message-ttl': options.messageTtl }),
    ...(options.deadLetterExchange === undefined ? {} : { 'x-dead-letter-exchange': options.deadLetterExchange }),
    ...(options.deadLetterRoutingKey === undefined
      ? {}
      : { 'x-dead-letter-routing-key': options.deadLetterRoutingKey }),
  };
}

export function sameArguments(left: Arguments, right: Arguments): boolean {
  const sorted = (args: Arguments): string =>
    JSON.stringify(Object.entries(args).sort(([a], [b]) => a.localeCompare(b)));

  return sorted(left) === sorted(right);
}

export function propertiesOf(options: Options.Publish): MessageProperties {
  const persistent = options.persistent === true || options.deliveryMode === true || options.deliveryMode === 2;

  return {
    contentType: options.contentType,
    contentEncoding: options.contentEncoding,
    headers: options.headers ?? {},
    deliveryMode: persistent ? 2 : 1,
    priority: options.priority,
    correlationId: options.correlationId,
    replyTo: options.replyTo,
    expiration: options.expiration,
    messageId: options.messageId,
    timestamp: options.timestamp,
    type: options.type,
    userId: options.userId,
    appId: options.appId,
    clusterId: undefined,
  };
}

export function fieldsOf(message: StoredMessage, deliveryTag: number) {
  return {
    deliveryTag,
    redelivered: message.redelivered,
    exchange: message.exchange,
    routingKey: message.routingKey,
  };
}
