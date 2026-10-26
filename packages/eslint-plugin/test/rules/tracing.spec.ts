import { tracingPlatformOnly } from '../../src/rules/tracing-platform-only';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester';

const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const ADAPTER = `${BILLING}/infrastructure/external/stripe-payment.gateway.ts`;
const ROUTE = `${BILLING}/presentation/http/issue-invoice.route.ts`;
const MODULE = `${BILLING}/billing.module.ts`;
const SPEC = `${BILLING}/test/integration/stripe-payment.gateway.spec.ts`;
const TRACING = "import { traceApplication } from '@ddd-ts-kit/tracing';";
const API = "import { trace } from '@opentelemetry/api';";

const refused = (specifier: string, place: string, platform = 'src/platform') => ({
  messageId: 'tracing' as const,
  data: { specifier, place, platform },
});

const MOVED = { ...SAMPLE_CONFIG, sourceRoot: 'lib', contextsDir: 'lib/contexts', platformDir: 'lib/infra-platform' };

ruleTester.run('tracing-platform-only', tracingPlatformOnly, {
  valid: [
    at(
      'src/platform/observability/tracing.ts',
      `${TRACING}\n${API}\nimport { NodeSDK } from '@opentelemetry/sdk-node';`,
    ),
    at(
      'src/platform/observability/create-logger.ts',
      "import { defaultInstrumentations } from '@ddd-ts-kit/tracing/node';",
    ),
    at('src/platform/tracing.spec.ts', "import { installTestTracing } from '@ddd-ts-kit/tracing/testing';"),
    at(
      'src/main.ts',
      "import './platform/observability/tracing.js';\nimport { initTracing } from '@ddd-ts-kit/tracing/node';",
    ),
    at('src/apps/billing/main.ts', TRACING),
    at('src/apps/worker/main.ts', API),
    at('lib/infra-platform/tracing.ts', TRACING, MOVED),
    at('test/e2e/tracing.e2e.spec.ts', "import { installTestTracing } from '@ddd-ts-kit/tracing/testing';"),
    at('scripts/probe.ts', API),
    at('src/platform/observability/tracing.ts', TRACING, MOVED),
    at('vitest.config.ts', API),
    at(
      ADAPTER,
      "import { retry } from '@ddd-ts-kit/aspects';\nimport { opentelemetry } from './opentelemetry.js';\nimport tracing from 'tracing';",
    ),
    at(ADAPTER, TRACING, { ...SAMPLE_CONFIG, rules: { 'tracing/platform-only': 'off' } }),
    at(
      ADAPTER,
      `// ddd-ts-kit-disable-next-line tracing/platform-only -- ADR-0015: the provider SDK needs the active span to sign its calls\n${API}`,
    ),
  ],
  invalid: [
    { ...at(ADAPTER, TRACING), errors: [refused('@ddd-ts-kit/tracing', 'infrastructure/')] },
    {
      ...at(ADAPTER, `${API}\nimport type { Span } from '@opentelemetry/sdk-trace';`),
      errors: [
        refused('@opentelemetry/api', 'infrastructure/'),
        refused('@opentelemetry/sdk-trace', 'infrastructure/'),
      ],
    },
    {
      ...at(HANDLER, "import { initTracing } from '@ddd-ts-kit/tracing/node';"),
      errors: [refused('@ddd-ts-kit/tracing/node', 'application/')],
    },
    { ...at(AGGREGATE, API), errors: [refused('@opentelemetry/api', 'domain/')] },
    {
      ...at(ROUTE, "const { trace } = await import('@opentelemetry/api');"),
      errors: [refused('@opentelemetry/api', 'presentation/')],
    },
    {
      ...at(MODULE, "export { traceApplication } from '@ddd-ts-kit/tracing';"),
      errors: [refused('@ddd-ts-kit/tracing', 'the module file of "billing"')],
    },
    {
      ...at(SPEC, "import { installTestTracing } from '@ddd-ts-kit/tracing/testing';"),
      errors: [refused('@ddd-ts-kit/tracing/testing', 'test/')],
    },
    { ...at('src/shared-kernel/money.vo.ts', API), errors: [refused('@opentelemetry/api', 'the shared kernel')] },
    {
      ...at('src/telemetry/setup.ts', "const sdk = require('@opentelemetry/sdk-node');"),
      errors: [refused('@opentelemetry/sdk-node', 'src/telemetry/setup.ts')],
    },
    {
      ...at('lib/apps-shared/tracing.ts', TRACING, MOVED),
      errors: [refused('@ddd-ts-kit/tracing', 'lib/apps-shared/tracing.ts', 'lib/infra-platform')],
    },
  ],
});
