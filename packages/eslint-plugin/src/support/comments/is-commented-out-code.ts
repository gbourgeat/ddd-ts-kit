import type { TSESLint } from '@typescript-eslint/utils';
import { isRecord } from '../../project/is-record.js';
import { PROSE_OPENING } from './prose-opening.js';
import { isFragment } from './is-fragment.js';
import { readsAsProse } from './reads-as-prose.js';

type LooseNode = Readonly<Record<string, unknown>>;

type Parser = TSESLint.Parser.LooseParserModule;

const PARSE_OPTIONS = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  range: false,
  loc: false,
  comment: false,
  tokens: false,
};

/** How a comment body is offered to the parser: as statements, as a function body, as class members. */
const WRAPPERS: readonly ((text: string) => string)[] = [
  (text) => text,
  (text) => `async function wrapper() {\n${text}\n}`,
  (text) => `class Wrapper {\n${text}\n}`,
];

const STATEMENTS_THAT_ARE_CODE = new Set([
  'FunctionDeclaration',
  'ClassDeclaration',
  'ImportDeclaration',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'ExportAllDeclaration',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSEnumDeclaration',
  'TSModuleDeclaration',
  'TSDeclareFunction',
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'TryStatement',
]);

const EXPRESSIONS_THAT_ACT = new Set(['CallExpression', 'AssignmentExpression', 'UpdateExpression', 'NewExpression']);

const TRANSPARENT = new Set(['AwaitExpression', 'ChainExpression', 'TSNonNullExpression']);

const CODE_CHARACTER = /[;(){}[\]=<>'"`]/;

/** `timeout (ms)` parses as a call, yet nobody writes a call with a space before its parenthesis. */
const PARENTHETICAL =
  /^(?!(?:if|for|while|switch|catch|return|await|function|typeof|new|throw|async|export|const|let|var)\b)[\w$.]+\s+\(/;

/** True when the text reads as source code rather than as a sentence. */
export function isCommentedOutCode(text: string, parser: Parser | undefined): boolean {
  const candidate = text.trim();

  if (
    !CODE_CHARACTER.test(candidate) ||
    PROSE_OPENING.test(candidate) ||
    PARENTHETICAL.test(candidate) ||
    readsAsProse(candidate)
  ) {
    return false;
  }

  if (parser === undefined) {
    return isFragment(candidate);
  }

  return WRAPPERS.some((wrap, index) => statementsOf(parse(parser, wrap(candidate)), index > 0).some(isCode));
}

function parse(parser: Parser, text: string): unknown {
  try {
    return 'parseForESLint' in parser
      ? parser.parseForESLint(text, PARSE_OPTIONS).ast
      : parser.parse(text, PARSE_OPTIONS);
  } catch {
    return undefined;
  }
}

function statementsOf(ast: unknown, wrapped: boolean): LooseNode[] {
  const body = nodes(isRecord(ast) ? ast['body'] : undefined);

  if (!wrapped) {
    return body;
  }

  const wrapper = body[0]?.['body'];

  return nodes(isRecord(wrapper) ? wrapper['body'] : undefined);
}

function isCode(node: LooseNode): boolean {
  const type = typeof node['type'] === 'string' ? node['type'] : '';

  return STATEMENTS_THAT_ARE_CODE.has(type) || (CONDITIONAL_CODE[type]?.(node) ?? false);
}

/** Statements that are code only in some shapes: `let go` and a lone `return` also read as English. */
const CONDITIONAL_CODE: Readonly<Record<string, (node: LooseNode) => boolean>> = {
  VariableDeclaration: (node) =>
    nodes(node['declarations']).some(
      (declarator) => isPresent(declarator['init']) || hasTypeAnnotation(declarator['id']),
    ),
  ReturnStatement: (node) => isPresent(node['argument']),
  ThrowStatement: (node) => isPresent(node['argument']),
  ExpressionStatement: (node) => acts(node['expression']),
  MethodDefinition: (node) => isRecord(node['value']) && isPresent(node['value']['body']),
  PropertyDefinition: (node) =>
    isPresent(node['accessibility']) || node['static'] === true || node['readonly'] === true,
};

function acts(expression: unknown): boolean {
  if (!isRecord(expression) || typeof expression['type'] !== 'string') {
    return false;
  }

  if (TRANSPARENT.has(expression['type'])) {
    return acts(expression['argument'] ?? expression['expression']);
  }

  return EXPRESSIONS_THAT_ACT.has(expression['type']);
}

function hasTypeAnnotation(pattern: unknown): boolean {
  return isRecord(pattern) && isPresent(pattern['typeAnnotation']);
}

function nodes(value: unknown): LooseNode[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}
