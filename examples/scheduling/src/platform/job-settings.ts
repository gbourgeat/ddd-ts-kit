import type { JobSettings } from '@ddd-ts-kit/kernel';

type Environment = Readonly<Record<string, string | undefined>>;

/**
 * What configuration changes of each scheduled job, by job name: a job is switched off in one
 * environment with `JOB_<CONTEXT>_<JOB>_ENABLED=false`, never by a code change.
 * `ddd-ts-kit generate job` adds a line; a schedule or a timeout read from the environment goes
 * on the same line. Given a context, only its jobs are kept: an application that hosts one
 * context is refused the settings of a job it does not declare.
 */
export function jobSettings(environment: Environment, context?: string): Readonly<Record<string, JobSettings>> {
  const settings: Readonly<Record<string, JobSettings>> = {
    // ddd-ts-kit:jobs
    'scheduling.expire-unconfirmed-appointments': { enabled: environment['JOB_SCHEDULING_EXPIRE_UNCONFIRMED_APPOINTMENTS_ENABLED'] !== 'false' },
    'identity.expire-delegations': { enabled: environment['JOB_IDENTITY_EXPIRE_DELEGATIONS_ENABLED'] !== 'false' },
    'notification.send-due-reminders': { enabled: environment['JOB_NOTIFICATION_SEND_DUE_REMINDERS_ENABLED'] !== 'false' },
    // /ddd-ts-kit:jobs
  };

  if (context === undefined) return settings;

  return Object.fromEntries(Object.entries(settings).filter(([name]) => name.startsWith(context + '.')));
}
