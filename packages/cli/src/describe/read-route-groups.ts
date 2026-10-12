import type { Workspace } from '../workspace/index.js';
import { decoratorOptions } from './decorator-options.js';
import { listedIn } from './listed-in.js';
import type { RouteGroupFact } from './route-group-fact.js';

const FOLDER = 'presentation/http';

interface Written {
  readonly name: string;
  readonly options: string;
}

/** The route groups of a context, by class name: every `*.routes.ts` of `presentation/http/` that carries `@RouteGroup`. */
export function readRouteGroups(ws: Workspace, directory: string): ReadonlyMap<string, RouteGroupFact> {
  const written = new Map<string, Written>();

  for (const file of ws.list(`${directory}/${FOLDER}`).filter((name) => name.endsWith('.routes.ts'))) {
    const source = ws.read(`${directory}/${FOLDER}/${file}`) ?? '';
    const options = decoratorOptions(source, 'RouteGroup');
    const name = /export\s+class\s+([A-Za-z_$][\w$]*)/.exec(source)?.[1];

    if (options !== undefined && name !== undefined) {
      written.set(name, { name, options });
    }
  }

  return new Map([...written.keys()].map((name) => [name, folded(written, name, 0)]));
}

const NOTHING = { prefix: '', guards: [], errors: [], tags: [] };

function folded(written: ReadonlyMap<string, Written>, name: string, depth: number): RouteGroupFact {
  const group = written.get(name);

  if (group === undefined || depth > written.size) {
    return { name, ...NOTHING };
  }

  const parent = /\bparent:\s*([A-Za-z_$][\w$]*)/.exec(group.options)?.[1];
  const above = parent === undefined ? NOTHING : folded(written, parent, depth + 1);
  const [, prefix = ''] = /\bprefix:\s*['"]([^'"]*)['"]/.exec(group.options) ?? [];

  return {
    name,
    prefix: `${above.prefix}${prefix}`,
    guards: [...above.guards, ...listedIn(group.options, 'guards')],
    errors: [...above.errors, ...quoted(listedIn(group.options, 'errors'))],
    tags: [...above.tags, ...quoted(listedIn(group.options, 'tags'))],
  };
}

function quoted(entries: readonly string[]): string[] {
  return entries.map((entry) => entry.replace(/^['"]|['"]$/g, ''));
}
