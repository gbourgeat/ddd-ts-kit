import type { JobSettings } from '@ddd-ts-kit/kernel';

type Environment = Readonly<Record<string, string | undefined>>;

/**
 * What configuration changes of each scheduled job, by job name: a job is switched off in one
 * environment with `JOB_<CONTEXT>_<JOB>_ENABLED=false`, never by a code change.
 * `ddd-ts-kit generate job` adds a line; a schedule or a timeout read from the environment goes
 * on the same line. Given a context, only its jobs are kept: the wiring refuses the settings of a
 * job no module declares (`UNKNOWN_JOB`), and a service that hosts one context declares only its own.
 */
export function jobSettings(environment: Environment, context?: string): Readonly<Record<string, JobSettings>> {
  const settings: Readonly<Record<string, JobSettings>> = {
{{#if audit.archive}}
    'audit.archive': { enabled: environment['JOB_AUDIT_ARCHIVE_ENABLED'] !== 'false' },
{{/if}}
{{#if privacy.on}}
    'privacy.purge-expired': { enabled: environment['JOB_PRIVACY_PURGE_EXPIRED_ENABLED'] !== 'false' },
{{/if}}
    // ddd-ts-kit:jobs
    // /ddd-ts-kit:jobs
  };

  if (context === undefined) {
    return settings;
  }

  return Object.fromEntries(Object.entries(settings).filter(([name]) => name.startsWith(context + '.')));
}
