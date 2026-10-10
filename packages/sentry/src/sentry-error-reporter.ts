import { inspect } from 'node:util';
import type { ErrorReport, ErrorReporter, ErrorSeverity } from '@ddd-ts-kit/kernel';
import { Scope, type NodeClient, type SeverityLevel } from '@sentry/node';
import { activeTrace } from './event/active-trace.js';
import { fingerprintOf } from './event/fingerprint-of.js';
import { tagsOf } from './event/tags-of.js';
import { conceal } from './secrecy/conceal.js';

export interface SentryErrorReporterOptions {
  /** Tags every event with `tenant_id`. Default `false`. */
  readonly tagTenant?: boolean;
}

const LEVELS: Readonly<Record<ErrorSeverity, SeverityLevel>> = {
  fatal: 'fatal',
  error: 'error',
  warning: 'warning',
};

const DESCRIPTION = 'SentryErrorReporter [client concealed]';

/**
 * Sends reports to Sentry, or to GlitchTip, which speaks the same protocol: only the DSN
 * differs. Each report is an event of its own scope: the tags of the report, the actor id as
 * the only thing known of the user, a fingerprint that ignores the message, and the trace of
 * the active OpenTelemetry span, so the event leads to the trace in the tracing backend.
 * `initSentry` builds it; build it yourself around a client you initialised.
 */
export class SentryErrorReporter implements ErrorReporter {
  constructor(
    private readonly client: NodeClient,
    private readonly options: SentryErrorReporterOptions = {},
  ) {
    conceal(this);
  }

  report(error: unknown, report: ErrorReport): void {
    try {
      this.client.captureException(
        error,
        { originalException: error, mechanism: { type: 'generic', handled: report.severity !== 'fatal' } },
        this.scopeOf(error, report),
      );
    } catch {
      return;
    }
  }

  async flush(timeoutMs: number): Promise<boolean> {
    try {
      return await this.client.flush(timeoutMs);
    } catch {
      return false;
    }
  }

  /** What a serialisation shows: a name, never the client, whose options carry the DSN. */
  toJSON(): string {
    return DESCRIPTION;
  }

  /** What `console.log` and `util.inspect` show: the same. */
  [inspect.custom](): string {
    return DESCRIPTION;
  }

  private scopeOf(error: unknown, report: ErrorReport): Scope {
    const scope = new Scope();
    const traced = activeTrace(report.traceId);

    scope.setLevel(LEVELS[report.severity]);
    scope.setTags(tagsOf(report, this.options.tagTenant === true));
    scope.setFingerprint(fingerprintOf(error, report));

    if (report.actorId !== undefined) scope.setUser({ id: report.actorId });

    if (report.extensions !== undefined) scope.setContext('report', { ...report.extensions });

    if (traced !== undefined) {
      scope.setPropagationContext({
        traceId: traced.traceId,
        sampleRand: Math.random(),
        ...(traced.spanId === undefined ? {} : { propagationSpanId: traced.spanId }),
      });
    }

    return scope;
  }
}
