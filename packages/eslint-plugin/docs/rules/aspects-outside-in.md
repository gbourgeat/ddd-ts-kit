# ddd-ts-kit/aspects-outside-in

Architecture id: `aspects/outside-in`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every production file under the source root, except `infrastructure/` of a context and the platform directory; `domain/` and `application/` are left to the layer rules.

## Why

Logging, metrics, retry, timeout, circuit breaking and caching are applied from outside the code they wrap: the policy of a whole application is read in one place, the composition root, and changes without touching a class. The decorator form is the exception, kept for an adapter whose policy is part of what the adapter is (a client of a provider that documents its own retry and timeout rules). On a route, in a module file, in a published language or in the shared kernel, a decorator hides a policy where nobody looks for one.

## Reported

- an import of `@ddd-ts-kit/aspects/decorators` in `presentation/`, in `<context>.module.ts`, in `published-language/`, in any other production file of a context outside `infrastructure/`, in the shared kernel, in `main.ts` and in any other source under the source root (`apps/<context>/main.ts` included)

Incorrect:

```ts
// src/contexts/billing/presentation/http/issue-invoice.route.ts
import { Retry } from '@ddd-ts-kit/aspects/decorators';
```

Correct:

```ts
// src/contexts/billing/billing.module.ts
import { retry, timeout } from '@ddd-ts-kit/aspects';

builder.bind(PAYMENT_GATEWAY).toClass(StripePaymentGateway, [CONFIG]).with(retry({ attempts: 3 }), timeout(2000));

// src/contexts/billing/infrastructure/external/stripe-payment.gateway.ts
import { Retry } from '@ddd-ts-kit/aspects/decorators';
```

## Details

Only the `/decorators` entry is judged: the wrappers of `@ddd-ts-kit/aspects` (`retry`, `timeout`, `aspects`, the bus middlewares) are what a module file and `main.ts` are expected to import. Static imports, type-only imports, `export ... from`, dynamic `import()` and `require()` are all read.

In `domain/` and `application/` every entry of `@ddd-ts-kit/aspects` is already refused by `layer-domain-purity` and `layer-application-inward`: this rule stays silent there, so that one import gives one report. Tests and files outside the source root (scripts, config files) are not judged.

## Options

None. `platformDir` and `sourceRoot` of `ddd-ts-kit.config.json` say where the platform and the sources are.

`rules."aspects/outside-in"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line aspects/outside-in -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A decorator re-exported by a file of `infrastructure/` or of the platform and imported from there is not followed.
- A home-made decorator built on `weave` or on an aspect of the root entry is not recognised.
- With `layer/domain-purity` or `layer/application-inward` set to `off`, nothing reports the decorators in that layer.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the import specifiers it reads in the text of the files, with the same exemptions. This rule is the authority.
