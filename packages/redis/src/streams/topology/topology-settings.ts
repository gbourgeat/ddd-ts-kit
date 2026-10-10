import type { RetentionOptions } from '../options/retention-options.js';

export interface TopologySettings {
  readonly streamOf: (type: string) => string;
  readonly startFrom: 'new' | 'beginning';
  readonly retention: RetentionOptions | undefined;
}
