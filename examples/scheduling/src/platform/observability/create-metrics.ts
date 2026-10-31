import type { Metrics } from '@ddd-ts-kit/kernel';
import { openTelemetryMetrics } from '@ddd-ts-kit/tracing';

// On the meter provider `initTracing` registered (`tracing.ts`, imported first by main.ts): the
// series leave by OTLP with the spans when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and are measured
// by nothing when it is not, nor in the tests.
export function createMetrics(): Metrics {
  return openTelemetryMetrics({ meterName: 'scheduling' });
}
