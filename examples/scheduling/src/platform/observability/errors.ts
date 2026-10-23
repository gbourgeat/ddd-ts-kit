import { reportProcessFailures } from '@ddd-ts-kit/kernel';
import { initSentry } from '@ddd-ts-kit/sentry';
import { loadConfig } from '@/platform/config/load-config';

// Loaded second, right after tracing.ts (see main.ts): it loads the configuration before `main.ts`
// does, so an invalid one fails here, reported nowhere but stderr. Sentry and GlitchTip speak the
// same protocol, only the DSN differs; without `SENTRY_DSN` nothing starts and nothing is reported.
export const errors = initSentry(loadConfig(process.env).errorReporting);

// What nothing caught (uncaughtException, unhandledRejection): reported as fatal, then exit code 1.
reportProcessFailures(errors);
