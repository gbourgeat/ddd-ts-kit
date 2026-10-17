{{#if decorators.standard}}
import { decorators } from '@ddd-ts-kit/testing/vitest';
{{/if}}
import { defineConfig } from 'vitest/config';

export default defineConfig({
  {{#if decorators.standard}}
  // The application under test holds classes that carry standard decorators.
  plugins: [decorators({ compiler: '@typescript/native' })],
  {{/if}}
  // An import alias is resolved from the "paths" of tsconfig.json, which name the sources.
  resolve: { tsconfigPaths: true },
  test: {
    include: ['test/e2e/**/*.e2e.spec.ts'],
    {{#if assembly.discovery}}
    // Discovery imports the role files of a context itself: inlined, the package loads them through the runner, which compiles them.
    server: { deps: { inline: ['@ddd-ts-kit/di'] } },
    {{/if}}
    // Each file starts its own application; on a shared server (DATABASE_URL) they would
    // empty each other's tables, so they run one after the other there.
    fileParallelism: (process.env['DATABASE_URL'] ?? '') === '',
{{#if persistence.hasDatabase}}
    // Initialises PostgreSQL in process once: each application starts on a copy of that cluster, and creates its tables there.
    globalSetup: ['test/support/test-database-template.ts'],
{{/if}}
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
