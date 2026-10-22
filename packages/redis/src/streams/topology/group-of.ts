import type { ConsumerBinding } from './consumer-binding';
import type { GroupDescription } from './group-description';
import type { TopologySettings } from './topology-settings';

export function groupOf(settings: TopologySettings, binding: ConsumerBinding): GroupDescription {
  return { stream: settings.streamOf(binding.type), name: binding.consumer, startFrom: settings.startFrom };
}
