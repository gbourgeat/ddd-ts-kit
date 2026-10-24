/**
 * An ignorer of Stryker: the text of a refusal is never asserted by a test of the kit, which asserts
 * a refusal by its code (`test/refusal-by-code`), so a mutant of that text would survive by design.
 * It is left out of the measure, with the reason the report shows, and every other string of the
 * domain stays measured: the name of an event, a status, a code, a key. A text is one of a refusal
 * when it is handed to a class that refuses, which the file imports from the errors of its context
 * or from the kernel; a text a helper returns before the factory is called is not recognised.
 * Stryker loads this module through `plugins` and names the ignorer in `ignorers`, both written by
 * `governedMutation()`.
 */

/** The name `ignorers` of the Stryker config gives this ignorer. */
export const REFUSAL_TEXTS = 'refusal-texts';

const REASON = 'The text of a refusal: a test asserts a refusal by its code, never by its text (test/refusal-by-code).';

/** A code is written in constant case: the first argument of `refusal(code, message, facts)` of a concept error. */
const CODE = /^[A-Z][A-Z0-9_]*$/;
/** Where the refusals of a context live (`errors/*`): a class imported from there refuses. */
const ERRORS_MODULE = /(?:\/errors\/|\.error(?:\.[cm]?js)?$)/;
/** The kernel exports the errors of the kit beside the rest of the model: those whose name says they refuse. */
const KERNEL = '@ddd-ts-kit/kernel';
const ERROR_CLASS = /(?:Error|Refusal|Violation)$/;

/** A node of the syntax tree, as Babel hands it to an ignorer: its kind, and what the kind carries. */
export interface SyntaxNode {
  readonly type: string;
}

interface Identifier extends SyntaxNode {
  readonly type: 'Identifier';
  readonly name: string;
}

interface StringLiteral extends SyntaxNode {
  readonly type: 'StringLiteral';
  readonly value: string;
}

interface Call extends SyntaxNode {
  readonly type: 'CallExpression' | 'NewExpression';
  readonly callee: SyntaxNode;
  readonly arguments: readonly SyntaxNode[];
}

interface Member extends SyntaxNode {
  readonly type: 'MemberExpression';
  readonly object: SyntaxNode;
  readonly property: SyntaxNode;
}

interface ClassNode extends SyntaxNode {
  readonly type: 'ClassDeclaration' | 'ClassExpression';
  readonly superClass: SyntaxNode | null | undefined;
}

interface ImportDeclaration extends SyntaxNode {
  readonly type: 'ImportDeclaration';
  readonly source: { readonly value: string };
}

/** The scope a node is in: where a name it uses is declared or imported. */
export interface SyntaxScope {
  getBinding(name: string): { readonly path: SyntaxPath } | undefined;
}

/** The path of a node, as Babel traverses it: the node, the list of its parent it sits in, its scope and its ancestors. */
export interface SyntaxPath {
  readonly node: SyntaxNode;
  readonly parentPath: SyntaxPath | null;
  /** `arguments` when the node is an argument of a call. */
  readonly listKey?: string | null | undefined;
  readonly scope: SyntaxScope;
  findParent(test: (path: SyntaxPath) => boolean): SyntaxPath | null;
}

/** The reason to leave the node and what it holds out of the measure, or nothing to mutate it. */
export function refusalTextsIgnorer(path: SyntaxPath): string | undefined {
  if (!isText(path.node) || path.listKey !== 'arguments' || path.parentPath === null) {
    return undefined;
  }

  const call = path.parentPath.node;

  if (!isCall(call)) {
    return undefined;
  }

  return isRefusalMessage(call, path.node, path) || isErrorMessage(call, path.parentPath) ? REASON : undefined;
}

/** What Stryker reads from a plugin module: here one ignorer, by its name. */
export const strykerPlugins = [{ kind: 'Ignore', name: REFUSAL_TEXTS, value: { shouldIgnore: refusalTextsIgnorer } }];

/**
 * The message of `Refusal.refusal(message, facts)` or of `ConceptError.refusal(code, message, facts)`,
 * the code kept measured; and a text handed to a factory of a class that refuses, where the rule is
 * checked: `InvalidSlot.forRule('ends after it starts')`.
 */
function isRefusalMessage(call: Call, text: SyntaxNode, path: SyntaxPath): boolean {
  if (call.type !== 'CallExpression' || !isMember(call.callee) || !isIdentifier(call.callee.property)) {
    return false;
  }

  const { object, property } = call.callee;

  if (property.name === 'refusal') {
    return !(call.arguments[0] === text && isStringLiteral(text) && CODE.test(text.value));
  }

  return isIdentifier(object) && refuses(object.name, path);
}

/** The message given to the parent of an error class with `super(..)`, or to an error of the kit with `new`. */
function isErrorMessage(call: Call, callPath: SyntaxPath): boolean {
  if (call.type === 'NewExpression') {
    return isIdentifier(call.callee) && refuses(call.callee.name, callPath);
  }

  if (call.callee.type !== 'Super') {
    return false;
  }

  const enclosing = callPath.findParent((path) => isClass(path.node));

  if (enclosing === null || !isClass(enclosing.node)) {
    return false;
  }

  const parent = enclosing.node.superClass;

  return parent !== null && parent !== undefined && isIdentifier(parent) && refuses(parent.name, enclosing);
}

/** A class refuses when the file imports it from the errors of a context, or from the kernel under a name that says so. */
function refuses(name: string, path: SyntaxPath): boolean {
  const declaration = path.scope.getBinding(name)?.path.parentPath?.node;

  if (declaration === undefined || !isImport(declaration)) {
    return false;
  }

  const from = declaration.source.value;

  return ERRORS_MODULE.test(from) || (from === KERNEL && ERROR_CLASS.test(name));
}

function isText(node: SyntaxNode): boolean {
  return node.type === 'StringLiteral' || node.type === 'TemplateLiteral';
}

function isStringLiteral(node: SyntaxNode): node is StringLiteral {
  return node.type === 'StringLiteral';
}

function isCall(node: SyntaxNode): node is Call {
  return node.type === 'CallExpression' || node.type === 'NewExpression';
}

function isMember(node: SyntaxNode): node is Member {
  return node.type === 'MemberExpression';
}

function isClass(node: SyntaxNode): node is ClassNode {
  return node.type === 'ClassDeclaration' || node.type === 'ClassExpression';
}

function isImport(node: SyntaxNode): node is ImportDeclaration {
  return node.type === 'ImportDeclaration';
}

function isIdentifier(node: SyntaxNode): node is Identifier {
  return node.type === 'Identifier';
}
