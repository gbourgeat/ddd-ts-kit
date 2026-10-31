/*
 * Node bootstrap. The only file of the package that loads the OpenTelemetry SDK.
 *
 * `initTracing` must run before any module that requires `http` or a database driver is
 * loaded, otherwise auto-instrumentation registers too late and those modules stay
 * unpatched. Make it the very first statement of `main.ts`. In an ES module, static
 * imports are evaluated before the first statement, so there the call goes in a file of
 * its own (`platform/observability/tracing.ts`) that `main.ts` imports first, or that is preloaded
 * with `node --import`. Packages published as ES modules additionally need the
 * `@opentelemetry/instrumentation` loader hook; CommonJS packages and Node built-ins
 * do not.
 */
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { defaultResource, type Resource, resourceFromAttributes } from '@opentelemetry/resources';
import { type IMetricReader, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  type SpanProcessor,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace';
import { LocalRootTracker } from '../local-root/local-root-tracker';
import { AttributeAllowList } from '../processors/attribute-allow-list';
import { ErrorMessageScrubber } from '../processors/error-message-scrubber';
import { UrlSecretSpanProcessor } from '../processors/url-secret-span-processor';
import { defaultInstrumentations, type AutoInstrumentationSettings } from './default-instrumentations';

type NodeSdkOptions = NonNullable<ConstructorParameters<typeof NodeSDK>[0]>;

export interface InitTracingOptions {
  readonly serviceName: string;
  readonly serviceVersion?: string;
  /** Reported as `deployment.environment.name`. */
  readonly environment?: string;
  /**
   * Full OTLP/HTTP traces URL, for example `http://collector:4318/v1/traces`. Without
   * it, the standard `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and `OTEL_EXPORTER_OTLP_ENDPOINT`
   * variables are honoured; with none of them, nothing is exported.
   */
  readonly exporterUrl?: string;
  /**
   * Share of new traces sampled, 0 to 1, decided where a trace starts: a sampled parent is
   * always followed, so a trace is kept or dropped whole, across processes. Without it, the
   * standard `OTEL_TRACES_SAMPLER` and `OTEL_TRACES_SAMPLER_ARG` variables are honoured, and
   * by default every trace is kept. Keeping the traces that end in error whatever the ratio is
   * tail sampling, which is the work of a collector: sample everything here and decide there.
   */
  readonly sampleRatio?: number;
  /** Replaces the default instrumentations altogether. */
  readonly instrumentations?: NonNullable<NodeSdkOptions['instrumentations']>;
  /** Changes the settings of the default instrumentations, one by one: turns one on, or off, or configures it. */
  readonly autoInstrumentations?: AutoInstrumentationSettings;
  /** Paths whose incoming requests get no span. Default `NOISE_PATHS`: probes, metrics, documentation. */
  readonly ignoredPaths?: readonly string[];
  /** Attribute names, or prefixes ending with a dot, kept on spans besides `DEFAULT_ALLOWED_ATTRIBUTES`. */
  readonly allowedAttributes?: readonly string[];
  /** Run after the built-in scrubbing processors and before the exporter. */
  readonly extraSpanProcessors?: readonly SpanProcessor[];
  /**
   * How often the metrics leave, in milliseconds. Without it, the standard
   * `OTEL_METRIC_EXPORT_INTERVAL` variable is honoured, and by default the SDK's 60 seconds.
   * The metrics leave by OTLP/HTTP when `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` or
   * `OTEL_EXPORTER_OTLP_ENDPOINT` is set; with none of them, nothing is exported and the
   * instruments of `openTelemetryMetrics` measure nothing. `OTEL_METRICS_EXPORTER=none` keeps
   * the metrics in the process while the spans still leave; a value other than `otlp` (a list
   * included) is read as `none`, since no other exporter is served.
   */
  readonly metricsExportIntervalMillis?: number;
  readonly enabled?: boolean;
}

export interface TracingHandle {
  /** Flushes pending spans and metrics. Call it on SIGTERM, before the process exits. */
  shutdown(): Promise<void>;
}

export function initTracing(options: InitTracingOptions): TracingHandle {
  if (options.enabled === false || process.env['OTEL_SDK_DISABLED']?.toLowerCase() === 'true') {
    return { shutdown: async () => {} };
  }

  const sdk = new NodeSDK({
    serviceName: options.serviceName,
    resource: resourceOf(options),
    spanProcessors: spanProcessorsOf(options),
    metricReaders: metricReadersOf(options),
    instrumentations: options.instrumentations ?? [instrumentationsOf(options)],
    ...(options.sampleRatio === undefined
      ? {}
      : {
          sampler: new ParentBasedSampler({
            root: new TraceIdRatioBasedSampler(options.sampleRatio),
          }),
        }),
  });

  sdk.start();

  return { shutdown: () => sdk.shutdown() };
}

function instrumentationsOf({
  ignoredPaths,
  autoInstrumentations,
}: InitTracingOptions): ReturnType<typeof defaultInstrumentations> {
  return defaultInstrumentations({
    ...(ignoredPaths === undefined ? {} : { ignoredPaths }),
    ...(autoInstrumentations === undefined ? {} : { settings: autoInstrumentations }),
  });
}

function resourceOf(options: InitTracingOptions): Resource {
  return defaultResource().merge(
    resourceFromAttributes({
      ...(options.serviceVersion === undefined ? {} : { 'service.version': options.serviceVersion }),
      ...(options.environment === undefined ? {} : { 'deployment.environment.name': options.environment }),
    }),
  );
}

function spanProcessorsOf(options: InitTracingOptions): SpanProcessor[] {
  const exporter = exporterFor(options);

  return [
    new LocalRootTracker(),
    new UrlSecretSpanProcessor(),
    new ErrorMessageScrubber(),
    new AttributeAllowList(options.allowedAttributes === undefined ? {} : { alsoAllowed: options.allowedAttributes }),
    ...(options.extraSpanProcessors ?? []),
    ...(exporter === undefined ? [] : [new BatchSpanProcessor({ exporter })]),
  ];
}

function exporterFor(options: InitTracingOptions): OTLPTraceExporter | undefined {
  if (options.exporterUrl !== undefined) {
    return new OTLPTraceExporter({ url: options.exporterUrl });
  }

  const fromEnvironment =
    process.env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'] ?? process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];

  // The exporter reads the variables itself and appends `/v1/traces` where the spec says so.
  return fromEnvironment ? new OTLPTraceExporter() : undefined;
}

function metricReadersOf(options: InitTracingOptions): IMetricReader[] {
  const fromEnvironment =
    process.env['OTEL_EXPORTER_OTLP_METRICS_ENDPOINT'] ?? process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];

  if (!fromEnvironment || !exportsByOtlp()) {
    // An empty list, not none: left out, the SDK would export to localhost by default.
    return [];
  }

  const interval = options.metricsExportIntervalMillis ?? intervalFromEnvironment();

  // The exporter reads the variables itself and appends `/v1/metrics` where the spec says so.
  return [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      ...(interval === undefined ? {} : { exportIntervalMillis: interval }),
    }),
  ];
}

function intervalFromEnvironment(): number | undefined {
  const interval = Number(process.env['OTEL_METRIC_EXPORT_INTERVAL']);

  return Number.isFinite(interval) && interval > 0 ? interval : undefined;
}

/** `OTEL_METRICS_EXPORTER` unset, empty or `otlp`; `none` and every value not served say no. */
function exportsByOtlp(): boolean {
  const exporter = (process.env['OTEL_METRICS_EXPORTER'] ?? '').trim().toLowerCase();

  return exporter === '' || exporter === 'otlp';
}
