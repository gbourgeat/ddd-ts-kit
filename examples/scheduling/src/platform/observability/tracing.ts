import { initTracing } from '@ddd-ts-kit/tracing/node';
import { Environment } from '@/platform/config/environment';
import { readTracing } from '@/platform/config/read-tracing';

// Evaluated before the rest of the application (see main.ts): it validates the variables of its
// own and reads the two names directly, so that no module an instrumentation patches is loaded
// before it. The OTLP endpoint is read by the exporter itself, from the standard variable.
const env = new Environment(process.env);
const settings = readTracing(env);

env.assertValid();

export const tracing = initTracing({
  serviceName: env.optional('OTEL_SERVICE_NAME') ?? 'scheduling',
  environment: env.optional('NODE_ENV') ?? 'development',
  ...(settings.sampleRatio === undefined ? {} : { sampleRatio: settings.sampleRatio }),
});
