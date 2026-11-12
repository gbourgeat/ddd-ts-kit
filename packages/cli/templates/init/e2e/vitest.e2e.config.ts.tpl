{{#if decorators.standard}}
import { decorators } from '@ddd-ts-kit/testing/vitest';
{{/if}}
import { defineConfig } from 'vitest/config';

{{#if persistence.hasDatabase}}
// Each spec file starts its own application on a database of its own, PostgreSQL in process or a copy of the one
// DATABASE_URL names (test/support/test-database-clone.ts): the files run at the same time, on a server too.
{{/if}}
{{#unless persistence.hasDatabase}}
// Each spec file starts its own application, which keeps what it stores in its own memory: the files run at the same time.
{{/unless}}
export default defineConfig({
  {{#if decorators.standard}}
  // The application under test holds classes that carry standard decorators.
  plugins: [decorators({ compiler: '@typescript/native' })],
  {{/if}}
  // An import alias is resolved from the "paths" of tsconfig.json, which name the sources.
  resolve: { tsconfigPaths: true },
  test: {
    include: ['test/e2e/**/*.e2e.spec.ts', 'test/acceptance/**/*.acceptance.spec.ts'],
    {{#if assembly.discovery}}
    // Discovery imports the role files of a context itself: inlined, the package loads them through the runner, which compiles them.
    server: { deps: { inline: ['@ddd-ts-kit/di'] } },
    {{/if}}
{{#if endToEnd.sharedServer}}
    // {{endToEnd.sharedBy}}:
    // with {{endToEnd.sharedVariables}} set, the files run one after the other.
    fileParallelism: {{endToEnd.apartInVitest}},
{{/if}}
{{#if persistence.hasDatabase}}
    // Initialises PostgreSQL in process once: each application starts on a copy of that cluster, and creates its tables there.
    // With DATABASE_URL, copies the migrated database once instead, and checks that the workers of the run fit on the server.
    globalSetup: ['test/support/test-database-template.ts', 'test/support/test-database-run.ts'],
{{/if}}
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
