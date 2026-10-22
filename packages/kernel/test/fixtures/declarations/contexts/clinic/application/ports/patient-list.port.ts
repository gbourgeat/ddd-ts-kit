import { ReadModelStore } from '../../../../../../../src';

export interface PatientRow {
  readonly id: string;
  readonly visits: number;
}

export abstract class PatientList extends ReadModelStore<PatientRow> {}
