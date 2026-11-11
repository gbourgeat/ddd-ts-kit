import { toName } from '../naming';
import type { PortFact } from './context-description';
import type { ContextSources } from './context-sources';
import type { AdapterFact } from './read-adapters';
import { roleFilesOf } from '../model-modules';

const FOLDERS = [
  ['domain/repositories', '.repository.ts'],
  ['application/ports', '.port.ts'],
] as const;

/** The ports of a context: the repositories of its domain and the ports of its application layer, each with the adapters that implement it. */
export function readPorts(sources: ContextSources, adapters: readonly AdapterFact[]): PortFact[] {
  const { ws } = sources;

  return FOLDERS.flatMap(([folder, suffix]) =>
    roleFilesOf(ws, sources, folder)
      .filter(({ name: file }) => file.endsWith(suffix))
      .map(({ name: file, path }) => {
        const name =
          declaredPort(ws.read(path) ?? '') ??
          toName(
            file
              .slice(0, -'.ts'.length)
              .replaceAll('.', '-')
              .replace(/-port$/, ''),
          ).pascal;

        const bound = adapters.filter((adapter) => adapter.ports.includes(name));

        return {
          name,
          kind: bound[0]?.kind ?? (suffix === '.repository.ts' ? 'repository' : ''),
          adapters: bound.map((adapter) => adapter.name),
          file: path,
        };
      }),
  ).sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * The port a file declares: its abstract class, which is the injection token, before an interface. The file
 * of a read model also declares the type of its row, which is no port.
 */
function declaredPort(source: string): string | undefined {
  return (/\bexport abstract class (\w+)/.exec(source) ?? /\bexport interface (\w+)/.exec(source))?.[1];
}
