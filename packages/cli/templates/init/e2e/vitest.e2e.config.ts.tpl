import { fileURLToPath } from 'node:url';
{{#if decorators.standard}}
import { decorators } from '@ddd-ts-kit/testing/vitest';
{{/if}}
import { defineConfig } from 'vitest/config';

export default defineConfig({
  {{#if decorators.standard}}
  // The application under test holds classes that carry standard decorators.
  plugins: [decorators({ compiler: '@typescript/native' })],
  {{/if}}
  resolve: { alias: { '{{alias.bare}}': fileURLToPath(new URL('./{{config.sourceRoot}}', import.meta.url)) } },
  test: {
    include: ['test/e2e/**/*.e2e.spec.ts'],
    {{#if assembly.discovery}}
    // Discovery imports the role files of a context itself: inlined, the package loads them through the runner, which compiles them.
    server: { deps: { inline: ['@ddd-ts-kit/di'] } },
    {{/if}}
    // Each file starts its own application; on a shared server (DATABASE_URL) they would
    // empty each other's tables, so they run one after the other there.
    fileParallelism: (process.env['DATABASE_URL'] ?? '') === '',
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
