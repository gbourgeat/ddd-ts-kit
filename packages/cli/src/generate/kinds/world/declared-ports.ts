import type { Scope } from '../../scope';
import { roleFilesOf, treeOf } from '../../../model-modules';

/** A port of a context: an abstract class of `domain/repositories/` or `application/ports/`. */
export interface DeclaredPort {
  readonly name: string;
  /** Its file, from the project root. */
  readonly file: string;
  /** A repository of `domain/repositories/`: the application announces the events of what it saves. */
  readonly repository: boolean;
}

const PLACES = [
  { directory: 'domain/repositories', suffix: '.repository.ts', repository: true },
  { directory: 'application/ports', suffix: '.port.ts', repository: false },
] as const;

const ABSTRACT_CLASS = /\bexport\s+abstract\s+class\s+(\w+)/g;

/** The ports the context declares, by class name. */
export function declaredPorts(scope: Scope): ReadonlyMap<string, DeclaredPort> {
  const ports = PLACES.flatMap(({ directory, suffix, repository }) =>
    roleFilesOf(scope.ws, treeOf(scope.config, scope.context.kebab), directory)
      .filter(({ name }) => name.endsWith(suffix))
      .flatMap(({ path: file }) =>
        [...(scope.ws.read(file) ?? '').matchAll(ABSTRACT_CLASS)].map(
          (found): DeclaredPort => ({ name: found[1] ?? '', file, repository }),
        ),
      ),
  );

  return new Map(ports.map((port) => [port.name, port]));
}
