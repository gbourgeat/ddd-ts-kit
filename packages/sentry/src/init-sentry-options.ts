import type { ErrorEvent, EventHint, NodeOptions } from '@sentry/node';

export interface InitSentryOptions {
  /**
   * Where the events go: a Sentry or a GlitchTip project. Without it, or empty, nothing is
   * initialised and the answer reports nothing, so a project starts with none configured.
   * The `SENTRY_DSN` variable is not read behind the back of the configuration.
   */
  readonly dsn?: string;
  readonly environment?: string;
  readonly release?: string;
  /** `false` reports nothing, whatever the DSN. Default `true`. */
  readonly enabled?: boolean;
  /** Share of the error events sent, 0 to 1. Default 1. */
  readonly sampleRate?: number;
  /**
   * Share of the spans started through the Sentry API that are sent as performance data.
   * Default: none. The spans of `@ddd-ts-kit/tracing` never go there: they belong to the
   * tracing backend, and an event leads to them by its trace id.
   */
  readonly tracesSampleRate?: number;
  /**
   * Replaces the message of every error that is not a `DomainError` before it leaves the
   * process. Default `false`: see "Privacy" in the README for the trade-off.
   */
  readonly scrubMessages?: boolean;
  /** Tags every event with `tenant_id`. Default `false`. */
  readonly tagTenant?: boolean;
  /** Runs last, on the event the kit already scrubbed. Answer `null` to drop the event. */
  readonly beforeSend?: (event: ErrorEvent, hint: EventHint) => ErrorEvent | null | PromiseLike<ErrorEvent | null>;
  /** Added to the two the kit installs (linked errors, source context lines). None of the SDK defaults is installed. */
  readonly integrations?: Extract<NodeOptions['integrations'], readonly unknown[]>;
}
