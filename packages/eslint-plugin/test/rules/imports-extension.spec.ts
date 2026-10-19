import { importsExtension } from '../../src/rules/imports-extension.js';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester.js';

const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const AGGREGATE = '@/contexts/billing/domain/aggregates/invoice.aggregate';
const E2E = 'test/e2e/issue-invoice.e2e.spec.ts';
const NONE = { ...SAMPLE_CONFIG, importExtension: 'none' };
const JS = { ...SAMPLE_CONFIG, importExtension: 'js' };
const NONE_WITH_PRISMA = { ...NONE, stack: { orm: 'prisma' } };

ruleTester.run('imports-extension, "importExtension": "none"', importsExtension, {
  valid: [
    at(HANDLER, `import { Invoice } from '${AGGREGATE}';\nexport * from '${AGGREGATE}';`, NONE),
    at(HANDLER, `const later = import('${AGGREGATE}');\ntype Loaded = typeof import('${AGGREGATE}');`, NONE),
    at(E2E, "import { startApplication } from '$test/e2e/support/start-application';", NONE),
    at('scripts/openapi.ts', "import { composeApplication } from '@/platform/composition/compose-application';", NONE),
    // A package is not a file of the project, whatever its subpath ends with.
    at(HANDLER, "import { z } from 'zod/v4/core.js';\nimport { x } from '@scope/pkg/file.js';", NONE),
    at(HANDLER, "import { Clock } from '@ddd-ts-kit/kernel';\nimport path from 'node:path';", NONE),
    // A relative import is the business of imports/alias-only, whose fix writes the right ending.
    at(HANDLER, "import { x } from './x.js';", NONE),
    at('vitest.config.ts', "import base from '@/vitest.base.js';", NONE),
    at('generated/prisma/client.ts', "export * from '$generated/prisma/internal/class.js';", NONE_WITH_PRISMA),
    at(HANDLER, 'const later = import(`@/contexts/${name}.js`);', NONE),
    at(HANDLER, `import { Invoice } from '${AGGREGATE}.js';`, { ...NONE, rules: { 'imports/extension': 'off' } }),
  ],
  invalid: [
    {
      ...at(HANDLER, `import { Invoice } from '${AGGREGATE}.js';`, NONE),
      output: `import { Invoice } from '${AGGREGATE}';`,
      errors: [
        {
          messageId: 'unexpected',
          data: { specifier: `${AGGREGATE}.js`, extension: '.js', expected: AGGREGATE },
        },
      ],
    },
    {
      ...at(
        HANDLER,
        `export { Invoice } from "${AGGREGATE}.js";\nexport * from '${AGGREGATE}.ts';\nconst later = import('${AGGREGATE}.mjs');\ntype Loaded = typeof import('${AGGREGATE}.js');`,
        NONE,
      ),
      output: `export { Invoice } from "${AGGREGATE}";\nexport * from '${AGGREGATE}';\nconst later = import('${AGGREGATE}');\ntype Loaded = typeof import('${AGGREGATE}');`,
      errors: [
        { messageId: 'unexpected' },
        { messageId: 'unexpected' },
        { messageId: 'unexpected' },
        { messageId: 'unexpected' },
      ],
    },
    {
      ...at(E2E, "import { startApplication } from '$test/e2e/support/start-application.js';", NONE),
      output: "import { startApplication } from '$test/e2e/support/start-application';",
      errors: [{ messageId: 'unexpected' }],
    },
    {
      ...at('scripts/openapi.ts', "import { run } from '$scripts/support/run.js';", NONE),
      output: "import { run } from '$scripts/support/run';",
      errors: [{ messageId: 'unexpected' }],
    },
    {
      ...at('src/main.ts', "import { PrismaClient } from '$generated/prisma/client.js';", NONE_WITH_PRISMA),
      output: "import { PrismaClient } from '$generated/prisma/client';",
      errors: [{ messageId: 'unexpected' }],
    },
    {
      ...at(HANDLER, "import { x } from '$app/platform/x.js';", { ...NONE, importAlias: '$app/' }),
      output: "import { x } from '$app/platform/x';",
      errors: [{ messageId: 'unexpected' }],
    },
  ],
});

ruleTester.run('imports-extension, "importExtension": "js" and a config without the key', importsExtension, {
  valid: [
    at(HANDLER, `import { Invoice } from '${AGGREGATE}.js';\nconst later = import('${AGGREGATE}.js');`, JS),
    at(HANDLER, `import { Invoice } from '${AGGREGATE}.js';`),
    at(HANDLER, "import { worker } from '@/platform/worker.mjs';", JS),
    at(HANDLER, "import { z } from 'zod/v4/core';\nimport { Clock } from '@ddd-ts-kit/kernel';", JS),
    at(HANDLER, "import { x } from './x';", JS),
    // A value `ddd-ts-kit check` reports (config/valid) is read as "js".
    at(HANDLER, `import { Invoice } from '${AGGREGATE}.js';`, { ...SAMPLE_CONFIG, importExtension: 'ts' }),
  ],
  invalid: [
    {
      ...at(HANDLER, `import { Invoice } from '${AGGREGATE}';`, JS),
      output: `import { Invoice } from '${AGGREGATE}.js';`,
      errors: [{ messageId: 'missing', data: { specifier: AGGREGATE, extension: '', expected: `${AGGREGATE}.js` } }],
    },
    {
      ...at(HANDLER, `import { Invoice } from '${AGGREGATE}';`),
      output: `import { Invoice } from '${AGGREGATE}.js';`,
      errors: [{ messageId: 'missing' }],
    },
    {
      ...at(HANDLER, `export * from '${AGGREGATE}.ts';\ntype Loaded = typeof import("${AGGREGATE}");`, JS),
      output: `export * from '${AGGREGATE}.js';\ntype Loaded = typeof import("${AGGREGATE}.js");`,
      errors: [{ messageId: 'missing' }, { messageId: 'missing' }],
    },
    {
      ...at(E2E, "import { startApplication } from '$test/e2e/support/start-application';", JS),
      output: "import { startApplication } from '$test/e2e/support/start-application.js';",
      errors: [{ messageId: 'missing' }],
    },
  ],
});
