import { defineContextModule, type ContextModule } from '@ddd-ts-kit/di';
import { runPurge } from '{{alias.platform}}/privacy/run-purge{{alias.ext}}';

/**
 * Privacy as a capability of the platform: every night at 03:00 UTC, the rows that outlived the
 * retention their declaration gives are purged (`privacy.purge-expired`, switched off in one
 * environment with `JOB_PRIVACY_PURGE_EXPIRED_ENABLED=false`).
 */
export function privacyModule({ jobs = true }: { readonly jobs?: boolean } = {}): ContextModule {
  return defineContextModule({
    name: 'privacy',
    register(builder) {
      // Registered by the process that runs the jobs of the platform; a service of the deployment passes `jobs: false`.
      if (jobs) {
        builder.job('privacy.purge-expired', { cron: '0 3 * * *', tenancy: 'global' }).handledByFactory((resolve) => ({
          run: async () => {
            await runPurge(resolve);
          },
        }));
      }
    },
  });
}
