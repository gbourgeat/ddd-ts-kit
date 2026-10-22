import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import { handler } from './handler';
import { PATHS } from './paths';
import { project } from './project';

const { ADAPTER, MODULE } = PATHS;
const RULE = 'tracing/platform-only';
const TRACING = "import { traceApplication } from '@ddd-ts-kit/tracing';\n";
const API = "import { trace } from '@opentelemetry/api';\n";

const SPEC =
  "import { installTestTracing } from '@ddd-ts-kit/tracing/testing';\nimport { it } from 'vitest';\n\nit.todo('behaves');\n";

export const TRACING_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'tracing wired by the platform, main.ts and the entry point of a context',
    expect: 'pass',
    files: project({
      'src/platform/observability/tracing.ts': `${TRACING}${API}import { initTracing } from '@ddd-ts-kit/tracing/node';\n\nexport const tracing = initTracing(traceApplication, trace);\n`,
      'src/platform/tracing.spec.ts': SPEC,
      'src/main.ts': `${TRACING}\nawait traceApplication();\n`,
      'src/apps/billing/main.ts': `${API}\ntrace.getTracer('billing');\n`,
    }),
  },
  {
    ruleId: RULE,
    name: 'an adapter opening a span with the OpenTelemetry API',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]: `${API}export class InMemoryInvoiceRepository {\n  readonly tracer = trace.getTracer('billing');\n}\n`,
    }),
  },
  {
    ruleId: RULE,
    name: 'the tracing package in a module file',
    expect: { file: MODULE },
    files: project({ [MODULE]: `${TRACING}export const billingModule = traceApplication;\n` }),
  },
  {
    ruleId: RULE,
    name: 'the tracing package in a use case, refused by its layer too',
    expect: { file: PATHS.HANDLER },
    also: ['layer/application-inward'],
    files: project(handler(`${TRACING}export class IssueInvoiceHandler {\n  readonly traced = traceApplication;\n}\n`)),
  },
  {
    ruleId: RULE,
    name: 'the test entry of the tracing package in a spec of a context, and the default directory once the platform is moved',
    expect: { file: 'src/platform/observability/tracing.ts' },
    files: project(
      {
        [`${PATHS.BILLING}/test/unit/spans.spec.ts`]: SPEC,
        'src/platform/observability/tracing.ts': `${API}export const tracer = trace.getTracer('billing');\n`,
        'src/infra-platform/tracing.ts': `${API}export const tracer = trace;\n`,
      },
      { [CONFIG_FILE]: config({ platformDir: 'src/infra-platform' }) },
    ),
  },
];
