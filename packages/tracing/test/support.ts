import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';

export interface TestTracing {
  spans(): ReadableSpan[];
  span(name: string): ReadableSpan;
  teardown(): void;
}

/** Registers a real SDK provider exporting to memory, with the given processors first. */
export function setupTracing(processors: SpanProcessor[] = []): TestTracing {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [...processors, new SimpleSpanProcessor(exporter)],
  });
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(provider);
  return {
    spans: () => exporter.getFinishedSpans(),
    span(name) {
      const found = exporter.getFinishedSpans().find((candidate) => candidate.name === name);
      if (found === undefined) throw new Error(`no span named ${name}`);
      return found;
    },
    teardown() {
      trace.disable();
      context.disable();
    },
  };
}
