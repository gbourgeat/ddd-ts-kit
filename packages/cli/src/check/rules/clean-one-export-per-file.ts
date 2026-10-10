import path from 'node:path';
import { barrelFile } from '../../declared/index.js';
import type { ExportVerdict } from '../exports/export-verdict.js';
import { judgeExports } from '../exports/judge-exports.js';
import { kebabCaseOf } from '../exports/kebab-case-of.js';
import { matchesGlob } from '../exports/matches-glob.js';
import { namedAfter } from '../exports/named-after.js';
import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { perFile } from '../support/per-file.js';
import { braceDepthAt } from '../text/brace-depth-at.js';

const STATEMENT = /^(?:export\b|import\b|(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s)/gm;
const EXPORT_LIST = /^export\s*(?:type\s*)?\{([^}]*)\}\s*(from\b)?/;
const ENTRY_FIX = 'Keep only re-exports here (`export { x } from`, `export * from`, `export type { X } from`) and declare this in a file named after it: an entry file says what a folder offers, nothing lives in it.';

const COUNT_FIX =
  'Keep one and move each other to its own file named after it; only the types of its signature stay next to it. Exports that really are one thing are listed, with their reason, under "onePerFile.allow" in ddd-ts-kit.config.json.';

export const cleanOneExportPerFile: Rule = {
  id: 'clean/one-export-per-file',
  description: 'One exported class, interface or function per file, the file named after it in kebab-case; an index file only re-exports. The types of a signature and the small closed families are read as text: an approximation of what ESLint holds.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (!isJudged(file, project)) return [];

      return isEntry(file) ? declaredInEntry(file) : judged(file, project);
    });
  },
};

/** Sources under the source root, or under a directory named like it when there is no project around: tests are not judged. */
function isJudged(file: SourceFile, project: Project): boolean {
  const segments = file.path.split('/');
  const root = project.config.sourceRoot;

  if (file.isTest || segments.includes('test')) return false;

  return file.path.startsWith(`${root}/`) || segments.slice(0, -1).includes(path.posix.basename(root));
}

/** `index.ts` at any depth, and the generated barrel of a declared context. */
function isEntry(file: SourceFile): boolean {
  const name = path.posix.basename(file.path);
  const { location } = file;

  return /^index\.[cm]?ts$/.test(name) || (location.area === 'context' && location.layer === 'root' && location.inside.length === 0 && name === barrelFile(location.context));
}

/** Everything of an entry file that is not a re-export, an import without binding or the empty `export {};`. */
function declaredInEntry(file: SourceFile): Finding[] {
  const { code } = file.scan;

  return [...code.matchAll(STATEMENT)]
    .filter((match) => braceDepthAt(code, match.index) === 0 && !isAllowedInEntry(code.slice(match.index)))
    .map((match) => ({ line: file.scan.lineAt(match.index), message: `The entry file holds ${match[0].startsWith('import') ? 'an import with bindings' : 'a declaration'}: an entry file only re-exports.`, fix: ENTRY_FIX }));
}

function isAllowedInEntry(statement: string): boolean {
  if (/^import\s*['"`]/.test(statement) || /^export\s*(?:type\s*)?\*/.test(statement)) return true;

  const list = EXPORT_LIST.exec(statement);

  return list !== null && (list[2] !== undefined || (list[1] ?? '').trim() === '');
}

function judged(file: SourceFile, project: Project): Finding[] {
  const verdict = judgeExports(file);
  const allowed = project.config.onePerFile.allow.some((allowance) => matchesGlob(allowance.file, file.path));

  return [...(verdict.explained || allowed ? [] : tooMany(verdict)), ...misnamed(file, verdict)];
}

function tooMany({ counted }: ExportVerdict): Finding[] {
  const [, second] = counted;

  if (second === undefined) return [];

  return [{ line: second.line, message: `The file exports ${counted.length} classes, interfaces or functions (${counted.map(({ name }) => name).join(', ')}).`, fix: COUNT_FIX }];
}

function misnamed(file: SourceFile, { mains }: ExportVerdict): Finding[] {
  const base = path.posix.basename(file.path);
  const stem = base.replace(/\.[cm]?ts$/, '');
  const [first] = mains;

  if (first === undefined || mains.some(({ name }) => name === 'default' || namedAfter(stem, name))) return [];

  const expected = kebabCaseOf(first.name);

  return [
    {
      line: first.line,
      message: `"${base}" is not named after what it exports (${mains.map(({ name }) => name).join(', ')}).`,
      fix: `Rename the file ${expected}.ts (${expected}.<role>.ts in a role directory, when the name does not already end with the role), or rename the export after the file: a file is found by the name of what it holds.`,
    },
  ];
}
