import type { Config } from '../config/index.js';

/** What a composition root imports, beyond the declarations, to host a declared context. */
export function hostImports(config: Config): string[] {
  return config.stack.assembly === 'discovery' ? [] : ["import { contextModule } from '@ddd-ts-kit/di';"];
}
