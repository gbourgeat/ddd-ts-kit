import { isDeclared } from './is-declared.js';
import type { Scope } from './scope.js';

/**
 * The module of the context as the style of the project assembles it; `toContext` is the path
 * from the file that writes it to the directory of the context.
 */
export function assembledContext(scope: Pick<Scope, 'config' | 'context'>, toContext: string): string {
  const { config, context } = scope;

  if (!isDeclared(config)) return `${context.camel}Module`;
  if (config.stack.assembly === 'discovery') return `await discoverContext('${context.kebab}', new URL('${toContext}', import.meta.url))`;

  return `contextModule('${context.kebab}', ${context.camel}Declarations)`;
}
