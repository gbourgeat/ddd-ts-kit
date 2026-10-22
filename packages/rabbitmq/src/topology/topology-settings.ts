import type { QueueType } from '../options/queue-type';

export interface TopologySettings {
  readonly exchange: string;
  readonly queueType: QueueType;
  readonly retryDelayMs: number;
}
