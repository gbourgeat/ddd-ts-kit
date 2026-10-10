import { initTracing } from '@ddd-ts-kit/tracing/node';
import { ConfigError } from '{{alias.platform}}/config/config-error.js';
import { readTracing } from '{{alias.platform}}/config/read-tracing.js';

// Evaluated before the rest of the application (see main.ts): it validates the variables of its
// own and reads the two names directly, so that no module an instrumentation patches is loaded
// before it. The OTLP endpoint is read by the exporter itself, from the standard variable.
const problems: string[] = [];
const settings = readTracing(process.env, problems);

if (problems.length > 0) {
  throw new ConfigError(problems);
}

export const tracing = initTracing({
  serviceName: process.env['OTEL_SERVICE_NAME'] ?? '{{project.name}}',
  environment: process.env['NODE_ENV'] ?? 'development',
  ...(settings.sampleRatio === undefined ? {} : { sampleRatio: settings.sampleRatio }),
});
