import { readJobFiles } from '../../../docs/read-job-files';
import { toName, type Name } from '../../../naming';
import { treeOf } from '../../../model-modules';
import type { Scope } from '../../scope';

/**
 * The name of a job as the scheduler knows it, `<context>.<job>`, of each job of the context that
 * sends the command of the use case; the file of each is what the command builds on.
 */
export function jobsSending(scope: Scope, name: Name): string[] {
  const context = scope.context.kebab;

  return readJobFiles(scope.ws, treeOf(scope.config, context), context)
    .filter((job) => job.command === name.pascal)
    .map((job) => {
      scope.flags.builtOn?.(scope.ws.placed(job.file));

      return job.name.includes('.') ? job.name : `${context}.${toName(job.name.replace(/Job$/, '')).kebab}`;
    });
}
