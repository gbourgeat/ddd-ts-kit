**`@ddd-ts-kit/tracing` runs on the OpenTelemetry JS SDK 3.0.** `@opentelemetry/sdk-node` 0.300 no
longer exports the `resources` and `tracing` namespaces, so `initTracing` imports the resource
from `@opentelemetry/resources` and the samplers and span processors from `@opentelemetry/sdk-trace`,
the package that replaces `@opentelemetry/sdk-trace-base`. The test harness of
`@ddd-ts-kit/tracing/testing` uses its `TracerProvider`, the former `BasicTracerProvider`. The peer
ranges ask for `@opentelemetry/sdk-node` and `@opentelemetry/exporter-trace-otlp-http` 0.300,
`@opentelemetry/auto-instrumentations-node` 0.82, `@opentelemetry/sdk-trace`,
`@opentelemetry/resources` and `@opentelemetry/context-async-hooks` 3.0, and `@opentelemetry/api`
1.10: the former ranges let a fresh install pull 0.300, which the previous `initTracing` could not
start with. `init` writes these versions.

To move: `npm i @opentelemetry/sdk-node@^0.300.0 @opentelemetry/exporter-trace-otlp-http@^0.300.0
@opentelemetry/auto-instrumentations-node@^0.82.0 @opentelemetry/resources@^3.0.0
@opentelemetry/api@^1.10.0`, then `npm uninstall @opentelemetry/sdk-trace-base` and
`npm i -D @opentelemetry/sdk-trace@^3.0.0 @opentelemetry/context-async-hooks@^3.0.0`; an import of
`@opentelemetry/sdk-trace-base` becomes `@opentelemetry/sdk-trace`, `BasicTracerProvider`
becomes `TracerProvider`, and a span processor takes its exporter as an option:
`new SimpleSpanProcessor({ exporter })`.
