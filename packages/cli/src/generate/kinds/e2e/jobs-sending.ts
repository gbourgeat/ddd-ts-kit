import { readBackgroundJobs } from '../../../docs/read-background-jobs';
import { readJobFiles } from '../../../docs/read-job-files';
import { toName, type Name } from '../../../naming';
import { treeOf } from '../../../model-modules';
import type { Scope } from '../../scope';

/** A job that sends the command of a use case, as an end-to-end spec starts it. */
export interface SendingJob {
  /** The name the job runs under, `<context>.<job>`: what the scheduler runs, or the static `jobName` of a background job. */
  readonly name: string;
  readonly className: string;
  /** The file of the job, which the command builds on. */
  readonly file: string;
}

/** The jobs of a context that send the command of a use case. */
export interface SendingJobs {
  /** Those a schedule runs (`application/scheduling/`). */
  readonly scheduled: readonly SendingJob[];
  /** Those a use case enqueues and a worker runs (`application/background/`). */
  readonly background: readonly SendingJob[];
}

/** Each job of the context that sends the command of the use case, scheduled or background. */
export function jobsSending(scope: Scope, name: Name): SendingJobs {
  return { scheduled: scheduledSending(scope, name), background: backgroundSending(scope, name) };
}

function scheduledSending(scope: Scope, name: Name): SendingJob[] {
  const context = scope.context.kebab;

  return readJobFiles(scope.ws, treeOf(scope.config, context), context)
    .filter((job) => job.command === name.pascal)
    .map((job) => {
      const declared = toName(job.file.slice(job.file.lastIndexOf('/') + 1, -'.job.ts'.length));

      return {
        name: job.name.includes('.') ? job.name : `${context}.${declared.kebab}`,
        className: `${declared.pascal}Job`,
        file: job.file,
      };
    });
}

function backgroundSending(scope: Scope, name: Name): SendingJob[] {
  const sends = new RegExp(String.raw`\bnew ${name.pascal}Command\(`);

  return readBackgroundJobs(scope.ws, treeOf(scope.config, scope.context.kebab)).filter((job) =>
    sends.test(scope.ws.read(job.file) ?? ''),
  );
}
