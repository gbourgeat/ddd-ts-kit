import fs from 'node:fs';
import path from 'node:path';
import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { resolveImport } from '../../project/resolve-import.js';
import { isRecord } from '../../project/is-record.js';
import type { LintedFile } from '../../project/linted-file.js';
import { topLevelClasses } from './top-level-classes.js';

type Parser = TSESLint.FlatConfig.Parser;

/** A class and the program that declares it: the linted file, or the file it is imported from. */
interface ClassSite {
  readonly program: TSESTree.Program;
  readonly node: TSESTree.ClassDeclaration;
}

export type ClassFinder = (name: string) => ClassSite | undefined;

interface Origin {
  readonly specifier: string;
  readonly exported: string;
}

interface ReadSource {
  readonly modifiedAt: number;
  readonly program: TSESTree.Program | undefined;
}

const PARSER_OPTIONS = { sourceType: 'module', ecmaVersion: 'latest', range: true, loc: true };

const sources = new Map<string, ReadSource>();

/**
 * Finds the class behind a name of the linted file: declared at its top, or imported by name
 * from a source of the project that exists on disk, which is then parsed with the parser of the
 * run and nothing else (no types, no scope). A barrel, a renaming export or a file that cannot
 * be read or parsed answers undefined: the caller then judges what it sees in the file alone.
 */
export function classFinder(file: LintedFile, program: TSESTree.Program, parser: Parser | undefined): ClassFinder {
  return (name) => {
    const local = classNamed(program, name);

    if (local !== undefined) {
      return { program, node: local };
    }

    const origin = importOrigin(program, name);
    const target = origin === undefined ? undefined : resolveImport(file.config, file.path, origin.specifier);

    if (origin === undefined || target?.kind !== 'file' || parser === undefined) {
      return undefined;
    }

    const foreign = readProgram(path.resolve(file.root, target.path), parser);
    const node = foreign === undefined ? undefined : classNamed(foreign, origin.exported);

    return foreign === undefined || node === undefined ? undefined : { program: foreign, node };
  };
}

function classNamed(program: TSESTree.Program, name: string): TSESTree.ClassDeclaration | undefined {
  return topLevelClasses(program).find((declaration) => declaration.id?.name === name);
}

function importOrigin(program: TSESTree.Program, local: string): Origin | undefined {
  for (const statement of program.body) {
    if (statement.type !== AST_NODE_TYPES.ImportDeclaration) {
      continue;
    }

    const specifier = statement.specifiers.find(
      (candidate) => candidate.type === AST_NODE_TYPES.ImportSpecifier && candidate.local.name === local,
    );

    if (specifier?.type !== AST_NODE_TYPES.ImportSpecifier) {
      continue;
    }

    const exported =
      specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value;

    return { specifier: statement.source.value, exported };
  }

  return undefined;
}

/** Parsed once per file and per change of the file: an editor session sees an edit of the imported file. */
function readProgram(absolute: string, parser: Parser): TSESTree.Program | undefined {
  const modifiedAt = fs.statSync(absolute, { throwIfNoEntry: false })?.mtimeMs;

  if (modifiedAt === undefined) {
    return undefined;
  }

  const known = sources.get(absolute);

  if (known?.modifiedAt === modifiedAt) {
    return known.program;
  }

  const program = parseFile(absolute, parser);

  sources.set(absolute, { modifiedAt, program });

  return program;
}

function parseFile(absolute: string, parser: Parser): TSESTree.Program | undefined {
  try {
    const text = fs.readFileSync(absolute, 'utf8');
    const options = { ...PARSER_OPTIONS, filePath: absolute };

    const parsed: unknown =
      'parseForESLint' in parser ? parser.parseForESLint(text, options).ast : parser.parse(text, options);

    return isProgram(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isProgram(value: unknown): value is TSESTree.Program {
  return isRecord(value) && value['type'] === AST_NODE_TYPES.Program && Array.isArray(value['body']);
}
