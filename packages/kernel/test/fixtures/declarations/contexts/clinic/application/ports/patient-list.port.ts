import { ReadModelStore } from '../../../../../../../src/index.js';

export interface PatientRow {
  readonly id: string;
  readonly visits: number;
}

export abstract class PatientList extends ReadModelStore<PatientRow> {}
