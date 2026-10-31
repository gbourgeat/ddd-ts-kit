import type { RenderContext } from '../templating';
import { assembledContext } from './assembled-context';
import { contextImports } from './context-imports';
import { diImports } from './di-imports';
import { isDeclared } from './is-declared';
import type { Scope } from './scope';

/**
 * What a spec builds its test application from: the module file of the context, or its
 * declarations, read from the barrel or discovered, and an authorization module: the one that
 * gives the permission of the use case to a role, or an empty one for a public use case, since
 * a handler of the context may ask `Access`.
 */
export function specVars(scope: Scope, access: RenderContext): RenderContext {
  const isProtected = access['protected'] === true;
  const discovered = isDeclared(scope.config) && scope.config.stack.assembly === 'discovery';
  const listed = isDeclared(scope.config) && !discovered;
  const declared = isDeclared(scope.config);
  const hosted = ['platformTestModule', declared ? 'context' : assembledContext(scope, '../../')];

  const fromDi = (names: readonly string[]): string =>
    diImports(scope.config, [...(listed ? ['contextModule'] : []), ...names]);

  return {
    diWithFake: fromDi(['createTestApplication', 'fake']),
    diPlain: fromDi(['createTestApplication']),
    contextImports: contextImports(scope),
    assembles: declared,
    context: assembledContext(scope, '../../'),
    modules: [...hosted, isProtected ? 'holders' : 'authorization'].join(', '),
    guard: isProtected ? '.use(holders)' : '',
    // Discovery reads the disk: the arrangement of a spec waits for it.
    async: discovered ? 'async ' : '',
    await: discovered ? 'await ' : '',
  };
}
