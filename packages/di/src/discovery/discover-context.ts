import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { declarationOf, type DeclaredClass } from '@ddd-ts-kit/kernel/declarations';
import { contextModule } from '../declared/context-module.js';
import { rememberFile } from '../declared/discovered-files.js';
import { WiringError } from '../errors/wiring-error.js';
import type { ContextModule } from '../module/context-module.js';
import { loadDependencyLists } from './load-dependency-lists.js';
import { withoutModule } from './without-module.js';
import { roleFilesOf, type RoleFile } from './role-files-of.js';

export interface DiscoveryOptions {
  /**
   * How a file is loaded. Default: `import()`, which follows whatever runs the process (compiled
   * JavaScript, or TypeScript under a loader or a test runner).
   */
  readonly load?: (file: URL) => Promise<unknown>;
  /** Leaves a file out: it receives the path relative to the context, with forward slashes. */
  readonly ignore?: (file: string) => boolean;
  /**
   * The extensions that are loaded, the preferred first when a file exists under two of them.
   * Default: `.js`, `.mjs`, `.ts`, `.mts`. Declaration files (`.d.ts`) are never loaded.
   */
  readonly extensions?: readonly string[];
}

type Load = NonNullable<DiscoveryOptions['load']>;

const DEFAULT_EXTENSIONS = ['.js', '.mjs', '.ts', '.mts'];

/**
 * The module of a bounded context, found by loading every file of its `application/` and
 * `infrastructure/` folders that carries a role suffix (`*.handler`, `*.repository`, ...) and
 * keeping the classes that declare themselves, in the role folders of the context and in those of
 * the modules of its model (`application/<module>/commands/`), which the generated
 * `<context>.dependencies` file names:
 * `await discoverContext('billing', new URL('.', import.meta.url))`. What each constructor
 * receives comes from the generated `<context>.dependencies` file of the same directory, loaded
 * with them; nothing is read from compiler metadata.
 *
 * It reads the disk and imports at startup, and what it finds is reachable by no import: use
 * `contextModule` with a list or a barrel wherever a bundler or a dead-code analysis must
 * follow the classes.
 */
export async function discoverContext(
  name: string,
  directory: URL | string,
  options: DiscoveryOptions = {},
): Promise<ContextModule> {
  const root = typeof directory === 'string' ? path.resolve(directory) : fileURLToPath(directory);
  const load = options.load ?? ((file: URL): Promise<unknown> => import(file.href));
  const { ignore, extensions = DEFAULT_EXTENSIONS } = options;
  const declared: DeclaredClass[] = [];
  const { modules } = await loadDependencyLists(root, name, { extensions, load });

  for (const file of await roleFilesOf(root, { extensions, ...(ignore === undefined ? {} : { ignore }) })) {
    assertInItsFolder(file, name, modules);
    declared.push(...declaredIn(file, await loaded(file, load), name));
  }

  return contextModule(name, declared);
}

function assertInItsFolder({ relative, rule }: RoleFile, context: string, modules: readonly string[]): void {
  const placed = withoutModule(relative, modules);

  if (rule.folders.some((folder) => placed.startsWith(`${folder}/`))) {
    return;
  }

  const inModules = rule.folders.some((folder) => folder.startsWith('application/'))
    ? ', at the level of the context or of a module of its model (application/<module>/...) named in the generated <context>.dependencies file'
    : '';

  throw new WiringError(
    'MISPLACED_DECLARATION',
    `${relative} of context "${context}" is outside its canonical folder: a *.${rule.suffix} file belongs in ${rule.folders.map((folder) => `${folder}/`).join(' or ')}${inModules}.`,
  );
}

async function loaded(file: RoleFile, load: Load): Promise<unknown> {
  try {
    return await load(pathToFileURL(file.absolute));
  } catch (error) {
    throw new WiringError(
      'DISCOVERY_FAILED',
      `${file.absolute} could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function declaredIn(file: RoleFile, namespace: unknown, context: string): DeclaredClass[] {
  const exported = typeof namespace === 'object' && namespace !== null ? Object.values(namespace) : [];
  const declared = exported.filter(isDeclaredClass);

  if (declared.length === 0) {
    throw nothingDeclared(file, context);
  }

  for (const target of declared) {
    assertRoleOfItsFile(target, file);
    rememberFile(target, file.absolute);
  }

  return declared;
}

function isDeclaredClass(value: unknown): value is DeclaredClass {
  return declarationOf(value) !== undefined;
}

function nothingDeclared({ absolute, rule }: RoleFile, context: string): WiringError {
  return new WiringError(
    'NOTHING_DECLARED',
    `${absolute} of context "${context}" is a *.${rule.suffix} file and exports no class that declares itself. Decorate its class, or leave the file out with the ignore option and bind it in a module.`,
  );
}

function assertRoleOfItsFile(target: DeclaredClass, { absolute, rule }: RoleFile): void {
  const role = declarationOf(target)?.role;

  if (role === undefined || rule.roles.includes(role)) {
    return;
  }

  throw new WiringError(
    'MISPLACED_DECLARATION',
    `Class ${target.name} declares itself as ${role} in ${absolute}, a *.${rule.suffix} file: that suffix is for ${rule.roles.join(' or ')}.`,
  );
}
