import { toName } from '../naming/index.js';
import type { PortFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';
import type { AdapterFact } from './read-adapters.js';
import { roleFilesOf } from '../model-modules/index.js';

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
          /\bexport (?:abstract class|interface) (\w+)/.exec(ws.read(path) ?? '')?.[1] ??
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
