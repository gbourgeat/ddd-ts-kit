import type { DecisionRecord } from './decision-record';

export type OnDecision = (record: DecisionRecord) => void | Promise<void>;
