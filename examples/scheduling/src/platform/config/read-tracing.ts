type Variables = Readonly<Record<string, string | undefined>>;

const consumerModes = ['continue', 'link'] as const;

/** What `tracing.ts` starts with and what the composition root traces by. Nothing is imported here: `tracing.ts` reads it before any other module is loaded. */
export interface TracingConfig {
  /** `OTEL_EXPORTER_OTLP_ENDPOINT`, read by the exporter itself: left out, no span leaves the process. */
  readonly endpoint?: string;
  /** `TRACE_SAMPLE_RATIO`, the share of traces kept, decided where a trace starts. Left out, the standard `OTEL_TRACES_SAMPLER` variables apply and by default every trace is kept. */
  readonly sampleRatio?: number;
  /** `TRACE_CONSUMERS`: `continue`, a consumed event stays in the trace of the request that published it; `link`, each delivery starts a trace linked to it. */
  readonly consumers: (typeof consumerModes)[number];
}

/** Collects every problem by variable name, like `loadConfig`. */
export function readTracing(env: Variables, problems: string[]): TracingConfig {
  const endpoint = (env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? '').trim();
  const sampleRatio = readRatio(env['TRACE_SAMPLE_RATIO'], problems);

  if (endpoint !== '' && !URL.canParse(endpoint)) {
    problems.push('OTEL_EXPORTER_OTLP_ENDPOINT must be a URL, or empty to export nothing');
  }

  return {
    ...(endpoint === '' ? {} : { endpoint }),
    ...(sampleRatio === undefined ? {} : { sampleRatio }),
    consumers: readConsumers(env['TRACE_CONSUMERS'], problems),
  };
}

function readRatio(raw: string | undefined, problems: string[]): number | undefined {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }

  const ratio = Number(raw);

  if (Number.isNaN(ratio) || ratio < 0 || ratio > 1) {
    problems.push('TRACE_SAMPLE_RATIO must be a number between 0 and 1');
  }

  return ratio;
}

function readConsumers(raw: string | undefined, problems: string[]): TracingConfig['consumers'] {
  const mode = consumerModes.find((candidate) => candidate === (raw ?? 'continue'));

  if (mode === undefined) {
    problems.push('TRACE_CONSUMERS must be one of ' + consumerModes.join(', '));
  }

  return mode ?? 'continue';
}
