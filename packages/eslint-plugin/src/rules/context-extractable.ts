import { ASTUtils, AST_NODE_TYPES, TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { resolveImport } from '../project/resolve-import.js';
import type { ContextLocation } from '../project/location.js';
import type { LintedFile } from '../project/linted-file.js';
import { calleeName } from '../support/calls/callee-name.js';
import { declaredRoleOf } from '../support/declarations/declared-role-of.js';
import { isDeclaredStyle } from '../support/declarations/is-declared-style.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';
import { propertyName } from '../support/globals/property-name.js';
import { inContext } from '../support/imports/in-context.js';
import { staticString } from '../support/imports/static-string.js';
import { isPortFile } from '../support/ports/is-port-file.js';

type MessageId = 'foreignSchema' | 'foreignTable' | 'mutableBinding' | 'mutableState' | 'foreignWiring' | 'foreignPort';
type Tell = Report<MessageId>;
type Source = Readonly<TSESLint.SourceCode>;

interface ForeignSchema {
  readonly context: string;
  /** `catalog.` or `"catalog".` where a table name may start. */
  readonly qualifier: RegExp;
}

interface Declared {
  readonly declarator: TSESTree.VariableDeclarator;
  readonly kind: TSESTree.VariableDeclaration['kind'];
}

const SCHEMA_HELPERS = new Set(['contextSchema', 'schemaNameOf']);
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SQL = /\b(?:select|insert|update|delete|from|join|into|references)\b/i;
const IMPORTS = new Set<AST_NODE_TYPES>([AST_NODE_TYPES.ImportDeclaration, AST_NODE_TYPES.ExportNamedDeclaration, AST_NODE_TYPES.ExportAllDeclaration, AST_NODE_TYPES.ImportExpression]);
const CONTAINERS = new Set(['Map', 'Set', 'WeakMap', 'WeakSet', 'Array']);
const MUTATORS = new Set(['set', 'add', 'delete', 'clear', 'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
const WIRING = new Set(['bind', 'rebind', 'resolve', 'handledBy', 'toClass']);

const BY_CONTRACT =
  'Read what "{{there}}" publishes: keep a projection of your own fed by its integration events, or declare a port in application/ports whose adapter calls it and could be remote tomorrow.';

export const contextExtractable = defineRule<MessageId>({
  id: 'context/extractable',
  type: 'problem',
  recommended: 'error',
  description: 'A context can run alone: it reads no table of another context, exports no shared mutable state and wires no port or adapter that belongs to another context.',
  messages: {
    foreignSchema: `"{{here}}" opens the database schema of "{{there}}": the two contexts could no longer be deployed apart. ${BY_CONTRACT}`,
    foreignTable: `This statement of "{{here}}" names a table of the schema of "{{there}}": a join or a foreign key across contexts cannot survive an extraction. ${BY_CONTRACT}`,
    mutableBinding: '{{name}} is exported with `{{kind}}`: every importer shares one variable that any of them may see change. Export a `const`, and keep state that changes in an adapter bound in {{here}}.module.ts or declared with `@Adapter`.',
    mutableState:
      '{{name}} is exported and changed in this file: it is state shared by every importer, lost on restart and invisible to a second instance. Hold it in a class bound in {{here}}.module.ts or declared by its decorator (a repository, a cache behind a port) and export nothing mutable.',
    foreignWiring: `The module of "{{here}}" wires {{name}}, which belongs to "{{there}}": the context could not start without the other. Bind a port of "{{here}}" to an adapter of its own, or receive the capability from the platform. ${BY_CONTRACT}`,
    foreignPort:
      'This role file of "{{here}}" imports {{name}} from a port file of "{{there}}": a declaration that names a port of another context cannot be wired alone, so "{{here}}" could no longer be extracted. Declare a port of "{{here}}" as an abstract class in application/ports/<need>.port.ts and implement it with a `@Gateway` of "{{here}}" that calls "{{there}}", or receive the capability from the platform.',
  },
  create({ file, sourceCode, report }) {
    const here = inContext(file);

    if (here === undefined || file.isTest) return {};

    return { ...sharedState(here, sourceCode, report), ...boundaries(file, here, report), ...foreignPorts(file, here, report) };
  },
});

function sharedState(here: ContextLocation, sourceCode: Source, tell: Tell): TSESLint.RuleListener {
  return {
    ExportNamedDeclaration(node) {
      if (node.source !== null) return;

      for (const { declarator, kind } of exportedVariables(node, sourceCode)) {
        const name = sourceCode.getText(declarator.id);

        if (kind === 'let' || kind === 'var') tell({ node: declarator.id, messageId: 'mutableBinding', data: { name, kind, here: here.context } });
        else if (isContainer(declarator.init) && isMutated(declarator, sourceCode)) tell({ node: declarator.id, messageId: 'mutableState', data: { name, here: here.context } });
      }
    },
  };
}

/** `export const a = ...` and `export { a }` of a variable declared above. */
function exportedVariables(node: TSESTree.ExportNamedDeclaration, sourceCode: Source): Declared[] {
  const { declaration } = node;

  if (declaration?.type === AST_NODE_TYPES.VariableDeclaration) return declaration.declarations.map((declarator) => ({ declarator, kind: declaration.kind }));

  return node.specifiers.flatMap((specifier) => {
    const definition = ASTUtils.findVariable(sourceCode.getScope(node), specifier.local.type === AST_NODE_TYPES.Identifier ? specifier.local.name : '')?.defs[0];

    return definition?.type === TSESLint.Scope.DefinitionType.Variable ? [{ declarator: definition.node, kind: definition.parent.kind }] : [];
  });
}

function isContainer(init: TSESTree.Expression | null): boolean {
  if (init === null) return false;
  if (init.type === AST_NODE_TYPES.ArrayExpression || init.type === AST_NODE_TYPES.ObjectExpression) return true;

  return init.type === AST_NODE_TYPES.NewExpression && CONTAINERS.has(calleeName(init) ?? '');
}

function isMutated(declarator: TSESTree.VariableDeclarator, sourceCode: Source): boolean {
  return sourceCode.getDeclaredVariables(declarator).some((variable) => variable.references.some((reference) => mutates(reference.identifier)));
}

function mutates(identifier: TSESTree.Node): boolean {
  const { parent } = identifier;

  if (parent?.type === AST_NODE_TYPES.CallExpression) return parent.arguments[0] === identifier && isObjectAssign(parent.callee);

  return parent?.type === AST_NODE_TYPES.MemberExpression && parent.object === identifier && changesItsObject(parent);
}

/** `x.push(1)`, `x.key = 1`, `x.count++`, `delete x.key`. */
function changesItsObject(member: TSESTree.MemberExpression): boolean {
  const use = member.parent;

  if (use.type === AST_NODE_TYPES.CallExpression) return use.callee === member && MUTATORS.has(propertyName(member) ?? '');
  if (use.type === AST_NODE_TYPES.AssignmentExpression) return use.left === member;

  return use.type === AST_NODE_TYPES.UpdateExpression || (use.type === AST_NODE_TYPES.UnaryExpression && use.operator === 'delete');
}

function isObjectAssign(callee: TSESTree.Expression): boolean {
  return callee.type === AST_NODE_TYPES.MemberExpression && callee.object.type === AST_NODE_TYPES.Identifier && callee.object.name === 'Object' && propertyName(callee) === 'assign';
}

function boundaries(file: LintedFile, here: ContextLocation, tell: Tell): TSESLint.RuleListener {
  if (here.layer === 'module') return foreignWiring(file, here, tell);

  return here.layer === 'infrastructure' && here.inside[0] === 'persistence' ? foreignData(file, here, tell) : {};
}

function foreignData(file: LintedFile, here: ContextLocation, tell: Tell): TSESLint.RuleListener {
  const others = Object.keys(file.config.contexts).filter((context) => context !== here.context && KEBAB.test(context));
  const schemas = others.map((context) => ({ context, qualifier: new RegExp(`(?<![\\w.])"?${context.replaceAll('-', '_')}"?\\.`) }));

  const statement = (node: TSESTree.Node, text: string): void => {
    const there = foreignSchemaIn(text, schemas);

    if (there !== undefined) tell({ node, messageId: 'foreignTable', data: { here: here.context, there } });
  };

  return {
    CallExpression(node) {
      const [name] = node.arguments;
      const there = SCHEMA_HELPERS.has(calleeName(node) ?? '') && name !== undefined ? staticString(name) : undefined;

      if (there !== undefined && others.includes(there)) tell({ node, messageId: 'foreignSchema', data: { here: here.context, there } });
    },
    TemplateLiteral: (node) => statement(node, node.quasis.map((quasi) => quasi.value.cooked ?? '').join('?')),
    Literal(node) {
      if (typeof node.value === 'string' && !IMPORTS.has(node.parent.type)) statement(node, node.value);
    },
  };
}

function foreignSchemaIn(text: string, schemas: readonly ForeignSchema[]): string | undefined {
  return SQL.test(text) ? schemas.find((schema) => schema.qualifier.test(text))?.context : undefined;
}

function foreignWiring(file: LintedFile, here: ContextLocation, tell: Tell): TSESLint.RuleListener {
  const foreign = new Map<string, string>();

  return {
    ImportDeclaration(node) {
      const target = resolveImport(file.config, file.path, node.source.value);

      if (target.kind !== 'file' || target.location.area !== 'context') return;

      const there = target.location;

      if (there.context === here.context || there.layer === 'published-language') return;

      for (const specifier of node.specifiers) foreign.set(specifier.local.name, there.context);
    },
    CallExpression(node) {
      if (!WIRING.has(calleeName(node) ?? '')) return;

      for (const wired of node.arguments.flatMap(wiredNames)) {
        const there = foreign.get(wired.name);

        if (there !== undefined) tell({ node: wired, messageId: 'foreignWiring', data: { here: here.context, there, name: wired.name } });
      }
    },
  };
}

/** `resolve(Port)` and the dependency list of `handledBy(Handler, [Port])`. */
function wiredNames(argument: TSESTree.CallExpressionArgument): TSESTree.Identifier[] {
  if (argument.type === AST_NODE_TYPES.Identifier) return [argument];
  if (argument.type !== AST_NODE_TYPES.ArrayExpression) return [];

  return argument.elements.filter((element) => element?.type === AST_NODE_TYPES.Identifier);
}

/**
 * In the declared style a role file names the ports it needs next to its decorator: one taken from
 * a port file of another context (its repositories, its ports) ties the two wirings.
 */
function foreignPorts(file: LintedFile, here: ContextLocation, tell: Tell): TSESLint.RuleListener {
  if (!isDeclaredStyle(file) || declaredRoleOf(file) === undefined) return {};

  return {
    ImportDeclaration(node) {
      const target = resolveImport(file.config, file.path, node.source.value);

      if (target.kind !== 'file' || target.location.area !== 'context' || target.location.context === here.context) return;

      const there = target.location.context;
      const taken = isPortFile(file.config, target.path) ? node.specifiers : [];

      for (const specifier of taken) tell({ node: specifier, messageId: 'foreignPort', data: { here: here.context, there, name: takenName(specifier) } });
    },
  };
}

/** The name the other module exports, whatever it is renamed to locally. */
function takenName(specifier: TSESTree.ImportClause): string {
  if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) return specifier.local.name;

  return specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value;
}
