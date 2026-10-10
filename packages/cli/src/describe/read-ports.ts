import { toName } from '../naming/index.js';
import type { PortFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';
import type { AdapterFact } from './read-adapters.js';

const FOLDERS = [
  ['domain/repositories', '.repository.ts'],
  ['application/ports', '.port.ts'],
] as const;

/** The ports of a context: the repositories of its domain and the ports of its application layer, each with the adapters that implement it. */
export function readPorts(sources: ContextSources, adapters: readonly AdapterFact[]): PortFact[] {
  const { ws, directory } = sources;

  return FOLDERS.flatMap(([folder, suffix]) =>
    ws
      .list(`${directory}/${folder}`)
      .filter((file) => file.endsWith(suffix))
      .map((file) => {
        const path = `${directory}/${folder}/${file}`;
        const name = /\bexport (?:abstract class|interface) (\w+)/.exec(ws.read(path) ?? '')?.[1] ?? toName(file.slice(0, -'.ts'.length).replaceAll('.', '-').replace(/-port$/, '')).pascal;
        const bound = adapters.filter((adapter) => adapter.ports.includes(name));

        return { name, kind: bound[0]?.kind ?? (suffix === '.repository.ts' ? 'repository' : ''), adapters: bound.map((adapter) => adapter.name), file: path };
      }),
  ).sort((left, right) => left.name.localeCompare(right.name));
}
