/*
 * Node bootstrap. The only file of the package that loads the OpenTelemetry SDK.
 *
 * `initTracing` must run before any module that requires `http` or a database driver is
 * loaded, otherwise auto-instrumentation registers too late and those modules stay
 * unpatched. Make it the very first statement of `main.ts`. In an ES module, static
 * imports are evaluated before the first statement, so there the call goes in a file of
 * its own (`platform/tracing.ts`) that `main.ts` imports first, or that is preloaded
 * with `node --import`. Packages published as ES modules additionally need the
 * `@opentelemetry/instrumentation` loader hook; CommonJS packages and Node built-ins
 * do not.
 */
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK, resources, tracing } from '@opentelemetry/sdk-node';
import { LocalRootTracker } from '../local-root/local-root-tracker.js';
import { AttributeAllowList } from '../processors/attribute-allow-list.js';
import { ErrorMessageScrubber } from '../processors/error-message-scrubber.js';
import { UrlSecretSpanProcessor } from '../processors/url-secret-span-processor.js';
import { defaultInstrumentations, type AutoInstrumentationSettings } from './default-instrumentations.js';

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
  readonly extraSpanProcessors?: readonly tracing.SpanProcessor[];
  readonly enabled?: boolean;
}

export interface TracingHandle {
  /** Flushes pending spans. Call it on SIGTERM, before the process exits. */
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
    instrumentations: options.instrumentations ?? [instrumentationsOf(options)],
    ...(options.sampleRatio === undefined
      ? {}
      : {
          sampler: new tracing.ParentBasedSampler({
            root: new tracing.TraceIdRatioBasedSampler(options.sampleRatio),
          }),
        }),
  });

  sdk.start();

  return { shutdown: () => sdk.shutdown() };
}

function instrumentationsOf({ ignoredPaths, autoInstrumentations }: InitTracingOptions): ReturnType<typeof defaultInstrumentations> {
  return defaultInstrumentations({
    ...(ignoredPaths === undefined ? {} : { ignoredPaths }),
    ...(autoInstrumentations === undefined ? {} : { settings: autoInstrumentations }),
  });
}

function resourceOf(options: InitTracingOptions): resources.Resource {
  return resources.defaultResource().merge(
    resources.resourceFromAttributes({
      ...(options.serviceVersion === undefined ? {} : { 'service.version': options.serviceVersion }),
      ...(options.environment === undefined
        ? {}
        : { 'deployment.environment.name': options.environment }),
    }),
  );
}

function spanProcessorsOf(options: InitTracingOptions): tracing.SpanProcessor[] {
  const exporter = exporterFor(options);

  return [
    new LocalRootTracker(),
    new UrlSecretSpanProcessor(),
    new ErrorMessageScrubber(),
    new AttributeAllowList(options.allowedAttributes === undefined ? {} : { alsoAllowed: options.allowedAttributes }),
    ...(options.extraSpanProcessors ?? []),
    ...(exporter === undefined ? [] : [new tracing.BatchSpanProcessor(exporter)]),
  ];
}

function exporterFor(options: InitTracingOptions): OTLPTraceExporter | undefined {
  if (options.exporterUrl !== undefined) return new OTLPTraceExporter({ url: options.exporterUrl });

  const fromEnvironment =
    process.env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'] ?? process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];

  // The exporter reads the variables itself and appends `/v1/traces` where the spec says so.
  return fromEnvironment ? new OTLPTraceExporter() : undefined;
}
