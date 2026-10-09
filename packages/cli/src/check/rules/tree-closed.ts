import path from 'node:path';
import { isCanonicalDirectory, OPEN_DIRECTORIES, roleOf } from '../canonical.js';
import type { Config } from '../../config.js';
import type { Rule } from '../types.js';
import { reporter, type Finding } from './helpers.js';

export const treeClosed: Rule = {
  id: 'tree/closed',
  description: 'A context holds only the canonical directories (plus its declared extraDirectories), and no source file outside a role directory.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);
    // A rejected directory is reported once: what it holds is not reported again.
    const rejected: string[] = [];
    return project.contextEntries.flatMap((entry) => {
      const placed = place(entry, project.config);
      if (placed === undefined || rejected.some((parent) => entry.startsWith(parent))) return [];
      const isDirectory = entry.endsWith('/');
      const finding = isDirectory ? strayDirectory(placed) : straySource(placed);
      if (finding === undefined) return [];
      if (isDirectory) rejected.push(entry);
      return [report({ file: entry.replace(/\/$/, ''), line: 1 }, finding.message, finding.fix)];
    });
  },
};

interface Placed {
  readonly context: string;
  /** Path of the entry inside its context. */
  readonly inside: string;
  readonly extras: readonly string[];
}

type Stray = Omit<Finding, 'line'>;

function place(entry: string, { contextsDir, contexts }: Config): Placed | undefined {
  const [context = '', ...rest] = entry.slice(contextsDir.length + 1).replace(/\/$/, '').split('/');
  if (rest.length === 0) return undefined;
  return { context, inside: rest.join('/'), extras: contexts[context]?.extraDirectories ?? [] };
}

function strayDirectory({ context, inside, extras }: Placed): Stray | undefined {
  if (isCanonicalDirectory(inside) || coveredByExtra(extras, inside)) return undefined;
  return {
    message: `"${inside}" is not a directory of the canonical tree.`,
    fix: `Move its files to the canonical directory of their role (see \`ddd-ts-kit explain tree/closed\`), or, if this is a design decision, add "${inside}" to contexts.${context}.extraDirectories in ddd-ts-kit.config.json.`,
  };
}

function straySource({ context, inside, extras }: Placed): Stray | undefined {
  if (!inside.endsWith('.ts')) return undefined;
  const directory = path.posix.dirname(inside);
  if (directory === '.') return atContextRoot(context, inside);
  const open = OPEN_DIRECTORIES.some((root) => directory === root || directory.startsWith(`${root}/`));
  if (open || roleOf(directory) !== undefined || coveredByExtra(extras, directory)) return undefined;
  return {
    message: `"${inside}" is not in a role directory.`,
    fix: `Move it one level down into the directory of its role (for example ${directory.split('/')[0] ?? directory}/<role>/), so that its suffix and its tests can be checked.`,
  };
}

function atContextRoot(context: string, file: string): Stray | undefined {
  if (file === `${context}.module.ts`) return undefined;
  return { message: `"${file}" sits at the root of the context.`, fix: `Move it into the directory of its role; only CONTEXT.md and ${context}.module.ts live at the root of a context.` };
}

function coveredByExtra(extras: readonly string[], directory: string): boolean {
  return extras.some((extra) => directory === extra || directory.startsWith(`${extra}/`) || extra.startsWith(`${directory}/`));
}
