import { StdoutLogger } from '@ddd-ts-kit/aspects';
import { NoopLogger, NoopMetrics, type ExecutionScope, type LogLevel, type Logger, type Metrics } from '@ddd-ts-kit/kernel';
import { traceLogFields } from '@ddd-ts-kit/tracing';

/** Where log entries go. Left out (the tools, the tests), the application writes nothing. */
export interface LogSettings {
  readonly level: LogLevel;
  readonly service: string;
}

/**
 * JSON lines on the standard output. Every entry carries what the execution scope knows of the
 * work in progress (correlation id, origin, actor, tenant) and the ids of the active trace, so
 * a request is followed from its log lines to its spans and to its audit entries.
 */
export function createLogger(scope: ExecutionScope, settings: LogSettings | undefined): Logger {
  if (settings === undefined) return new NoopLogger();
  return new StdoutLogger({ level: settings.level, base: { service: settings.service }, fields: () => traceLogFields(scope) });
}

// TODO(platform): bind an adapter of the kernel Metrics port (OpenTelemetry, Prometheus) here; until then the series of the bus middlewares and of `timed` are measured by nothing.
export function createMetrics(): Metrics {
  return new NoopMetrics();
}
