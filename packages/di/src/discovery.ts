import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { declarationOf, type Declaration, type DeclaredClass } from '@ddd-ts-kit/kernel/declarations';
import { contextModule } from './context-module.js';
import { rememberFile } from './declared.js';
import { WiringError } from './errors.js';
import type { ContextModule } from './module.js';

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

/**
 * The module of a bounded context, found by loading every file of its `application/` and
 * `infrastructure/` folders that carries a role suffix (`*.handler`, `*.repository`, ...) and
 * keeping the classes that declare themselves:
 * `await discoverContext('billing', new URL('.', import.meta.url))`.
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
  const declared: DeclaredClass[] = [];
  for (const file of await roleFilesOf(root, options)) {
    assertInItsFolder(file, name);
    declared.push(...declaredIn(file, await loaded(file, load), name));
  }
  return contextModule(name, declared);
}

interface RoleRule {
  readonly suffix: string;
  /** Folders of the context, relative to it, the files of this suffix belong in. */
  readonly folders: readonly string[];
  readonly roles: readonly Declaration['role'][];
}

const RULES: readonly RoleRule[] = [
  { suffix: 'command', folders: ['application/commands'], roles: ['message'] },
  { suffix: 'query', folders: ['application/queries'], roles: ['message'] },
  { suffix: 'handler', folders: ['application/commands', 'application/queries'], roles: ['command-handler', 'query-handler'] },
  { suffix: 'consumer', folders: ['application/integration/consumers'], roles: ['event-listener'] },
  { suffix: 'event-handler', folders: ['application/event-handlers'], roles: ['domain-event-listener'] },
  { suffix: 'policy', folders: ['application/authorization'], roles: ['policy'] },
  { suffix: 'repository', folders: ['infrastructure/persistence'], roles: ['repository'] },
  { suffix: 'gateway', folders: ['infrastructure'], roles: ['gateway'] },
  { suffix: 'adapter', folders: ['infrastructure'], roles: ['adapter'] },
];

const SCANNED_LAYERS = ['application', 'infrastructure'];
const DEFAULT_EXTENSIONS = ['.js', '.mjs', '.ts', '.mts'];

interface RoleFile {
  readonly absolute: string;
  /** Relative to the context, with forward slashes. */
  readonly relative: string;
  readonly rule: RoleRule;
}

/** Sorted by path, so that two machines and two runs wire a context in the same order. */
async function roleFilesOf(root: string, options: DiscoveryOptions): Promise<RoleFile[]> {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const byStem = new Map<string, RoleFile & { readonly rank: number }>();
  for (const relative of await sourcesOf(root)) {
    const candidate = roleFileOf(root, relative, extensions);
    if (candidate === undefined || options.ignore?.(relative) === true) continue;
    const known = byStem.get(candidate.stem);
    if (known === undefined || candidate.rank < known.rank) byStem.set(candidate.stem, candidate);
  }
  return [...byStem.values()].sort((left, right) => compare(left.relative, right.relative));
}

async function sourcesOf(root: string): Promise<string[]> {
  const layers = await Promise.all(SCANNED_LAYERS.map((layer) => filesUnder(root, layer)));
  if (layers.every((layer) => layer === undefined)) {
    throw new WiringError(
      'DISCOVERY_FAILED',
      `${root} holds neither application/ nor infrastructure/: it is not the directory of a bounded context.`,
    );
  }
  return layers.flatMap((layer) => layer ?? []);
}

async function filesUnder(root: string, layer: string): Promise<string[] | undefined> {
  try {
    const entries = await readdir(path.join(root, layer), { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function roleFileOf(root: string, relative: string, extensions: readonly string[]) {
  const rank = extensions.findIndex((extension) => relative.endsWith(extension));
  if (rank === -1 || /\.d\.[cm]?ts$/.test(relative)) return undefined;
  const stem = relative.slice(0, -String(extensions[rank]).length);
  const rule = RULES.find(({ suffix }) => stem.endsWith(`.${suffix}`));
  if (rule === undefined) return undefined;
  return { absolute: path.join(root, relative), relative, rule, stem, rank };
}

function compare(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function assertInItsFolder({ relative, rule }: RoleFile, context: string): void {
  if (rule.folders.some((folder) => relative.startsWith(`${folder}/`))) return;
  throw new WiringError(
    'MISPLACED_DECLARATION',
    `${relative} of context "${context}" is outside its canonical folder: a *.${rule.suffix} file belongs in ${rule.folders.map((folder) => `${folder}/`).join(' or ')}.`,
  );
}

async function loaded(file: RoleFile, load: NonNullable<DiscoveryOptions['load']>): Promise<unknown> {
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
  if (declared.length === 0) throw nothingDeclared(file, context);
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
  if (role === undefined || rule.roles.includes(role)) return;
  throw new WiringError(
    'MISPLACED_DECLARATION',
    `Class ${target.name} declares itself as ${role} in ${absolute}, a *.${rule.suffix} file: that suffix is for ${rule.roles.join(' or ')}.`,
  );
}
