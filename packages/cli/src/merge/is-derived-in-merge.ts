import { BEHAVIOUR_PAGES } from '../derived/behaviour-pages';
import { isDerived } from '../derived/is-derived';
import type { MergeRepository } from './lost/merge-repository';

/** Whether `inProject` (relative to the project root) is a file the kit derives, as a merge sees it: what `isDerived` lists, and the behaviour pages. */
export function isDerivedInMerge(inProject: string, repo: MergeRepository): boolean {
  return isDerived(inProject, repo) || inProject.startsWith(BEHAVIOUR_PAGES);
}
