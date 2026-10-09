import { initTracing } from '@ddd-ts-kit/tracing/node';

// Evaluated before the rest of the application (see main.ts), so it reads the environment
// directly instead of going through config.ts.
export const tracing = initTracing({
  serviceName: process.env['OTEL_SERVICE_NAME'] ?? '{{project.name}}',
  environment: process.env['NODE_ENV'] ?? 'development',
});
