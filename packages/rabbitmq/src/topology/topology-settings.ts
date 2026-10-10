import type { QueueType } from '../options/queue-type.js';

export interface TopologySettings {
  readonly exchange: string;
  readonly queueType: QueueType;
  readonly retryDelayMs: number;
}
