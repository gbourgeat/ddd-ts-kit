import { isDerived } from '../derived/is-derived';
import type { MergeRepository } from './lost/merge-repository';

/** The pages of what the tests state, which `npm run docs:generate` writes from the specs. */
const BEHAVIOUR_PAGES = 'docs/behaviour/';

/** Whether `inProject` (relative to the project root) is a file the kit derives, as a merge sees it: what `isDerived` lists, and the behaviour pages. */
export function isDerivedInMerge(inProject: string, repo: MergeRepository): boolean {
  return isDerived(inProject, repo) || inProject.startsWith(BEHAVIOUR_PAGES);
}
