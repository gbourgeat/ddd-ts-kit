import type { ConsumerBinding } from './consumer-binding';
import { groupOf } from './group-of';
import type { RedisStreamsTopology } from './redis-streams-topology';
import type { StreamDescription } from './stream-description';
import { streamNamesOf } from './stream-names-of';
import type { TopologySettings } from './topology-settings';

export function topologyOf(settings: TopologySettings, bindings: readonly ConsumerBinding[]): RedisStreamsTopology {
  const types = [...new Set(bindings.map((binding) => binding.type))];

  return {
    streams: [
      ...types.map((type) => eventsStreamOf(settings, type)),
      ...bindings.map((binding) => deadLettersOf(settings, binding)),
    ],
    groups: bindings.map((binding) => groupOf(settings, binding)),
  };
}

function eventsStreamOf(settings: TopologySettings, type: string): StreamDescription {
  const { retention } = settings;

  return { name: settings.streamOf(type), role: 'events', type, ...(retention === undefined ? {} : { retention }) };
}

function deadLettersOf(settings: TopologySettings, binding: ConsumerBinding): StreamDescription {
  const { dead } = streamNamesOf(binding, settings.streamOf);

  return { name: dead, role: 'dead', type: binding.type, consumer: binding.consumer };
}
