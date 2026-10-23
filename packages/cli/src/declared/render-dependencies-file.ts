import { laidOutCalls } from './injection/laid-out-calls.js';
import type { RenderedInjections } from './injection/rendered-injections.js';

/**
 * What `<context>.dependencies.ts` holds under discovery: the imports and the
 * `injected(Class, [Tokens])` statements read from the constructor signatures, and the modules
 * of the model the config declares, which `discoverContext` reads there since it runs without
 * the config, and nothing else. Derived, like the barrel, and compared by the same rule.
 */
export function renderDependenciesFile(injected: RenderedInjections, modules: readonly string[]): string {
  const parts = [
    ...(injected.calls.length === 0 ? [] : [injected.imports.join('\n')]),
    ...(modules.length === 0 ? [] : [modulesStatement(modules)]),
    ...(injected.calls.length === 0 ? [] : [laidOutCalls(injected.calls)]),
  ];

  return parts.length === 0 ? 'export {};\n' : `${parts.join('\n\n')}\n`;
}

function modulesStatement(modules: readonly string[]): string {
  return `/** The modules of the model, as ddd-ts-kit.config.json declares them: discovery reads the role files of each. */\nexport const modules = [${modules.map((module) => `'${module}'`).join(', ')}];`;
}
