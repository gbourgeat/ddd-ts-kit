import type { Environment } from '@/platform/config/environment';

const consumerModes = ['continue', 'link'] as const;

/** What `tracing.ts` starts with and what the composition root traces by. Only a type is imported here: `tracing.ts` reads it before any other module is loaded. */
export interface TracingConfig {
  /** `OTEL_EXPORTER_OTLP_ENDPOINT`, read by the exporter itself: left out, no span leaves the process. */
  readonly endpoint?: string;
  /** `TRACE_SAMPLE_RATIO`, the share of traces kept, decided where a trace starts. Left out, the standard `OTEL_TRACES_SAMPLER` variables apply and by default every trace is kept. */
  readonly sampleRatio?: number;
  /** `TRACE_CONSUMERS`: `continue`, a consumed event stays in the trace of the request that published it; `link`, each delivery starts a trace linked to it. */
  readonly consumers: (typeof consumerModes)[number];
}

export function readTracing(env: Environment): TracingConfig {
  const endpoint = env.optionalUrl('OTEL_EXPORTER_OTLP_ENDPOINT', 'to export nothing');
  const sampleRatio = readRatio(env);

  return {
    ...(endpoint === undefined ? {} : { endpoint }),
    ...(sampleRatio === undefined ? {} : { sampleRatio }),
    consumers: env.oneOf('TRACE_CONSUMERS', consumerModes, 'continue'),
  };
}

function readRatio(env: Environment): number | undefined {
  const written = env.optional('TRACE_SAMPLE_RATIO');

  if (written === undefined) {
    return undefined;
  }

  const ratio = Number(written);

  if (Number.isNaN(ratio) || ratio < 0 || ratio > 1) {
    env.problem('TRACE_SAMPLE_RATIO must be a number between 0 and 1');
  }

  return ratio;
}
