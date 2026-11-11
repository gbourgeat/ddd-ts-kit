import type { Name } from '../../../naming';
import { MissingPrerequisite } from '../../missing-prerequisite';
import type { Scope } from '../../scope';
import { jobSlug } from './job-slug';
import { jobsSending, type SendingJob, type SendingJobs } from './jobs-sending';

/**
 * The jobs an end-to-end spec starts the use case with: every job of the context that sends its
 * command, or the one `--job` names, by its class (`ImportRows`, `ImportRowsBackgroundJob`) or by
 * the name it runs under (`shipping.import-rows`). The file of each is what the command builds on.
 */
export function startingJobs(scope: Scope, name: Name): SendingJobs {
  const sending = jobsSending(scope, name);
  const asked = scope.flags.job;

  const kept = (jobs: readonly SendingJob[]): SendingJob[] =>
    jobs.filter((job) => asked === undefined || isNamed(job, asked));

  const starting = { scheduled: kept(sending.scheduled), background: kept(sending.background) };
  const all = [...starting.scheduled, ...starting.background];

  if (asked !== undefined && all.length === 0) {
    throw notSending({ scope, name, asked }, sending);
  }

  for (const job of all) {
    scope.flags.builtOn?.(scope.ws.placed(job.file));
  }

  return starting;
}

function isNamed(job: SendingJob, asked: string): boolean {
  return asked.includes('.') ? asked === job.name : jobSlug(asked) === jobSlug(job.className);
}

/** The job `--job` names, for a use case of a context. */
interface AskedJob {
  readonly scope: Scope;
  readonly name: Name;
  readonly asked: string;
}

function notSending({ scope, name, asked }: AskedJob, sending: SendingJobs): MissingPrerequisite {
  const context = scope.context.kebab;
  const senders = [...sending.scheduled, ...sending.background].map((job) => `${job.className} (${job.name})`);

  return new MissingPrerequisite(
    `No job of "${context}" named ${asked} sends ${name.pascal}Command.`,
    senders.length === 0
      ? `Create the job first with \`ddd-ts-kit generate job ${context} <JobName> --every <duration> --command ${name.pascal}\` (a schedule runs it) or \`ddd-ts-kit generate background-job ${context} <Name> --command ${name.pascal}\` (a use case enqueues it).`
      : `Pass --job with one of the jobs that send it: ${senders.join(', ')}.`,
  );
}
