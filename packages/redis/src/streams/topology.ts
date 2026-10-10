import type { Redis } from 'ioredis';
import { failureCode } from './errors.js';
import { DEFAULT_PREFIX, type RetentionOptions } from './options.js';

export interface StreamDescription {
  readonly name: string;
  /** `events` is published to and read by every group; `dead` keeps what one consumer gave up on. */
  readonly role: 'events' | 'dead';
  readonly type: string;
  /** The consumer a dead stream belongs to. */
  readonly consumer?: string;
  /** The trimming each publication applies to an events stream, when one is configured. */
  readonly retention?: RetentionOptions;
}

export interface GroupDescription {
  readonly stream: string;
  /** The consumer name. */
  readonly name: string;
  readonly startFrom: 'new' | 'beginning';
}

/** Everything the bus creates on the server, as data: for documentation and reviews. */
export interface RedisStreamsTopology {
  readonly streams: readonly StreamDescription[];
  readonly groups: readonly GroupDescription[];
}

export interface StreamNames {
  readonly events: string;
  readonly dead: string;
}

export interface ConsumerBinding {
  readonly consumer: string;
  readonly type: string;
}

export interface TopologySettings {
  readonly streamOf: (type: string) => string;
  readonly startFrom: 'new' | 'beginning';
  readonly retention: RetentionOptions | undefined;
}

/** The streams of a consumer for a type. `streamOf` is the mapping the bus was built with, the default one otherwise. */
export function streamNamesOf({ consumer, type }: ConsumerBinding, streamOf: (type: string) => string = defaultStreamOf): StreamNames {
  const events = streamOf(type);
  return { events, dead: deadStreamOf(events, consumer) };
}

/** Dead letters are a fact of one consumer: each has its own dead stream beside the stream it reads. */
export function deadStreamOf(stream: string, consumer: string): string {
  return `${stream}:${consumer}:dead`;
}

export function topologyOf(settings: TopologySettings, bindings: readonly ConsumerBinding[]): RedisStreamsTopology {
  const types = [...new Set(bindings.map((binding) => binding.type))];
  return {
    streams: [...types.map((type) => eventsStreamOf(settings, type)), ...bindings.map((binding) => deadLettersOf(settings, binding))],
    groups: bindings.map((binding) => groupOf(settings, binding)),
  };
}

/** Idempotent: a group that exists is left where it is, a stream that does not is created empty. */
export async function declareTopology(client: Redis, topology: RedisStreamsTopology): Promise<void> {
  for (const group of topology.groups) {
    await createGroup(client, group);
  }
}

export async function createGroup(client: Redis, group: GroupDescription): Promise<void> {
  try {
    await client.xgroup('CREATE', group.stream, group.name, group.startFrom === 'new' ? '$' : '0', 'MKSTREAM');
  } catch (error) {
    if (failureCode(error) !== GROUP_EXISTS) throw error;
  }
}

export function groupOf(settings: TopologySettings, binding: ConsumerBinding): GroupDescription {
  return { stream: settings.streamOf(binding.type), name: binding.consumer, startFrom: settings.startFrom };
}

const GROUP_EXISTS = 'REDIS_BUSYGROUP';

function defaultStreamOf(type: string): string {
  return `${DEFAULT_PREFIX}:${type}`;
}

function eventsStreamOf(settings: TopologySettings, type: string): StreamDescription {
  const { retention } = settings;
  return { name: settings.streamOf(type), role: 'events', type, ...(retention === undefined ? {} : { retention }) };
}

function deadLettersOf(settings: TopologySettings, binding: ConsumerBinding): StreamDescription {
  const { dead } = streamNamesOf(binding, settings.streamOf);
  return { name: dead, role: 'dead', type: binding.type, consumer: binding.consumer };
}
