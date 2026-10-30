import type { Name } from '../../../naming';
import type { PayloadField } from './payload-field';

/** What a library is told to write the schema of one job. */
export interface PayloadOf {
  readonly name: Name;
  readonly vendor: string;
  readonly fields: readonly PayloadField[];
}
