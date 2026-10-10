import { NoopMetrics, type Metrics } from '@ddd-ts-kit/kernel';

// TODO(platform): answer an adapter of the kernel Metrics port (OpenTelemetry, Prometheus) here; until then the series of the bus middlewares and of `timed` are measured by nothing.
export function createMetrics(): Metrics {
  return new NoopMetrics();
}
