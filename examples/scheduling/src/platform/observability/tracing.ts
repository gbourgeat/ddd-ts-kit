import { initTracing } from '@ddd-ts-kit/tracing/node';
import { Environment } from '@/platform/config/environment';
import { readTracing } from '@/platform/config/read-tracing';

// Loaded first (see main.ts), before any module an instrumentation patches: it cannot use
// `loadConfig`, so it reads `OTEL_SERVICE_NAME` and `NODE_ENV` itself, with the defaults of
// `loadConfig`. The OTLP endpoint is read by the exporter, from the standard variable.
const env = new Environment(process.env);
const settings = readTracing(env);

env.assertValid();

export const tracing = initTracing({
  serviceName: env.optional('OTEL_SERVICE_NAME') ?? 'scheduling',
  environment: env.optional('NODE_ENV') ?? 'development',
  ...(settings.sampleRatio === undefined ? {} : { sampleRatio: settings.sampleRatio }),
});
