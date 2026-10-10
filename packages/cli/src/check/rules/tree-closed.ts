import path from 'node:path';
import type { Config } from '../../config/index.js';
import { barrelFile } from '../../declared/index.js';
import { isCanonicalDirectory } from '../canonical/is-canonical-directory.js';
import { OPEN_DIRECTORIES } from '../canonical/open-directories.js';
import { roleOf } from '../canonical/role-of.js';
import type { Flaw } from '../model/flaw.js';
import type { Rule } from '../model/rule.js';
import { reporter } from '../support/reporter.js';

interface Placed {
  readonly context: string;
  /** True when the classes of the project declare themselves: the context then has a generated barrel at its root. */
  readonly declared: boolean;
  /** Path of the entry inside its context. */
  readonly inside: string;
  readonly extras: readonly string[];
}

export const treeClosed: Rule = {
  id: 'tree/closed',
  description:
    'A context holds only the canonical directories (plus its declared extraDirectories), and no source file outside a role directory.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);
    // A rejected directory is reported once: what it holds is not reported again.
    const rejected: string[] = [];

    return project.contextEntries.flatMap((entry) => {
      const placed = place(entry, project.config);

      if (placed === undefined || rejected.some((parent) => entry.startsWith(parent))) {
        return [];
      }

      const isDirectory = entry.endsWith('/');
      const flaw = isDirectory ? strayDirectory(placed) : straySource(placed);

      if (flaw === undefined) {
        return [];
      }

      if (isDirectory) {
        rejected.push(entry);
      }

      return [report({ file: entry.replace(/\/$/, ''), line: 1 }, flaw.message, flaw.fix)];
    });
  },
};

function place(entry: string, { contextsDir, contexts, stack }: Config): Placed | undefined {
  const [context = '', ...rest] = entry
    .slice(contextsDir.length + 1)
    .replace(/\/$/, '')
    .split('/');

  if (rest.length === 0) {
    return undefined;
  }

  return {
    context,
    declared: stack.style === 'declared',
    inside: rest.join('/'),
    extras: contexts[context]?.extraDirectories ?? [],
  };
}

function strayDirectory({ context, inside, extras }: Placed): Flaw | undefined {
  if (isCanonicalDirectory(inside) || coveredByExtra(extras, inside)) {
    return undefined;
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

  if (open || roleOf(directory) !== undefined || coveredByExtra(extras, directory)) {
    return undefined;
  }

  return {
    message: `"${inside}" is not in a role directory.`,
    fix: `Move it one level down into the directory of its role (for example ${directory.split('/')[0] ?? directory}/<role>/), so that its suffix and its tests can be checked.`,
  };
}

function atContextRoot({ context, declared, inside: file }: Placed): Flaw | undefined {
  const barrel = barrelFile(context);

  if (file === `${context}.module.ts` || (declared && file === barrel)) {
    return undefined;
  }

  const allowed = declared ? `CONTEXT.md, ${barrel} and ${context}.module.ts` : `CONTEXT.md and ${context}.module.ts`;

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
