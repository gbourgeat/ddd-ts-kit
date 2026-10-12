import type { RenderedInjections } from './injection/rendered-injections.js';

/**
 * What `<context>.dependencies.ts` holds under discovery: the imports and the
 * `injected(Class, [Tokens])` statements read from the constructor signatures, and nothing
 * else. Derived, like the barrel, and compared by the same rule.
 */
export function renderDependenciesFile(injected: RenderedInjections): string {
  if (injected.calls.length === 0) {
    return 'export {};\n';
  }

  return `${injected.imports.join('\n')}\n\n${injected.calls.join('\n')}\n`;
}
