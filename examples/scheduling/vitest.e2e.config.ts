import { defineConfig } from 'vitest/config';

export default defineConfig({
  // An import alias is resolved from the "paths" of tsconfig.json, which name the sources.
  resolve: { tsconfigPaths: true },
  test: {
    include: ['test/e2e/**/*.e2e.spec.ts'],
    // Each file starts its own application; on a shared server (DATABASE_URL) they would
    // empty each other's tables, so they run one after the other there.
    fileParallelism: (process.env['DATABASE_URL'] ?? '') === '',
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
