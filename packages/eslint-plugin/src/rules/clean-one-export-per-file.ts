import path from 'node:path';
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { parseAllowedFile } from '../project/parse-allowed-file.js';
import type { AllowedFile } from '../project/config.js';
import type { LintedFile } from '../project/linted-file.js';
import { defineRule } from '../support/rule/define-rule.js';
import { explainExports } from '../support/exports/explain-exports.js';
import type { ExportExplanation } from '../support/exports/export-explanation.js';
import { isNamedAfter } from '../support/exports/is-named-after.js';
import { moduleShapeOf } from '../support/exports/module-shape-of.js';
import type { ModuleShape } from '../support/exports/module-shape.js';
import { globMatcher } from '../support/glob-matcher.js';
import { kebabCase } from '../support/kebab-case.js';

interface Options {
  /** Files whose several exports are one thing, each with the sentence that says why; added to `onePerFile.allow` of the config. */
  readonly allow?: readonly AllowedFile[];
  /** Globs of the entry files besides every `index.ts`: the subpath entries of a package. */
  readonly entries?: readonly string[];
}

const SOURCE = /\.(?:ts|mts|cts)$/;
const TEST = /\.(?:spec|test)\.[cm]?ts$/;

export const cleanOneExportPerFile = defineRule<'several' | 'fileName' | 'entry', [Options]>({
  id: 'clean/one-export-per-file',
  type: 'suggestion',
  recommended: 'error',
  description: 'A source file exports one class, interface or function, with the types of its own signature, and is named after it; an entry file only re-exports.',
  messages: {
    several:
      'This file exports {{count}} classes, interfaces or functions ({{names}}) that are not one thing. Keep one per file, named after it in kebab-case, with the types of its own signature; move each other one to its own file. Exports that really are one thing (a closed family) are declared in `onePerFile.allow` of ddd-ts-kit.config.json with the reason.',
    fileName:
      'This file exports {{exported}} but is named {{file}}. Name it {{expected}}: a file is named after its export in kebab-case (in a role file `<name>.<role>.ts`, after the name before the role).',
    entry: 'An entry file only re-exports: this statement declares or exports something of its own. Move it to a file named after what it declares and write `export { .. } from` here.',
  },
  schema: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        allow: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'reason'], properties: { file: { type: 'string' }, reason: { type: 'string' } } } },
        entries: { type: 'array', items: { type: 'string' }, uniqueItems: true },
      },
    },
  ],
  defaultOptions: [{}],
  create({ file, sourceCode, options: [options], report }) {
    if (!isJudged(file)) return {};

    const isEntry = isIndex(file) || globMatcher([`${file.config.contextsDir}/*/*.declarations.ts`, ...(options.entries ?? [])])(file.path);
    const allowed = globMatcher([...file.config.onePerFile.allow, ...(options.allow ?? []).flatMap(parseAllowedFile)].map((entry) => entry.file))(file.path);

    const judgeEntry = (program: TSESTree.Program): void => {
      for (const statement of program.body.filter((candidate) => !isReExport(candidate))) report({ node: statement, messageId: 'entry' });
    };

    const judgeSource = (program: TSESTree.Program): void => {
      const shape = moduleShapeOf(program);
      const explanation = explainExports(shape, sourceCode);
      const finding = explanation !== undefined || allowed ? misnamed(file, explanation?.mains ?? shape.counted) : undefined;

      if (explanation === undefined && !allowed) report({ node: nodeOf(shape, shape.counted[1]), messageId: 'several', data: { count: shape.counted.length, names: shape.counted.join(', ') } });
      if (finding !== undefined) report({ node: nodeOf(shape, finding.main), messageId: 'fileName', data: finding.data });
    };

    return { Program: isEntry ? judgeEntry : judgeSource };
  },
});

interface Misnamed {
  readonly main: string;
  readonly data: Record<string, string>;
}

/** The file carries the name of none of the exports it may be named after. A family that no export names is named freely. */
function misnamed(file: LintedFile, mains: ExportExplanation['mains']): Misnamed | undefined {
  const base = path.posix.basename(file.path);
  const stem = base.replace(SOURCE, '');
  const [main] = mains === 'free' ? [] : mains;

  if (mains === 'free' || main === undefined || main === 'default' || mains.some((name) => isNamedAfter(stem, name))) return undefined;

  return { main, data: { exported: mains.join(' or '), file: base, expected: `${expectedStem(stem, main)}.ts` } };
}

/** A source under the source root; in a workspace, under the directory of that name of a package. Never a test, never a declaration file. */
function isJudged(file: LintedFile): boolean {
  const segments = file.path.split('/');
  const sourceDirectory = file.config.sourceRoot.split('/').at(-1) ?? 'src';

  if (!SOURCE.test(file.path) || /\.d\.[cm]?ts$/.test(file.path) || file.isTest || TEST.test(file.path) || segments.includes('test')) return false;

  return file.path.startsWith(`${file.config.sourceRoot}/`) || segments.slice(0, -1).includes(sourceDirectory);
}

function isIndex(file: LintedFile): boolean {
  return /^index\.[cm]?ts$/.test(path.posix.basename(file.path));
}

/** `export .. from`, `export * from`, and what declares nothing: an import for its effect, the empty `export {}` of a module without export yet. */
function isReExport(statement: TSESTree.ProgramStatement): boolean {
  if (statement.type === AST_NODE_TYPES.ImportDeclaration) return statement.specifiers.length === 0;
  if (statement.type !== AST_NODE_TYPES.ExportNamedDeclaration) return statement.type === AST_NODE_TYPES.ExportAllDeclaration;

  return statement.source !== null || (statement.declaration === null && statement.specifiers.length === 0);
}

function nodeOf(shape: ModuleShape, name: string | undefined): TSESTree.Node {
  const declared = shape.exports.find((declaration) => declaration.name === name)?.node ?? shape.program;

  return 'id' in declared && declared.id !== null ? declared.id : declared;
}

/** The name to give the file: the role suffix of a role file is kept. */
function expectedStem(stem: string, main: string): string {
  const [, ...roles] = stem.split('.');
  const role = roles.at(-1);
  const name = kebabCase(main);

  return role !== undefined && !name.endsWith(`-${role}`) ? `${name}.${role}` : name;
}
