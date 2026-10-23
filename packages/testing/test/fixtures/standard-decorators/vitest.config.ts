import { defineConfig } from 'vitest/config';
import { decorators } from '../../../src/vitest';

const { DECORATORS_COMPILER: compiler, DECORATORS_CACHE: cacheDir, DECORATORS_PLUGIN: plugin } = process.env;

export default defineConfig({
  plugins: plugin === 'off' ? [] : [decorators(compiler === undefined ? {} : { compiler })],
  ...(cacheDir === undefined ? {} : { cacheDir }),
  test: { include: ['*.test.ts'] },
});
