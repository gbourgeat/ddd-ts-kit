import { reportProcessFailures } from '@ddd-ts-kit/kernel';
import { initSentry } from '@ddd-ts-kit/sentry';
import { loadConfig } from '@/platform/config/load-config';

// Evaluated second, right after tracing.ts (see main.ts). The DSN, the environment and the release
// come from the validated configuration: Sentry and GlitchTip speak the same protocol, only the
// DSN differs. Without SENTRY_DSN nothing starts and nothing is reported.
export const errors = initSentry(loadConfig(process.env).errorReporting);

// What nothing caught (uncaughtException, unhandledRejection): reported as fatal, then exit code 1.
reportProcessFailures(errors);
