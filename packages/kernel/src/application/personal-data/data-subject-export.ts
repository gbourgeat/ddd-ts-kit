import type { Clock } from '../ports/clock';
import type { PersonalDataExport } from '../ports/personal-data-export';
import type { PersonalDataRecord } from './personal-data-record';

/** What an export is made of: the exports the contexts declare, how to reach every tenant, the clock that dates the document. */
export interface DataSubjectExport {
  /** The exports the contexts declare, one port per context, each reading its `personalFields` declarations. None: an empty document. */
  readonly exports?: readonly PersonalDataExport[];
  /**
   * Runs an export once per tenant, in an execution context of that tenant, and gathers what it
   * answered: a read of tenant data is confined to the tenant of its context (`recordsInEachTenant`).
   * Left out, an export runs once, in the current context.
   */
  readonly inEveryTenant?: (
    work: () => Promise<readonly PersonalDataRecord[]>,
  ) => Promise<readonly PersonalDataRecord[]>;
  /** Dates the document: the instant the records were read. */
  readonly clock: Clock;
  /**
   * Whether the subject exists at all, asked only when no context answered a record: an id that
   * nobody knows is a mistyped one, refused rather than answered with an empty document, which
   * would state that nothing is kept of the person. Left out, every id is taken as known.
   */
  readonly isKnown?: (subject: string) => Promise<boolean>;
}
