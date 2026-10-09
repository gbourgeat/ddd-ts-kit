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
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK, resources, tracing } from '@opentelemetry/sdk-node';
import { LocalRootTracker } from './local-root-tracker.js';
import { ErrorMessageScrubber, UrlSecretSpanProcessor } from './span-processors.js';

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
  /** Share of new traces sampled, 0 to 1. A sampled parent is always followed. */
  readonly sampleRatio?: number;
  /** Replaces the Node auto-instrumentations. */
  readonly instrumentations?: NonNullable<NodeSdkOptions['instrumentations']>;
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

  const exporter = exporterFor(options);
  const spanProcessors: tracing.SpanProcessor[] = [
    new LocalRootTracker(),
    new UrlSecretSpanProcessor(),
    new ErrorMessageScrubber(),
    ...(options.extraSpanProcessors ?? []),
    ...(exporter === undefined ? [] : [new tracing.BatchSpanProcessor(exporter)]),
  ];

  const sdk = new NodeSDK({
    serviceName: options.serviceName,
    resource: resourceOf(options),
    spanProcessors,
    instrumentations: options.instrumentations ?? [getNodeAutoInstrumentations()],
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

function exporterFor(options: InitTracingOptions): OTLPTraceExporter | undefined {
  if (options.exporterUrl !== undefined) return new OTLPTraceExporter({ url: options.exporterUrl });
  const fromEnvironment =
    process.env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'] ?? process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  // The exporter reads the variables itself and appends `/v1/traces` where the spec says so.
  return fromEnvironment ? new OTLPTraceExporter() : undefined;
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
