import path from 'node:path';
import type { Config } from '../../config';
import { CONTEXT_FILES } from '../../context-files';
import { barrelFile, dependenciesFile, isDeclarationsFile } from '../../declared';
import { declaredModules, moduleSplit, WITHOUT_MODULE } from '../../model-modules';
import type { Flaw } from '../model/flaw';
import { isCanonicalDirectory } from './is-canonical-directory';
import { OPEN_DIRECTORIES } from './open-directories';
import { roleOf } from './role-of';

interface Placed {
  readonly context: string;
  /** True when the classes of the project declare themselves: the context then has generated declarations, at its root and in its layers. */
  readonly declared: boolean;
  /** Path of the entry inside its context, its module of the model left out. */
  readonly inside: string;
  /** The declared module the entry sits in, when it does. */
  readonly module?: string;
  readonly extras: readonly string[];
}

/**
 * Why an entry of a context, a directory (ending with `/`) or a file, has no place in the
 * canonical tree; undefined when it has one, or when it is the context itself.
 */
export function strayEntry(entry: string, config: Config): Flaw | undefined {
  const placed = place(entry, config);

  // The folder of a declared module holds its layers: it is canonical as the context itself is.
  if (placed === undefined || (placed.module !== undefined && placed.inside === '')) {
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

  const { module, path: inside } = moduleSplit(rest.join('/'), declaredModules(config, context));

  return {
    context,
    declared: stack.style === 'declared',
    inside,
    ...(module === undefined ? {} : { module }),
    extras: contexts[context]?.extraDirectories ?? [],
  };
}

function strayDirectory({ context, inside, module, extras }: Placed): Flaw | undefined {
  if (isCanonicalDirectory(inside) || coveredByExtra(extras, inside)) {
    return undefined;
  }

  // A folder at the root of the context may be a module the config does not declare yet; one inside a module is not.
  if (!inside.includes('/') && module === undefined) {
    return {
      message: `"${inside}" is not a directory of the canonical tree.`,
      fix: `If ${inside} is a part of the model of ${context}, declare it as a module with \`ddd-ts-kit generate module ${context} ${inside}\`, which gives it its layers (${inside}/domain/, ${inside}/application/...); otherwise move its files to the canonical directory of their role (see \`ddd-ts-kit explain tree/closed\`).`,
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
  const generated = placed.declared && isDeclarationsFile(placed.context, inside, WITHOUT_MODULE);

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
  const ofTheContext = CONTEXT_FILES.map((candidate) => candidate.root(context));

  if (file === `${context}.module.ts` || ofTheContext.includes(file) || (declared && generated.includes(file))) {
    return undefined;
  }

  const allowed = declared
    ? `CONTEXT.md, ${ofTheContext.join(', ')}, the generated ${generated.join(' or ')} and ${context}.module.ts`
    : `CONTEXT.md, ${ofTheContext.join(', ')} and ${context}.module.ts`;

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
