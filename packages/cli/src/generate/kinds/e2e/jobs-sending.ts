import { readJobs } from '../../../docs/read-jobs';
import { toName, type Name } from '../../../naming';
import { treeOf } from '../../../model-modules';
import type { Scope } from '../../scope';

/** The name of a job as the scheduler knows it, `<context>.<job>`, of each job of the context that sends the command of the use case. */
export function jobsSending(scope: Scope, name: Name): string[] {
  const context = scope.context.kebab;

  return readJobs(scope.ws, treeOf(scope.config, context), context)
    .filter((job) => job.command === name.pascal)
    .map((job) => (job.name.includes('.') ? job.name : `${context}.${toName(job.name.replace(/Job$/, '')).kebab}`));
}
