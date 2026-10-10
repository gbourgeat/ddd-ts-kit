import type { Config } from '../config/index.js';
import { DISCOVERED_SUFFIXES } from '../declared/index.js';
import type { RenderContext } from '../templating/index.js';

/**
 * What knip is told beyond the sources: under discovery the role files nothing imports (handlers,
 * publishers, jobs, adapters...), the entry point of a worker, and the end-to-end tree, which
 * exists only with an HTTP stack, so that no pattern matches nothing.
 */
export function knipVars(config: Config): RenderContext {
  const when = (text: string): string => (config.stack.http === 'none' ? '' : text);

  return {
    discovered: `{${DISCOVERED_SUFFIXES.join(',')}}`,
    apps: config.worker || Object.values(config.contexts).some((context) => context.deployable),
    e2eEntry: when(',\n    "test/e2e/**/*.ts"'),
    e2eProject: when(', "test/**/*.ts"'),
    e2eConfig: when(', "vitest.e2e.config.ts"'),
    e2eSpecs: when(', "test/e2e/**/*.e2e.spec.ts"'),
  };
}
