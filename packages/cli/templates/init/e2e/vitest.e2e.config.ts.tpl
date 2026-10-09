import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { standardDecorators } from './vitest.config.js';

export default defineConfig({
  // The application under test may hold adapters that carry standard decorators.
  plugins: [standardDecorators()],
  resolve: { alias: { '{{alias.bare}}': fileURLToPath(new URL('./{{config.sourceRoot}}', import.meta.url)) } },
  test: {
    include: ['test/e2e/**/*.e2e.spec.ts'],
    // Each file starts its own application; on a shared server (DATABASE_URL) they would
    // empty each other's tables, so they run one after the other there.
    fileParallelism: (process.env['DATABASE_URL'] ?? '') === '',
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
