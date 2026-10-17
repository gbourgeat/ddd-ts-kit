import { specifierOf } from '../alias/index.js';
import { isDeclared } from './is-declared.js';
import type { Scope } from './scope.js';

/** The import a test file assembles the context from: its module file, its barrel, or discovery. */
export function contextImports(scope: Scope): string {
  const { config, context } = scope;
  const inContext = (file: string): string => specifierOf(config, `${config.contextsDir}/${context.kebab}/${file}`);

  if (!isDeclared(config)) {
    return `import { ${context.camel}Module } from '${inContext(`${context.kebab}.module.ts`)}';`;
  }

  if (config.stack.assembly === 'discovery') {
    return "import { discoverContext } from '@ddd-ts-kit/di/discovery';";
  }

  return `import * as ${context.camel}Declarations from '${inContext(`${context.kebab}.declarations.ts`)}';`;
}
