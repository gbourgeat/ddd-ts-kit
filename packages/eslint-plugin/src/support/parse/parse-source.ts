import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { isRecord } from '../../project/is-record';

type Parser = TSESLint.FlatConfig.Parser;

const PARSER_OPTIONS = { sourceType: 'module', ecmaVersion: 'latest', range: true, loc: true };

/**
 * A source of the project other than the linted file, parsed with the parser of the run and
 * nothing else (no types, no scope); undefined when the parser refuses it.
 */
export function parseSource(text: string, filePath: string, parser: Parser): TSESTree.Program | undefined {
  try {
    const options = { ...PARSER_OPTIONS, filePath };

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
