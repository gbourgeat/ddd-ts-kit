import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { isNoisePath } from '../http/is-noise-path.js';
import { NOISE_PATHS } from '../http/noise-paths.js';
import { INSTRUMENTATIONS_OFF } from './instrumentations-off.js';

export type AutoInstrumentationSettings = NonNullable<Parameters<typeof getNodeAutoInstrumentations>[0]>;

export interface DefaultInstrumentationsOptions {
  /** Paths whose incoming requests get no span. Default `NOISE_PATHS`. */
  readonly ignoredPaths?: readonly string[];
  /** Merged over the defaults, per instrumentation: `{ '@opentelemetry/instrumentation-fs': { enabled: true } }`. */
  readonly settings?: AutoInstrumentationSettings;
}

/**
 * On: what tells the story of an action. HTTP, as server and as client (`http`, `undici`, `grpc`),
 * and the database and cache drivers, whose statements are recorded as written, with their
 * placeholders and never the values bound to them, and only inside a trace: a poller or a
 * pool that queries outside of any request makes no span.
 */
const KEPT: AutoInstrumentationSettings = {
  '@opentelemetry/instrumentation-http': {},
  '@opentelemetry/instrumentation-undici': { requireParentforSpans: true },
  '@opentelemetry/instrumentation-grpc': {},
  '@opentelemetry/instrumentation-pg': { requireParentSpan: true, ignoreConnectSpans: true, enhancedDatabaseReporting: false },
  '@opentelemetry/instrumentation-mysql2': { maskStatement: true },
  '@opentelemetry/instrumentation-mysql': { enhancedDatabaseReporting: false },
  '@opentelemetry/instrumentation-mongodb': { requireParentSpan: true, enhancedDatabaseReporting: false },
  '@opentelemetry/instrumentation-ioredis': { requireParentSpan: true },
  '@opentelemetry/instrumentation-redis': { requireParentSpan: true },
};

/**
 * Off: plumbing and duplicates. `fs`, `dns` and `net` describe how a call was made, not what
 * was done. Web framework layers (`express`, `connect`, `router`, `fastify`, `koa`, `hapi`,
 * `restify`, `nestjs-core`) add a span per middleware where the kit names the request by its
 * route. Broker clients (`amqplib`, `kafkajs`) would double the `publish` and `process` spans
 * of the kit. Query builders, pools and loaders (`knex`, `generic-pool`, `dataloader`,
 * `lru-memoizer`, `mongoose`) repeat what the driver says. Logging bridges and runtime metrics
 * are no trace matter. An instrumentation a later version of the bundle adds keeps the default
 * of the bundle until it is listed here.
 */
export function defaultInstrumentations(options: DefaultInstrumentationsOptions = {}): ReturnType<typeof getNodeAutoInstrumentations> {
  const ignoredPaths = options.ignoredPaths ?? NOISE_PATHS;

  const settings: AutoInstrumentationSettings = {
    ...everythingElseOff(),
    ...enabled(KEPT),
    '@opentelemetry/instrumentation-http': {
      enabled: true,
      ignoreIncomingRequestHook: (request) => isNoisePath(request.url ?? '', ignoredPaths),
    },
    ...options.settings,
  };

  return getNodeAutoInstrumentations(settings);
}

function everythingElseOff(): AutoInstrumentationSettings {
  return Object.fromEntries(INSTRUMENTATIONS_OFF.map((name) => [name, { enabled: false }]));
}

function enabled(settings: AutoInstrumentationSettings): AutoInstrumentationSettings {
  return Object.fromEntries(Object.entries(settings).map(([name, config]) => [name, { ...config, enabled: true }]));
}
