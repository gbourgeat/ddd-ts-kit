import type { StreamStorage } from '../options/stream-storage';

export interface TopologySettings {
  readonly stream: string;
  readonly subjectPrefix: string;
  readonly storage: StreamStorage;
  readonly replicas: number;
  readonly duplicateWindowMs: number;
  readonly ackWaitMs: number;
  readonly maxAttempts: number;
}
