import path from 'node:path';
import type { Config } from '../../config/index.js';
import { barrelFile, dependenciesFile, isDeclarationsFile } from '../../declared/index.js';
import { declaredModules, MODULE_LAYERS } from '../../model-modules/index.js';
import type { Flaw } from '../model/flaw.js';
import { isCanonicalDirectory } from './is-canonical-directory.js';
import { OPEN_DIRECTORIES } from './open-directories.js';
import { roleOf } from './role-of.js';

interface Placed {
  readonly context: string;
  /** True when the classes of the project declare themselves: the context then has generated declarations, at its root and in its role folders. */
  readonly declared: boolean;
  /** Path of the entry inside its context. */
  readonly inside: string;
  readonly extras: readonly string[];
}

/**
 * Why an entry of a context, a directory (ending with `/`) or a file, has no place in the
 * canonical tree; undefined when it has one, or when it is the context itself.
 */
export function strayEntry(entry: string, config: Config): Flaw | undefined {
  const placed = place(entry, config);

  if (placed === undefined) {
    return undefined;
  }

  return entry.endsWith('/') ? strayDirectory(placed) : straySource(placed);
}

function place(entry: string, config: Config): Placed | undefined {
  const { contextsDir, contexts, stack } = config;

  const [context = '', ...rest] = entry
    .slice(contextsDir.length + 1)
    .replace(/\/$/, '')
    .split('/');

  if (rest.length === 0) {
    return undefined;
  }

  const [layer = '', module, ...below] = rest;

  const inModule =
    module !== undefined && MODULE_LAYERS.includes(layer) && declaredModules(config, context).includes(module);

  const inside = inModule ? [layer, ...below].join('/') : rest.join('/');

  return {
    context,
    declared: stack.style === 'declared',
    inside,
    extras: contexts[context]?.extraDirectories ?? [],
  };
}

function strayDirectory({ context, inside, extras }: Placed): Flaw | undefined {
  if (isCanonicalDirectory(inside) || coveredByExtra(extras, inside)) {
    return undefined;
  }

  const [layer = '', folder, ...below] = inside.split('/');

  if (folder !== undefined && below.length === 0 && MODULE_LAYERS.includes(layer)) {
    return {
      message: `"${inside}" is not a directory of the canonical tree.`,
      fix: `If ${folder} is a part of the model of ${context}, declare it as a module with \`ddd-ts-kit generate module ${context} ${folder}\`; otherwise move its files to the canonical directory of their role (see \`ddd-ts-kit explain tree/closed\`).`,
    };
  }

  return {
    message: `"${inside}" is not a directory of the canonical tree.`,
    fix: `Move its files to the canonical directory of their role (see \`ddd-ts-kit explain tree/closed\`), or, if this is a design decision, add "${inside}" to contexts.${context}.extraDirectories in ddd-ts-kit.config.json.`,
  };
}

function straySource(placed: Placed): Flaw | undefined {
  const { inside, extras } = placed;

  if (!inside.endsWith('.ts')) {
    return undefined;
  }

  const directory = path.posix.dirname(inside);

  if (directory === '.') {
    return atContextRoot(placed);
  }

  const open = OPEN_DIRECTORIES.some((root) => directory === root || directory.startsWith(`${root}/`));
  const generated = placed.declared && isDeclarationsFile(placed.context, inside);

  if (open || generated || roleOf(directory) !== undefined || coveredByExtra(extras, directory)) {
    return undefined;
  }

  return {
    message: `"${inside}" is not in a role directory.`,
    fix: `Move it one level down into the directory of its role (for example ${directory.split('/')[0] ?? directory}/<role>/), so that its suffix and its tests can be checked.`,
  };
}

function atContextRoot({ context, declared, inside: file }: Placed): Flaw | undefined {
  const generated = [barrelFile(context), dependenciesFile(context)];

  if (file === `${context}.module.ts` || (declared && generated.includes(file))) {
    return undefined;
  }

  const allowed = declared
    ? `CONTEXT.md, the generated ${generated.join(' or ')} and ${context}.module.ts`
    : `CONTEXT.md and ${context}.module.ts`;

  return {
    message: `"${file}" sits at the root of the context.`,
    fix: `Move it into the directory of its role; only ${allowed} live at the root of a context.`,
  };
}

function coveredByExtra(extras: readonly string[], directory: string): boolean {
  return extras.some(
    (extra) => directory === extra || directory.startsWith(`${extra}/`) || extra.startsWith(`${directory}/`),
  );
}
