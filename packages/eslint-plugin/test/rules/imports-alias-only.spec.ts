import { importsAliasOnly } from '../../src/rules/imports-alias-only';
import { inProject, onDisk } from '../support/declared-project';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester';

const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const COMMAND = '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';
const AGGREGATE = '@/contexts/billing/domain/aggregates/invoice.aggregate.js';
const E2E = 'test/e2e/issue-invoice.e2e.spec.ts';
const RENAMED = { ...SAMPLE_CONFIG, importAlias: '$app/' };
const NESTED = { ...SAMPLE_CONFIG, sourceRoot: 'apps/api/src' };
const WITH_PRISMA = { ...SAMPLE_CONFIG, stack: { orm: 'prisma' } };
const BARE = { ...SAMPLE_CONFIG, importExtension: 'none' };
const SETUP = 'test/support/test-database-setup.ts';

onDisk('test/support/parts/index.ts', 'export const part = 1;\n');
onDisk('test/support/parts-of-a-run.ts', 'export const run = 1;\n');
onDisk('test/support/test-database-run/part.ts', 'export const part = 1;\n');
onDisk('test/support/test-database-run.ts', 'export const run = 1;\n');

ruleTester.run('imports-alias-only', importsAliasOnly, {
  valid: [
    at(HANDLER, `import { IssueInvoiceCommand } from '${COMMAND}';\nimport { Invoice } from '${AGGREGATE}';`),
    at(HANDLER, `export * from '${COMMAND}';\nconst later = import('${AGGREGATE}');`),
    at(HANDLER, "import { Clock } from '@ddd-ts-kit/kernel';\nimport path from 'node:path';\nimport { z } from 'zod';"),
    at(E2E, "import { startApplication } from '$test/e2e/support/start-application.js';"),
    at('scripts/openapi.ts', "import { composeApplication } from '@/platform/composition/compose-application.js';"),
    at('src/platform/database/database.ts', "import { PrismaClient } from '$generated/prisma/client.js';", WITH_PRISMA),
    at('vitest.config.ts', "import base from './vitest.base.js';"),
    // A test runner loads its global setup before any alias exists: the files of test/support import one another by `./<name>`, the `.ts` of the source where an import carries an extension.
    at(SETUP, "import { openRun } from './test-database-run.ts';\nimport { saved } from './test-database-saved.mts';"),
    at(
      'test/support/test-database-run.ts',
      "export * from './test-database-server';\nconst later = import('./test-database-budget');",
      BARE,
    ),
    // A file that has a directory of its name beside it is the neighbour.
    inProject('test/support/parts-of-a-run.ts', "import { openRun } from './test-database-run';", BARE),
    at('generated/prisma/client.ts', "export * from './internal/class.js';", WITH_PRISMA),
    at(HANDLER, 'const later = import(`./${name}.js`);'),
    at(
      HANDLER,
      "// ddd-ts-kit-disable-next-line imports/alias-only -- ADR-0007 a generated file read next to this one\nimport { rows } from './rows.js';",
    ),
    at(HANDLER, "import { x } from './x.js';", { ...SAMPLE_CONFIG, rules: { 'imports/alias-only': 'off' } }),
  ],
  invalid: [
    // The ".js" the compiler would emit passes the type check, and a test runner then finds no such file.
    {
      ...at(SETUP, "import { openRun } from './test-database-run.js';\nexport * from './test-database-server';"),
      output: "import { openRun } from './test-database-run.ts';\nexport * from './test-database-server.ts';",
      errors: [
        {
          messageId: 'neighbourSource',
          data: { specifier: './test-database-run.js', extension: '.js', expected: './test-database-run.ts' },
        },
        { messageId: 'neighbourSource' },
      ],
    },
    {
      ...at(
        SETUP,
        "import { openRun } from './test-database-run.ts';\nconst later = import('./test-database-budget.js');",
        BARE,
      ),
      output: "import { openRun } from './test-database-run';\nconst later = import('./test-database-budget');",
      errors: [
        {
          messageId: 'neighbourExtension',
          data: { specifier: './test-database-run.ts', extension: '.ts', expected: './test-database-run' },
        },
        { messageId: 'neighbourExtension' },
      ],
    },
    // Neither the directory itself, nor its parent, nor a directory of it is a neighbour file.
    {
      ...at(SETUP, "import { everything } from './.';\nimport { tests } from './..';", BARE),
      output: "import { everything } from '$test/support';\nimport { tests } from './..';",
      errors: [{ messageId: 'relative' }, { messageId: 'unnamed' }],
    },
    {
      ...inProject(SETUP, "import { part } from './parts';", BARE),
      output: "import { part } from '$test/support/parts';",
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at(
        'test/support/test-database-setup.ts',
        "import { startApplication } from '../e2e/support/start-application.js';",
      ),
      output: "import { startApplication } from '$test/e2e/support/start-application.js';",
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at('test/support/test-database-setup.ts', "import { part } from './parts/part.js';"),
      output: "import { part } from '$test/support/parts/part.js';",
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at('test/e2e/support/start-application.ts', "import { credentials } from './create-credentials.js';"),
      output: "import { credentials } from '$test/e2e/support/create-credentials.js';",
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at(HANDLER, "import { IssueInvoiceCommand } from './issue-invoice.command.js';"),
      output: `import { IssueInvoiceCommand } from '${COMMAND}';`,
      errors: [{ messageId: 'relative', data: { specifier: './issue-invoice.command.js', alias: COMMAND } }],
    },
    {
      ...at(HANDLER, 'import type { Invoice } from "../../../domain/aggregates/invoice.aggregate.js";'),
      output: `import type { Invoice } from "${AGGREGATE}";`,
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at(
        HANDLER,
        "export { Invoice } from '../../../domain/aggregates/invoice.aggregate.js';\nexport * from './issue-invoice.command.js';\nconst later = import('./issue-invoice.command.js');\ntype Loaded = typeof import('./issue-invoice.command.js');",
      ),
      output: `export { Invoice } from '${AGGREGATE}';\nexport * from '${COMMAND}';\nconst later = import('${COMMAND}');\ntype Loaded = typeof import('${COMMAND}');`,
      errors: [
        { messageId: 'relative' },
        { messageId: 'relative' },
        { messageId: 'relative' },
        { messageId: 'relative' },
      ],
    },
    {
      ...at(HANDLER, "import { Money } from '../../../../../shared-kernel/money.vo';"),
      output: "import { Money } from '@/shared-kernel/money.vo.js';",
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at(HANDLER, "import { Product } from '../../../../catalog/domain/aggregates/product.aggregate.js';", RENAMED),
      output: "import { Product } from '$app/contexts/catalog/domain/aggregates/product.aggregate.js';",
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at('apps/api/src/platform/http/start-http-server.ts', "import { errors } from '../errors.js';", NESTED),
      output: "import { errors } from '@/platform/errors.js';",
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at(E2E, "import { startApplication } from './support/start-application.js';"),
      output: "import { startApplication } from '$test/e2e/support/start-application.js';",
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at(E2E, "import { loadConfig } from '../../src/platform/config/load-config.js';"),
      output: "import { loadConfig } from '@/platform/config/load-config.js';",
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at(
        'scripts/openapi.ts',
        "import { securitySchemes } from '../src/platform/auth/authentication/security-schemes.js';",
      ),
      output: "import { securitySchemes } from '@/platform/auth/authentication/security-schemes.js';",
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at(
        'src/platform/database/database.ts',
        "import { PrismaClient } from '../../../generated/prisma/client.js';",
        {
          ...WITH_PRISMA,
        },
      ),
      output: "import { PrismaClient } from '$generated/prisma/client.js';",
      errors: [{ messageId: 'relative' }],
    },
    {
      ...at('src/main.ts', "import manifest from '../package.json' with { type: 'json' };"),
      output: null,
      errors: [{ messageId: 'unnamed', data: { specifier: '../package.json', directories: 'src/, test/, scripts/' } }],
    },
    {
      ...at(HANDLER, "import { Product } from '@/contexts/billing/../catalog/domain/aggregates/product.aggregate.js';"),
      output: null,
      errors: [{ messageId: 'segment' }],
    },
    {
      ...at(HANDLER, "import { secret } from '@/../secrets.js';"),
      output: null,
      errors: [{ messageId: 'segment' }],
    },
  ],
});
