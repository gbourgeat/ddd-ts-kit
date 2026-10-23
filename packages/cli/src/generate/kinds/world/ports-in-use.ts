import { filesUnder } from '../../files-under';
import type { Scope } from '../../scope';
import type { DeclaredPort } from './declared-ports';

/**
 * The ports some source of the context names outside its own file and the tests: an adapter
 * that implements it, a class that depends on it, a module file or a generated list of
 * dependencies that binds it. The test application refuses the fake of a port none of them
 * names, since no module binds it and no class depends on it.
 */
export function portsInUse(scope: Scope, ports: readonly DeclaredPort[]): ReadonlySet<string> {
  const sources = filesUnder(scope.ws, scope.dir)
    .filter((file) => file.endsWith('.ts') && !file.startsWith('test/'))
    .map((file) => ({ file: `${scope.dir}/${file}`, text: scope.ws.read(`${scope.dir}/${file}`) ?? '' }));

  const used = ports.filter((port) => {
    const named = new RegExp(`\\b${port.name}\\b`);

    return sources.some((source) => source.file !== port.file && named.test(source.text));
  });

  return new Set(used.map((port) => port.name));
}
