import type { DecisionRecord } from './decision-record.js';

export type OnDecision = (record: DecisionRecord) => void | Promise<void>;
