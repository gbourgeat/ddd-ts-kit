import type { JobSettings } from '@ddd-ts-kit/kernel';

type Environment = Readonly<Record<string, string | undefined>>;

/** The contexts run as services of their own (`ddd-ts-kit generate service`): the whole application schedules none of their jobs. */
const extracted: readonly string[] = [
  // ddd-ts-kit:extracted
  // /ddd-ts-kit:extracted
];

/**
 * What configuration changes of each scheduled job, by job name: a job is switched off in one
 * environment with `JOB_<CONTEXT>_<JOB>_ENABLED=false`, never by a code change.
 * `ddd-ts-kit generate job` adds a line; a schedule or a timeout read from the environment goes
 * on the same line. The wiring refuses the settings of a job no module declares (`UNKNOWN_JOB`), so each
 * process is given those of the jobs it registers: a service that hosts one context is given a context
 * and keeps its jobs only (the jobs of the platform run in the whole application); the whole application
 * is given none, and leaves out the jobs of the contexts run as services of their own.
 */
export function jobSettings(environment: Environment, context?: string): Readonly<Record<string, JobSettings>> {
  const settings: Readonly<Record<string, JobSettings>> = {
{{#if audit.on}}
    'audit.verify': { enabled: environment['JOB_AUDIT_VERIFY_ENABLED'] !== 'false' },
{{/if}}
{{#if audit.archiveByDefault}}
    'audit.archive': { enabled: environment['JOB_AUDIT_ARCHIVE_ENABLED'] !== 'false' },
{{/if}}
{{#if audit.archiveOnRequest}}
    // Off while the files are on the disk of the server, since an archive removes the entries from the
    // database: JOB_AUDIT_ARCHIVE_ENABLED=true once that disk is durable and backed up.
    'audit.archive': { enabled: environment['JOB_AUDIT_ARCHIVE_ENABLED'] === 'true' },
{{/if}}
{{#if privacy.on}}
    'privacy.purge-expired': { enabled: environment['JOB_PRIVACY_PURGE_EXPIRED_ENABLED'] !== 'false' },
{{/if}}
{{#if events.outbox}}
    'events.purge-published': { enabled: environment['JOB_EVENTS_PURGE_PUBLISHED_ENABLED'] !== 'false' },
{{/if}}
{{#if queue.stored}}
    'jobs.purge-finished': { enabled: environment['JOB_JOBS_PURGE_FINISHED_ENABLED'] !== 'false' },
{{/if}}
    // ddd-ts-kit:jobs
    // /ddd-ts-kit:jobs
  };

  if (context === undefined) {
    return Object.fromEntries(
      Object.entries(settings).filter(([name]) => !extracted.some((hosted) => name.startsWith(hosted + '.'))),
    );
  }

  return Object.fromEntries(Object.entries(settings).filter(([name]) => name.startsWith(context + '.')));
}
