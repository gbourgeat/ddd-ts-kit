import type { Config } from '../config';
import { filesUnder } from '../generate/files-under';
import { type ContextTree, roleDirectoriesOf, treeOf } from '../model-modules';
import type { Workspace } from '../workspace';
import type { Remaining } from './remaining';
import { remainingIn } from './remaining-in';

const E2E = 'test/e2e';
const READ = /\.(?:[cm]?ts|md)$/;

/** Every marker left in the project, context by context then outside them; in one context only when `only` names it. */
export function readRemaining(ws: Workspace, config: Config, only?: string): Remaining[] {
  const contexts = ws.directories(config.contextsDir).filter((name) => only === undefined || name === only);
  const specs = ws.list(E2E).filter((file) => file.endsWith('.e2e.spec.ts'));

  const owner = (spec: string): string =>
    ws.directories(config.contextsDir).find((name) => drives(ws, treeOf(config, name), spec)) ?? '';

  return [
    ...contexts.flatMap((name) => scan(ws, name, `${config.contextsDir}/${name}`)),
    ...specs
      .flatMap((spec) => remainingIn(owner(spec), `${E2E}/${spec}`, ws.read(`${E2E}/${spec}`) ?? ''))
      .filter((left) => only === undefined || left.context === only),
    ...(only === undefined ? outside(ws, config) : []),
  ];
}

/** True when the end-to-end spec is named after a use case of the context. */
function drives(ws: Workspace, tree: ContextTree, spec: string): boolean {
  const useCase = spec.slice(0, -'.e2e.spec.ts'.length);

  return ['commands', 'queries'].some((folder) =>
    roleDirectoriesOf(ws, tree, `application/${folder}`).some(({ name }) => name === useCase),
  );
}

/** What is left outside the contexts: the platform, the shared kernel, the documentation, the other tests. */
function outside(ws: Workspace, config: Config): Remaining[] {
  const inContexts = (file: string): boolean => file.startsWith(`${config.contextsDir}/`) || file.startsWith(`${E2E}/`);

  return [config.sourceRoot, 'docs', 'test']
    .flatMap((directory) => scan(ws, '', directory))
    .filter((left) => !inContexts(left.file));
}

function scan(ws: Workspace, context: string, directory: string): Remaining[] {
  return filesUnder(ws, directory)
    .filter((file) => READ.test(file))
    .flatMap((file) => remainingIn(context, `${directory}/${file}`, ws.read(`${directory}/${file}`) ?? ''));
}
