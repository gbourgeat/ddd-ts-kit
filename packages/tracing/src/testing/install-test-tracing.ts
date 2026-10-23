import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type Sampler,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { LocalRootTracker } from '../local-root/local-root-tracker';
import type { SpanNode } from './span-node';
import { spanTreeOf } from './span-tree-of';
import { StartOrder } from './start-order';

export interface TestTracingOptions {
  /** Run after the local root tracker and before the spans are collected, as `extraSpanProcessors` of `initTracing` are. */
  readonly processors?: readonly SpanProcessor[];
  /** Default: every trace is sampled. */
  readonly sampler?: Sampler;
}

export interface TestTracing {
  /** Runs the action and answers the spans that ended since it started, as trees. */
  traceOf(action: () => unknown): Promise<SpanNode[]>;
  /** Every span ended since the last `clear` or `traceOf`, as trees. */
  spans(): SpanNode[];
  clear(): void;
  /** Gives the global tracer provider and context manager back. Call it when the spec is over. */
  uninstall(): void;
}

/**
 * Registers a real tracer provider that keeps the ended spans in memory, with the local root
 * tracker of `initTracing`: what a spec then observes is what an exporter would be sent.
 */
export function installTestTracing(options: TestTracingOptions = {}): TestTracing {
  const exporter = new InMemorySpanExporter();
  const order = new StartOrder();

  const provider = collectingProvider(options, order, exporter);
  const spans = (): SpanNode[] => spanTreeOf(exporter.getFinishedSpans(), (spanId) => order.positionOf(spanId));

  const clear = (): void => {
    exporter.reset();
    order.clear();
  };

  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(provider);

  return {
    spans,
    clear,
    async traceOf(action) {
      clear();
      await action();

      return spans();
    },
    uninstall() {
      trace.disable();
      context.disable();
    },
  };
}

function collectingProvider(
  options: TestTracingOptions,
  order: StartOrder,
  exporter: InMemorySpanExporter,
): BasicTracerProvider {
  const spanProcessors = [
    new LocalRootTracker(),
    order,
    ...(options.processors ?? []),
    new SimpleSpanProcessor(exporter),
  ];

  return new BasicTracerProvider({
    spanProcessors,
    ...(options.sampler === undefined ? {} : { sampler: options.sampler }),
  });
}
