import { specifierOf } from '../alias/index.js';
import { CONFIG_FILE, editConfigText } from '../config/index.js';
import { isDeclared } from '../generate/is-declared.js';
import { toName } from '../naming/index.js';
import { projectSources } from '../refusals/project-sources.js';
import { platformFileIn } from '../platform-layout/index.js';
import type { Migration } from './migration.js';

const MOUNTS = "controllerRoutes(container.resolve(DeclaredEdges).of('controller'), { resolve: container.resolve })";

/**
 * Once the contexts are turned: every import of a moved file follows it, a route that was
 * listed by hand is listed as a controller built by hand, the lists of the declared contexts
 * are removed, and the config says `controllers` when no function route is left.
 */
export function finishMigration(migration: Migration, contexts: readonly string[]): void {
  const { ws, config, draft, renamed } = migration;

  if (isDeclared(config)) {
    contexts.forEach((context) => dropList(migration, context));
  }

  const sources = [...new Set([...projectSources(ws, config), ...draft.written])].filter((file) =>
    file.endsWith('.ts'),
  );

  for (const file of sources) {
    const source = draft.read(file);

    if (source !== undefined) {
      draft.write(file, followed(migration, source));
    }
  }

  // A function route of the platform (the audit trail) is not a route of a context: it stays, and still runs.
  const left = sources.filter(
    (file) => file.startsWith(`${config.contextsDir}/`) && file.endsWith('.route.ts') && draft.read(file) !== undefined,
  );

  if (left.length === 0 && renamed.size > 0) {
    draft.write(
      CONFIG_FILE,
      editConfigText(draft.read(CONFIG_FILE) ?? '{}', (raw) => {
        raw['stack'] = { ...Object(raw['stack']), routes: 'controllers' };
      }),
    );
  }

  remind(migration);
}

/** A declared context lists nothing: its controllers reach the application through its generated file. */
function dropList({ config, draft }: Migration, context: string): void {
  const list = `${config.contextsDir}/${context}/presentation/http/${context}.routes.ts`;
  const composition = compositionOf(config, draft);
  const name = `${toName(context).camel}Routes`;

  if (draft.read(list)?.includes('@RouteGroup') !== true) {
    draft.remove(list);
  }

  draft.remove(`${config.contextsDir}/${context}/test/unit/${context}.routes.spec.ts`);

  draft.write(
    composition,
    (draft.read(composition) ?? '')
      .split('\n')
      .filter((line) => !new RegExp(String.raw`^\s*(?:import \{ ${name} \} from .*|${name},)$`).test(line))
      .join('\n'),
  );
}

function followed({ config, renamed }: Migration, source: string): string {
  let text = source;

  for (const [from, to] of renamed) {
    text = text.replaceAll(`'${specifierOf(config, from)}'`, `'${specifierOf(config, to)}'`);

    if (from.endsWith('.route.ts')) {
      text = listedByHand(text, from.slice(from.lastIndexOf('/') + 1).replace(/\.route\.ts$/, ''));
    }
  }

  const needsImport =
    text.includes('...controllerRoutes(') && !/\bcontrollerRoutes\b[^;]*from '@ddd-ts-kit\/http'/.test(text);

  return needsImport ? `import { controllerRoutes } from '@ddd-ts-kit/http';\n${text}` : text;
}

function listedByHand(text: string, kebab: string): string {
  const { camel, pascal } = toName(kebab);

  return text
    .replaceAll(new RegExp(String.raw`import \{ ${camel}Route \}`, 'g'), `import { ${pascal}Controller }`)
    .replaceAll(
      new RegExp(String.raw`(?<![.\w])${camel}Route\(((?:[^()]|\([^()]*\))*)\)`, 'g'),
      `...controllerRoutes([new ${pascal}Controller($1)])`,
    );
}

function remind({ config, draft }: Migration): void {
  const composition = draft.read(compositionOf(config, draft)) ?? '';

  draft.manual.push(
    'Run the formatter, then `ddd-ts-kit docs` (the generated file of each context registers what each controller is given), then the checks.',
    'Move what a controller kept below its class to a request mapper or a serializer (`<name>.mapper.ts`, `<name>.serializer.ts`): a controller calls its bus and nothing else.',
    'Each group stands behind `Authenticated`: give a group its own guards where a set of routes asks for more (a role, a membership). The permissions stay on the use cases.',
    "The spec of each controller runs it without its guards (`{ guards: 'skip' }`): pass a caller with `resolvePrincipal` and drop the option to hold the guards too.",
  );

  if (isDeclared(config) && !composition.includes("of('controller')")) {
    draft.manual.push(
      `Mount the declared controllers in ${compositionOf(config, draft)}: add \`${MOUNTS}\` to the routes it defines, with \`controllerRoutes\` of @ddd-ts-kit/http and \`DeclaredEdges\` of @ddd-ts-kit/di.`,
    );
  }
}

function compositionOf(config: Migration['config'], draft: Migration['draft']): string {
  return platformFileIn(config, 'composition/compose-application.ts', (path) => draft.read(path) !== undefined);
}
