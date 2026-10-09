import type { TSESLint } from '@typescript-eslint/utils';
import { isRecord } from '../project/config.js';

type LooseNode = Readonly<Record<string, unknown>>;
type Parser = TSESLint.Parser.LooseParserModule;

const PARSE_OPTIONS = { ecmaVersion: 'latest', sourceType: 'module', range: false, loc: false, comment: false, tokens: false };

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
/** Prose sometimes parses; these openings are never statements. */
const PROSE_OPENING = /^(?:TODO|FIXME|NOTE|XXX|HACK|See |see |e\.g\.|i\.e\.|https?:)/;
/** `timeout (ms)` parses as a call, yet nobody writes a call with a space before its parenthesis. */
const PARENTHETICAL = /^(?!(?:if|for|while|switch|catch|return|await|function|typeof|new|throw|async|export|const|let|var)\b)[\w$.]+\s+\(/;

const FRAGMENTS: readonly RegExp[] = [
  /^(?:if|for|while|switch)\s*\(.*\)\s*\{$/,
  /^\}\s*else\b.*\{$/,
  /^(?:else|try|finally)\s*\{$/,
  /^\}\s*catch\b.*\{$/,
  /=>\s*\{$/,
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\b.*\{$/,
  /^(?:export\s+)?(?:abstract\s+)?class\s+[\w$]+.*\{$/,
  /^(?:(?:public|private|protected|static|async|override)\s+)+[\w$#]+\s*\(.*\{$/,
];

/** True when the text reads as source code rather than as a sentence. */
export function isCommentedOutCode(text: string, parser: Parser | undefined): boolean {
  const candidate = text.trim();
  if (!CODE_CHARACTER.test(candidate) || PROSE_OPENING.test(candidate) || PARENTHETICAL.test(candidate) || readsAsProse(candidate)) return false;
  if (parser === undefined) return isFragment(candidate);
  return WRAPPERS.some((wrap, index) => statementsOf(parse(parser, wrap(candidate)), index > 0).some(isCode));
}

/** An opening line of a block whose end was not commented out with it, or the reverse. */
export function isFragment(line: string): boolean {
  const text = line.replace(/`[^`]*`/g, '').trim();
  return !PROSE_OPENING.test(text) && !readsAsProse(text) && FRAGMENTS.some((shape) => shape.test(text));
}

/** A sentence is mostly plain words; a statement is mostly identifiers glued to punctuation. */
function readsAsProse(text: string): boolean {
  const tokens = text.split(/\s+/);
  const words = tokens.filter((token) => /^[A-Za-z'`-]+[,.:;!?]?$/.test(token));
  return tokens.length >= 5 && words.length / tokens.length >= 0.8;
}

function parse(parser: Parser, text: string): unknown {
  try {
    return 'parseForESLint' in parser ? parser.parseForESLint(text, PARSE_OPTIONS).ast : parser.parse(text, PARSE_OPTIONS);
  } catch {
    return undefined;
  }
}

function statementsOf(ast: unknown, wrapped: boolean): LooseNode[] {
  const body = nodes(isRecord(ast) ? ast['body'] : undefined);
  if (!wrapped) return body;
  const wrapper = body[0]?.['body'];
  return nodes(isRecord(wrapper) ? wrapper['body'] : undefined);
}

function isCode(node: LooseNode): boolean {
  const type = typeof node['type'] === 'string' ? node['type'] : '';
  return STATEMENTS_THAT_ARE_CODE.has(type) || (CONDITIONAL_CODE[type]?.(node) ?? false);
}

/** Statements that are code only in some shapes: `let go` and a lone `return` also read as English. */
const CONDITIONAL_CODE: Readonly<Record<string, (node: LooseNode) => boolean>> = {
  VariableDeclaration: (node) => nodes(node['declarations']).some((declarator) => isPresent(declarator['init']) || hasTypeAnnotation(declarator['id'])),
  ReturnStatement: (node) => isPresent(node['argument']),
  ThrowStatement: (node) => isPresent(node['argument']),
  ExpressionStatement: (node) => acts(node['expression']),
  MethodDefinition: (node) => isRecord(node['value']) && isPresent(node['value']['body']),
  PropertyDefinition: (node) => isPresent(node['accessibility']) || node['static'] === true || node['readonly'] === true,
};

function acts(expression: unknown): boolean {
  if (!isRecord(expression) || typeof expression['type'] !== 'string') return false;
  if (TRANSPARENT.has(expression['type'])) return acts(expression['argument'] ?? expression['expression']);
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
