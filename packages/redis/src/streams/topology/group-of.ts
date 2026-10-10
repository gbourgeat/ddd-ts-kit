import type { ConsumerBinding } from './consumer-binding.js';
import type { GroupDescription } from './group-description.js';
import type { TopologySettings } from './topology-settings.js';

export function groupOf(settings: TopologySettings, binding: ConsumerBinding): GroupDescription {
  return { stream: settings.streamOf(binding.type), name: binding.consumer, startFrom: settings.startFrom };
}
