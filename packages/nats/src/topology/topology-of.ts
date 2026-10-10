import { bindingNamesOf } from './binding-names-of.js';
import type { ConsumerBinding } from './consumer-binding.js';
import type { ConsumerDescription } from './consumer-description.js';
import { deadStreamOf } from './dead-stream-of.js';
import type { NatsTopology } from './nats-topology.js';
import type { TopologySettings } from './topology-settings.js';

export function topologyOf(settings: TopologySettings, bindings: readonly ConsumerBinding[]): NatsTopology {
  const { stream, subjectPrefix, storage, replicas, duplicateWindowMs } = settings;
  const shared = { storage, replicas, duplicateWindowMs };

  return {
    streams: [
      { name: stream, role: 'events', subjects: [`${subjectPrefix}.>`], ...shared },
      { name: deadStreamOf(stream), role: 'dead', subjects: [`dead.${subjectPrefix}.>`], ...shared },
    ],
    consumers: bindings.map((binding) => consumerOf(settings, binding)),
  };
}

/**
 * The bus parks a message at its `maxAttempts`-th failed delivery. The limit of the server
 * is twice that: a delivery lost without a verdict (a crash, an expired acknowledgement
 * wait) counts too, and must leave room for the message to be parked.
 */
function consumerOf(settings: TopologySettings, binding: ConsumerBinding): ConsumerDescription {
  const names = bindingNamesOf(binding, settings.subjectPrefix);

  return {
    stream: settings.stream,
    name: names.durable,
    filterSubject: names.subject,
    ackWaitMs: settings.ackWaitMs,
    maxDeliver: settings.maxAttempts * 2,
  };
}
