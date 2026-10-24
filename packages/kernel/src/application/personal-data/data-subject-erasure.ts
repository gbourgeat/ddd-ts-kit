import type { SubjectKeyStore } from '../ports/subject-key-store';
import type { PersonalDataCopy } from './personal-data-copy';
import type { ProjectionToRebuild } from './projection-to-rebuild';

/** What an erasure is made of: the keys, the copies the contexts keep, how to reach every tenant, the projections to rebuild. */
export interface DataSubjectErasure {
  /**
   * The keys the personal values of the stored events are sealed with: the key of the subject is
   * destroyed first. Left out, nothing is sealed, as in a project whose aggregates are rows: the
   * copies alone are erased, and the report says no key was destroyed.
   */
  readonly keys?: SubjectKeyStore;
  /** The copies the contexts keep of a data subject in clear, erased after the key, in every tenant. None: the key and the rebuilds alone. */
  readonly copies?: readonly PersonalDataCopy[];
  /**
   * Runs a copy once per tenant, in an execution context of that tenant, and sums what it erased:
   * a copy writes tenant data, which no elevation widens (`inEachTenant`). Left out, a copy runs
   * once, in the current context.
   */
  readonly inEveryTenant?: (work: () => Promise<number>) => Promise<number>;
  /** The projections fed by the event store, rebuilt once the key is gone. None: nothing is rebuilt. */
  readonly rebuilds?: readonly ProjectionToRebuild[];
  /**
   * Whether the subject exists at all, asked only when no key was destroyed and no copy erased:
   * an id that destroys no key, erases nothing and that nobody knows is a mistyped one, refused
   * before the rebuilds; one that somebody knows is a run again. Left out, every id is taken as
   * known. A subject with a key is erased whether anybody still knows it or not: the key comes
   * first, the record after.
   */
  readonly isKnown?: (subject: string) => Promise<boolean>;
}
