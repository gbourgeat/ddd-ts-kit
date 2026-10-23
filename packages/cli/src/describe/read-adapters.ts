import { filesUnder } from '../generate/files-under';
import { roleFoldersOf } from '../model-modules';
import type { ContextSources } from './context-sources';

/** A class of the infrastructure of a context that implements one or several of its ports. */
export interface AdapterFact {
  readonly name: string;
  readonly ports: readonly string[];
  /** The role it is bound under: `repository`, `gateway`, `external`... */
  readonly kind: string;
  /** The context whose published language it imports; empty when it reads none. */
  readonly upstream: string;
}

const ADAPTER = /\bexport class (\w+)(?:\s+extends\s+[\w.<>]+)?\s+implements\s+([^{]+)\{/;

/** The adapters of a context: every class under `infrastructure/` that implements something. */
export function readAdapters(sources: ContextSources): AdapterFact[] {
  const { ws, module } = sources;

  // The infrastructure of the context and that of each module of its model.
  return roleFoldersOf(ws, sources, 'infrastructure')
    .flatMap((folder) => filesUnder(ws, folder).map((file) => `${folder}/${file}`))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .flatMap((file) => {
      const source = ws.read(file) ?? '';
      const [, name, implemented] = ADAPTER.exec(source) ?? [];

      if (name === undefined || implemented === undefined) {
        return [];
      }

      const ports = implemented.split(',').map((port) => port.replace(/<.*$/, '').trim());

      return [
        {
          name,
          ports,
          kind: declaredKind(source) ?? boundKind(module, name) ?? kindOfFile(file),
          upstream: /([a-z0-9-]+)\/published-language(?:\/|')/.exec(source)?.[1] ?? '',
        },
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** The role the decorator of a declared class gives it. */
function declaredKind(source: string): string | undefined {
  const [, decorator, written = ''] = /^@(Repository|Gateway|Adapter)\(([^)]*)/m.exec(source) ?? [];

  if (decorator === undefined) {
    return undefined;
  }

  return decorator === 'Adapter' ? (/\bkind:\s*'([\w-]+)'/.exec(written)?.[1] ?? 'external') : decorator.toLowerCase();
}

/** The role a module file binds the class under: `.toClass(Adapter).as('external')`, or `platform.adapter(new Adapter(), { kind: 'external' })`. */
function boundKind(module: string, name: string): string | undefined {
  const bound = new RegExp(
    String.raw`\btoClass\(\s*${name}\b[^;]*?\.as\('([\w-]+)'\)|\bnew ${name}\([^;]*?\bkind:\s*'([\w-]+)'`,
  ).exec(module);

  return bound?.[1] ?? bound?.[2];
}

function kindOfFile(file: string): string {
  if (file.endsWith('.gateway.ts')) {
    return 'gateway';
  }

  return file.startsWith('persistence/') ? 'repository' : 'external';
}
