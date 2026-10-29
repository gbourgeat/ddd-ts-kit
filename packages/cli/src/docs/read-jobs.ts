import type { Workspace } from '../workspace';
import type { JobFacts } from './context-facts';
import type { ContextTree } from '../model-modules';
import { readJobFiles } from './read-job-files';

/** The jobs of a context, as `readJobFiles` reads them, without their file. */
export function readJobs(ws: Workspace, tree: ContextTree, context: string): JobFacts[] {
  return readJobFiles(ws, tree, context).map(({ name, schedule, command }) => ({ name, schedule, command }));
}
