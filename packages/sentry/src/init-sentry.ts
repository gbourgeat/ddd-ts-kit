import { NoopErrorReporter, type ErrorReporter } from '@ddd-ts-kit/kernel';
import {
  contextLinesIntegration,
  initWithoutDefaultIntegrations,
  linkedErrorsIntegration,
  type NodeOptions,
} from '@sentry/node';
import type { InitSentryOptions } from './init-sentry-options.js';
import { scrubEvent } from './scrubbing/scrub-event.js';
import { SentryErrorReporter } from './sentry-error-reporter.js';

/*
 * The SDK collects all of this unless told not to (`dataCollection` replaced `sendDefaultPii`
 * and defaults to collecting). Nothing here is on: the kit says what an event carries.
 */
const NOTHING_COLLECTED: NonNullable<NodeOptions['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};

/**
 * The `ErrorReporter` of the application, on Sentry or GlitchTip. Without a DSN it reports
 * nothing and the SDK is not started. With one, the SDK is started for errors only: none of
 * its default integrations, so no instrumentation of `http` or of a driver, no console or
 * request breadcrumbs, no handler of uncaught errors on the process, no local variables; no OpenTelemetry setup,
 * so the tracer provider, the context manager and the propagator stay those of
 * `@ddd-ts-kit/tracing`; no performance data unless `tracesSampleRate` is given.
 */
export function initSentry(options: InitSentryOptions = {}): ErrorReporter {
  if (options.enabled === false || options.dsn === undefined || options.dsn === '') return new NoopErrorReporter();

  const client = initWithoutDefaultIntegrations(sdkOptionsOf(options, options.dsn));

  return client === undefined
    ? new NoopErrorReporter()
    : new SentryErrorReporter(client, { tagTenant: options.tagTenant === true });
}

function sdkOptionsOf(options: InitSentryOptions, dsn: string): NodeOptions {
  const { environment, release, sampleRate, tracesSampleRate } = options;

  return {
    dsn,
    ...(environment === undefined ? {} : { environment }),
    ...(release === undefined ? {} : { release }),
    ...(sampleRate === undefined ? {} : { sampleRate }),
    ...(tracesSampleRate === undefined ? {} : { tracesSampleRate }),
    integrations: [linkedErrorsIntegration(), contextLinesIntegration(), ...(options.integrations ?? [])],
    enableOpenTelemetrySetup: false,
    enableRuntimeChannelInjection: false,
    includeLocalVariables: false,
    sendClientReports: false,
    dataCollection: NOTHING_COLLECTED,
    beforeSend: beforeSendOf(options),
  };
}

function beforeSendOf(options: InitSentryOptions): NonNullable<NodeOptions['beforeSend']> {
  const scrubbing = { scrubMessages: options.scrubMessages === true };

  return (event, hint) => {
    const scrubbed = scrubEvent(event, hint, scrubbing);

    return options.beforeSend === undefined ? scrubbed : options.beforeSend(scrubbed, hint);
  };
}
