import type { PersonalFields } from '@ddd-ts-kit/kernel';
import type { Awaitable } from '../awaitable';

/**
 * One declaration of personal fields and the table it describes, as an adapter sees them: how to
 * write rows the way the application does, how to read the rows about a subject back, and a row
 * about a subject whose personal fields hold values of their own.
 */
export interface PersonalDataUnderContract<Row> {
  readonly declaration: PersonalFields<Row>;
  insert(rows: readonly Row[]): Awaitable<void>;
  /** The rows about the subject, as stored, in the order they were inserted. */
  rowsOf(subject: string): Awaitable<readonly Row[]>;
  /** A row about the subject; two rows of one subject differ by `n`, and every personal field holds a value that is neither erased nor empty. */
  aRowOf(subject: string, n: number): Row;
}
