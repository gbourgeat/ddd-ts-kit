import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { WiringError } from '../errors/wiring-error';
import { ROLE_RULES, type RoleRule } from './role-rule';
import { withoutModule } from './without-module';

export interface RoleFile {
  readonly absolute: string;
  /** Relative to the context, with forward slashes. */
  readonly relative: string;
  readonly rule: RoleRule;
}

interface Selection {
  /** The extensions that are loaded, the preferred first. */
  readonly extensions: readonly string[];
  readonly ignore?: (file: string) => boolean;
  /** The modules of the model of the context, each a folder holding its own layers. */
  readonly modules?: readonly string[];
}

interface Candidate extends RoleFile {
  /** The path without its extension: one file under two extensions is one candidate. */
  readonly stem: string;
  readonly rank: number;
}

const SCANNED_LAYERS = ['application', 'infrastructure'];
/** Where the classes of the edge live: only the suffixes of the edge are read there. */
const EDGE_LAYER = 'presentation';
/** What a context holds before its first use case: enough to know the directory is one. */
const OTHER_LAYERS = ['domain', EDGE_LAYER, 'published-language'];

/** The role files of a context, sorted by path, so that two machines and two runs wire it in the same order. */
export async function roleFilesOf(root: string, selection: Selection): Promise<RoleFile[]> {
  const byStem = new Map<string, Candidate>();

  const modules = selection.modules ?? [];

  for (const relative of await sourcesOf(root, modules)) {
    const candidate = candidateOf(root, relative, { extensions: selection.extensions, modules });

    if (candidate === undefined || selection.ignore?.(relative) === true) {
      continue;
    }

    const known = byStem.get(candidate.stem);

    if (known === undefined || candidate.rank < known.rank) {
      byStem.set(candidate.stem, candidate);
    }
  }

  return [...byStem.values()].sort((left, right) => compare(left.relative, right.relative));
}

/**
 * The sources of the layers of a context, those of each folder of it that holds layers of its own
 * included (`<module>/application/`): a folder the generated dependencies file does not name as a
 * module is read too, so that its role files are refused rather than left unwired.
 */
async function sourcesOf(root: string, modules: readonly string[]): Promise<string[]> {
  const folders = ['', ...new Set([...modules, ...(await foldersOf(root))]).values()].map((folder) =>
    folder === '' ? '' : `${folder}/`,
  );

  const layers = await Promise.all(
    folders.flatMap((folder) => SCANNED_LAYERS.map((layer) => filesUnder(root, `${folder}${layer}`))),
  );

  const edges = await Promise.all(folders.map((folder) => filesUnder(root, `${folder}${EDGE_LAYER}`)));

  if (layers.every((layer) => layer === undefined) && !(await holdsAnotherLayer(root))) {
    throw new WiringError(
      'DISCOVERY_FAILED',
      `${root} holds no layer of a bounded context (${[...SCANNED_LAYERS, ...OTHER_LAYERS].join('/, ')}/): it is not the directory of one.`,
    );
  }

  return [...layers.flatMap((layer) => layer ?? []), ...edges.flatMap((edge) => edge ?? [])];
}

/** The folders directly in a context that are none of its layers, its tests or its published language. */
async function foldersOf(root: string): Promise<string[]> {
  const own = [...SCANNED_LAYERS, ...OTHER_LAYERS, 'test'];
  const entries = (await entriesOf(root, false)) ?? [];

  return entries.filter((entry) => entry.isDirectory() && !own.includes(entry.name)).map((entry) => entry.name);
}

/** A context that was just declared has a published language, and nothing to wire yet: it is discovered as empty. */
async function holdsAnotherLayer(root: string): Promise<boolean> {
  const layers = await Promise.all(OTHER_LAYERS.map((layer) => filesUnder(root, layer)));

  return layers.some((layer) => layer !== undefined);
}

async function filesUnder(root: string, layer: string): Promise<string[] | undefined> {
  const entries = await entriesOf(path.join(root, layer), true);

  return entries
    ?.filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
}

/** The entries of a directory, undefined when it does not exist. */
async function entriesOf(directory: string, recursive: boolean): Promise<Dirent[] | undefined> {
  try {
    return await readdir(directory, { recursive, withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) {
      return undefined;
    }

    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

/** What a file is read with: the extensions loaded, and the modules of the model the context declares. */
interface Reading {
  readonly extensions: readonly string[];
  readonly modules: readonly string[];
}

function candidateOf(root: string, relative: string, { extensions, modules }: Reading): Candidate | undefined {
  const rank = extensions.findIndex((extension) => relative.endsWith(extension));

  if (rank === -1 || /\.d\.[cm]?ts$/.test(relative)) {
    return undefined;
  }

  const stem = relative.slice(0, -String(extensions[rank]).length);
  const atTheEdge = withoutModule(relative, modules).startsWith(`${EDGE_LAYER}/`);
  const rule = ROLE_RULES.find(({ suffix, scoped }) => stem.endsWith(`.${suffix}`) && (scoped === true) === atTheEdge);

  if (rule === undefined) {
    return undefined;
  }

  return { absolute: path.join(root, relative), relative, rule, stem, rank };
}

function compare(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}
