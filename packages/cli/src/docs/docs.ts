import type { Config } from '../config.js';
import { CliError } from '../errors.js';
import { refreshBarrels } from '../generate/declared.js';
import { replaceRegion } from '../markers.js';
import { readTemplate, renderTemplate } from '../templates.js';
import type { Workspace } from '../workspace.js';
import { refreshContextDoc } from './context-doc.js';
import { contextMapLines } from './context-map.js';
import { readContexts } from './model.js';

export const CONTEXT_MAP = 'docs/context-map.md';
const INTEGRATION_README = 'docs/integration/README.md';

/**
 * Plans every generated part of the documentation: the lists of each CONTEXT.md, the block
 * of the context map, the barrel of each declared context, and, once, the skeleton of what only
 * people can write. The caller
 * commits the workspace, or reads what it would change to detect drift.
 */
export function writeDocs(ws: Workspace, config: Config): void {
  const contexts = readContexts(ws, config);
  for (const context of contexts) {
    if (context.declared && context.onDisk) refreshContextDoc(ws, config, context.name);
  }
  writeContextMap(ws, contextMapLines(contexts));
  refreshBarrels(ws, config);
  // Written by people from here on: never replaced, not even with --force.
  if (!ws.exists(INTEGRATION_README)) ws.create(INTEGRATION_README, renderTemplate('docs/integration-readme.md.tpl', { integration: { strategy: brokerStrategy(config) } }));
}

function writeContextMap(ws: Workspace, lines: readonly string[]): void {
  const existing = ws.read(CONTEXT_MAP);
  const next = replaceRegion(existing ?? readTemplate('docs/context-map.md.tpl'), 'context-map', lines);
  if (next === undefined) {
    throw new CliError(
      `${CONTEXT_MAP} has no "ddd-ts-kit:context-map" markers.`,
      'Put back `<!-- ddd-ts-kit:context-map -->` and `<!-- /ddd-ts-kit:context-map -->` where the generated diagram and table belong; the text around them is yours.',
    );
  }
  if (existing === undefined) ws.create(CONTEXT_MAP, next);
  else ws.update(CONTEXT_MAP, next);
}

const BROKER_STRATEGIES: Readonly<Record<string, string>> = {
  none: 'Same process, no broker: handlers write to the transactional outbox, a relay publishes to the in-memory bus, and each consumer deduplicates in a processed-event store.',
  rabbitmq: 'RabbitMQ: handlers write to the transactional outbox, the relay publishes with publisher confirms, each consuming context reads its own durable queues, acknowledges after its unit of work committed, retries a bounded number of times and then dead-letters.',
  kafka: 'Kafka: handlers write to the transactional outbox, the relay produces each event to the topic of its type and marks the record published once the in-sync replicas acknowledged it, with the aggregate id as record key and a relay ordered per key, so that the events of one aggregate keep their order (`aggregateKeyOf` in the events module of the platform, given to the bus and to the relay; it takes a single running relay). Each consuming context is a consumer group of its own name, commits its offset after its unit of work committed, reads a failed record again after a delay a bounded number of times, then copies it to a dead-letter topic; the processed-event store deduplicates a redelivery.',
  nats: 'NATS JetStream: handlers write to the transactional outbox, the relay publishes each event to the stream and marks the record published once the stream acknowledged it; the stream drops a second publication of the same event id inside its duplicate window. Each consuming context reads through durable consumers of its own name, acknowledges after its unit of work committed, is delivered a failed event again after a delay a bounded number of times, then copies it to a dead-letter stream.',
  redis: 'Redis Streams (Redis, Dragonfly or Valkey): handlers write to the transactional outbox, the relay appends each event to the stream of its type and marks the record published once the server answered its entry, each consuming context reads through a consumer group of its own name, acknowledges after its unit of work committed, is redelivered a bounded number of times after a delay and then moves the event to a dead stream. Durability is what the server is configured for, retention is bounded by its memory, and there is no order per aggregate: carry a version in the payload when it matters.',
  custom: 'A broker of your own behind the EventBus port: handlers write to the transactional outbox, the relay publishes through the adapter in the platform, which is held to the event bus contract suite.',
};

/** The row of the strategy table of docs/ARCHITECTURE.md ("Outbox, by transport") the project chose. */
function brokerStrategy(config: Config): string {
  const { broker, events } = config.stack;
  if (events !== 'outbox') return 'Same process, no outbox: events are published straight to the in-memory bus, so a crash between a commit and its publication loses the event.';
  return BROKER_STRATEGIES[broker] ?? '';
}
