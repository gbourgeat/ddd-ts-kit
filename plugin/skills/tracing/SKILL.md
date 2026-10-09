---
name: tracing
description: >-
  Adds or reviews non-invasive OpenTelemetry tracing. The SDK starts first, adapters and
  use cases are wrapped at the composition root, trace context travels through integration
  events, no data leaks into spans. Use when the user asks for tracing, observability,
  spans, OpenTelemetry or correlation ids, or when tracing code appears in domain or
  application files.
allowed-tools:
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
---

# Non-invasive tracing

The rule: **no file under `domain/` or `application/` imports a tracing library.** Spans are
added from outside, where objects are wired.

## Setup

1. The SDK starts in its own module, `src/platform/tracing/init.ts`, imported as the first
   line of `src/main.ts`. In an ES module every static import is evaluated before the body, so
   calling `initTracing` at the top of `main.ts` itself is too late: `http` and the database
   drivers are already loaded and auto-instrumentation misses them.
   ```ts
   // src/platform/tracing/init.ts
   import { initTracing } from '@ddd-ts-kit/tracing/node';
   export const tracing = initTracing({ serviceName: 'orders-api' });

   // src/main.ts
   import './platform/tracing/init.js';
   ```
   `node --import ./dist/platform/tracing/init.js dist/main.js` is the alternative.
2. In the composition root, wrap what is bound, by kind:
   ```ts
   createApplication({
     modules,
     decorate: (instance, { context, kind }) =>
       kind ? traceDependency(instance, { kind, context }) : instance,
   });
   ```
   Kinds: `repository`, `gateway` (read of another context), `external` (outside system),
   `use-case`, `publisher`, `consumer`. With NestJS or manual wiring, call `traceDependency` on
   the instance in the provider factory.
3. Wrap the event provider with `tracedPublisher` / `tracedSubscriber`: the `traceparent`
   travels in the envelope and the consumer continues the producer's trace.
4. Logs: add `traceLogFields()` to the logger mixin. Show `correlationIdFromActiveSpan()` to
   end users as a support reference; it is the trace id.

## What a span may carry

Class, method, context, kind, and on failure the error class and the domain error `code`.
Never arguments, return values, error messages or full URLs with query strings: they contain
personal data and secrets. `initTracing` installs the processors that scrub URL secrets and
exception messages; keep them.

## Review checklist

- `npx ddd-ts-kit check --rule layer/domain-purity --rule layer/application-inward` is clean.
- No `tracer.startSpan`, `@Span()` or `span.setAttribute` in a handler or an aggregate. A
  business measure wanted on a trace is a domain event or a metric emitted by an adapter.
- One span per I/O call, none for synchronous in-memory methods.
- Sampling and exporter endpoint come from configuration, not code.
