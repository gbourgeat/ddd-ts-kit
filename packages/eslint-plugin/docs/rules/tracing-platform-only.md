# ddd-ts-kit/tracing-platform-only

Architecture id: `tracing/platform-only`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every file under the source root, tests included, except the platform directory, `main.ts` and `apps/`.

## Why

Tracing is non-invasive: the platform wires it once, and one action is one trace because every span is opened by the same few places (the request boundary, the bus middleware, the instrumentation around adapters and handlers, the outbox relay). A context that imports the tracing package or the OpenTelemetry API opens spans of its own, with names and attributes nobody reviews, and can no longer be traced differently, or not at all, by changing the composition root alone.

## Reported

- an import of `@ddd-ts-kit/tracing` or of one of its entries (`/node`, `/testing`) outside the platform directory, `main.ts` and `apps/`
- an import of any `@opentelemetry/*` package in the same places

Incorrect:

```ts
// src/contexts/billing/infrastructure/external/stripe-payment.gateway.ts
import { trace } from '@opentelemetry/api';

export class StripePaymentGateway implements PaymentGateway {
  async charge(invoiceId: string): Promise<void> {
    await trace.getTracer('billing').startActiveSpan('charge', () => this.client.charge(invoiceId));
  }
}
```

Correct:

```ts
// src/platform/tracing.ts: the one place that knows the tracing package
import { traceApplication, tracedPublisher } from '@ddd-ts-kit/tracing';
import { initTracing } from '@ddd-ts-kit/tracing/node';

// src/contexts/billing/infrastructure/external/stripe-payment.gateway.ts
export class StripePaymentGateway implements PaymentGateway {
  async charge(invoiceId: string): Promise<void> {
    await this.client.charge(invoiceId);
  }
}
```

## Details

Static imports, type-only imports, `export ... from`, dynamic `import()` and `require()` are all read. The platform directory is `platformDir` of `ddd-ts-kit.config.json`, the source root is `sourceRoot`; `main.ts` is the one at the source root and `apps/` the directory of that name at the source root (`src/apps/<context>/main.ts`, `src/apps/worker/main.ts`).

Judged: every layer of a context, its module file and its tests, the shared kernel and any other file under the source root. Not judged: files outside the source root (the `test/` directory at the root of the project, `scripts/`, config files).

In `domain/` and `application/` the layer rules refuse the same import under their own id, so one import gives two reports there: `layer/*` says the layer is pure, this rule says where tracing lives.

## Options

None. `platformDir` and `sourceRoot` of `ddd-ts-kit.config.json` say where the platform and the sources are.

`rules."tracing/platform-only"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line tracing/platform-only -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A tracing helper re-exported by a file of the platform and imported from there is not followed: that is how a context is expected to receive nothing at all, and a platform that exports its tracer to the contexts defeats the rule.
- Another tracing library (a vendor SDK that is not under `@opentelemetry/`) is not recognised.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the import specifiers it reads in the text of the files, with the same exemptions. This rule is the authority.
