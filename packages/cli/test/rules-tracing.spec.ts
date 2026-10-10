import { describe, expect, it } from 'vitest';
import { runCheck } from '../src/check/engine/run-check.js';
import type { CheckResult } from '../src/check/engine/check-result.js';
import { loadProject } from '../src/check/project/load-project.js';
import { lines, projectWith, reported } from './rules-support.js';

const RULE = 'tracing/platform-only';
const BILLING = 'src/contexts/billing';
const TRACING = "import { traceApplication } from '@ddd-ts-kit/tracing';";
const NODE = "import { initTracing } from '@ddd-ts-kit/tracing/node';";
const API = "import { trace } from '@opentelemetry/api';";

describe('tracing/platform-only', () => {
  it('accepts the tracing package and OpenTelemetry in the platform, main.ts and apps/', () => {
    const files = {
      'src/platform/tracing.ts': lines(TRACING, NODE, API),
      'src/platform/observability/create-logger.ts': lines(API),
      'src/main.ts': lines(NODE),
      'src/apps/billing/main.ts': lines(TRACING),
      'src/apps/worker/main.ts': lines(API),
    };

    expect(found(files)).toEqual([]);
  });

  it('reports them in every layer of a context, its module file, its tests, the shared kernel and the rest of the source root', () => {
    const files = {
      [`${BILLING}/domain/aggregates/invoice.aggregate.ts`]: lines(API),
      [`${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`]: lines(NODE),
      [`${BILLING}/infrastructure/external/stripe-payment.gateway.ts`]: lines(
        '',
        TRACING,
        "import type { Span } from '@opentelemetry/sdk-trace-base';",
      ),
      [`${BILLING}/presentation/http/issue-invoice.route.ts`]: lines(
        "const { trace } = await import('@opentelemetry/api');",
      ),
      [`${BILLING}/billing.module.ts`]: lines("export { traceBindings } from '@ddd-ts-kit/tracing';"),
      [`${BILLING}/test/integration/stripe-payment.gateway.spec.ts`]: lines(
        "import { installTestTracing } from '@ddd-ts-kit/tracing/testing';",
      ),
      'src/shared-kernel/money.vo.ts': lines(API),
      'src/telemetry/setup.ts': lines("const sdk = require('@opentelemetry/sdk-node');"),
    };

    expect(found(files)).toEqual([
      'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts:1 "@ddd-ts-kit/tracing/node" is imported in application/',
      'src/contexts/billing/billing.module.ts:1 "@ddd-ts-kit/tracing" is imported in the module file of "billing"',
      'src/contexts/billing/domain/aggregates/invoice.aggregate.ts:1 "@opentelemetry/api" is imported in domain/',
      'src/contexts/billing/infrastructure/external/stripe-payment.gateway.ts:2 "@ddd-ts-kit/tracing" is imported in infrastructure/',
      'src/contexts/billing/infrastructure/external/stripe-payment.gateway.ts:3 "@opentelemetry/sdk-trace-base" is imported in infrastructure/',
      'src/contexts/billing/presentation/http/issue-invoice.route.ts:1 "@opentelemetry/api" is imported in presentation/',
      'src/contexts/billing/test/integration/stripe-payment.gateway.spec.ts:1 "@ddd-ts-kit/tracing/testing" is imported in test/',
      'src/shared-kernel/money.vo.ts:1 "@opentelemetry/api" is imported in the shared kernel',
      'src/telemetry/setup.ts:1 "@opentelemetry/sdk-node" is imported in src/telemetry/setup.ts',
    ]);
  });

  it('follows platformDir of the config, and names it in the fix', () => {
    const root = projectWith(
      { 'src/infra-platform/tracing.ts': lines(API), 'src/platform/tracing.ts': lines(API) },
      { platformDir: 'src/infra-platform' },
    );

    const { violations } = runOn(root);

    expect(violations.map(({ file }) => file)).toEqual(['src/platform/tracing.ts']);
    expect(violations[0]?.fix).toContain('lives in src/infra-platform/.');
  });

  it('does not judge a file outside the source root, read alone as the editor hook reads it', () => {
    const root = projectWith({
      'test/e2e/tracing.e2e.spec.ts': lines(API),
      'scripts/probe.ts': lines(API),
      [`${BILLING}/infrastructure/external/stripe-payment.gateway.ts`]: lines(API),
    });

    expect(reported(root, RULE, 'test/e2e/tracing.e2e.spec.ts')).toEqual([]);
    expect(reported(root, RULE, 'scripts/probe.ts')).toEqual([]);
    expect(reported(root, RULE, `${BILLING}/infrastructure/external/stripe-payment.gateway.ts`)).toHaveLength(1);
  });

  it('reads import specifiers only, and obeys the config', () => {
    const adapter = lines(
      "// import { trace } from '@opentelemetry/api';",
      "import { retry } from '@ddd-ts-kit/aspects';",
      "import { opentelemetry } from './opentelemetry.js';",
      "const name = '@ddd-ts-kit/tracing';",
    );

    const files = { [`${BILLING}/infrastructure/external/stripe-payment.gateway.ts`]: adapter };

    expect(found(files)).toEqual([]);
    expect(found({ 'src/shared-kernel/money.vo.ts': lines(API) }, { rules: { [RULE]: 'off' } })).toEqual([]);
  });
});

function found(files: Readonly<Record<string, string>>, config: Record<string, unknown> = {}): string[] {
  return reported(projectWith(files, config), RULE).map(
    ({ file, line, message }) => `${file}:${line} ${message.slice(0, message.indexOf(':'))}`,
  );
}

function runOn(root: string): CheckResult {
  return runCheck(loadProject(root), { rules: [RULE] });
}
