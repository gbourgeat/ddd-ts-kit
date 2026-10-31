import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file';
import { defineRule, type Report } from './rule/define-rule';
import { ambientName } from './globals/ambient-name';
import { propertyName } from './globals/property-name';
import { importListener, type ImportListener } from './imports/import-listener';
import { innerLayer } from './imports/inner-layer';

export interface Purity {
  readonly id: string;
  readonly description: string;
  /** What to do instead, appended to every message. */
  readonly instead: string;
  /** Global object to the members that give the access; an empty list means every member. */
  readonly members: Readonly<Record<string, readonly string[]>>;
  readonly calls: readonly string[];
  readonly constructions: readonly string[];
  /** Constructors that read the outside world only when called without argument. */
  readonly bareConstructions: readonly string[];
  /** Bare packages and Node built-ins (without the `node:` prefix) that give the same access. */
  readonly modules: readonly string[];
  /** Built-in to the named exports that are forbidden while the rest of the module is not judged here. */
  readonly namedImports: Readonly<Record<string, readonly string[]>>;
}

/** The three purity/* rules share one mechanism: forbidden globals and modules in domain/ and application/. */
export function purityRule(rule: Purity) {
  return defineRule<'used' | 'imported'>({
    id: rule.id,
    type: 'problem',
    recommended: 'error',
    description: rule.description,
    messages: {
      used: `{{what}} is used in the {{layer}} layer. ${rule.instead}`,
      imported: `"{{name}}" is imported in the {{layer}} layer. ${rule.instead}`,
    },
    create({ file, sourceCode, report }) {
      const layer = innerLayer(file);

      if (layer === undefined) {
        return {};
      }

      const { used, imported } = reporters(layer, report);
      const ambient = (node: TSESTree.Node): string => ambientName(sourceCode, node) ?? '';
      const imports = moduleImports(rule, file, imported);

      return {
        ...imports,
        ImportDeclaration: importDeclarationListener(rule, imports, used),
        MemberExpression: (node) => used(node, forbiddenMember(rule, ambient(node.object), propertyName(node))),
        'CallExpression:exit': (node: TSESTree.CallExpression) =>
          used(node, rule.calls.includes(ambient(node.callee)) ? `${ambient(node.callee)}()` : undefined),
        NewExpression: (node) => used(node, forbiddenConstruction(rule, ambient(node.callee), node.arguments.length)),
        VariableDeclarator: destructuringListener(rule, ambient, used),
      };
    },
  });
}

interface Reporters {
  /** A forbidden access, when `what` names one. */
  readonly used: (node: TSESTree.Node, what: string | undefined) => void;
  readonly imported: (node: TSESTree.Node, name: string) => void;
}

function reporters(layer: string, report: Report<'used' | 'imported'>): Reporters {
  return {
    used: (node, what) => {
      if (what !== undefined) {
        report({ node, messageId: 'used', data: { what, layer } });
      }
    },
    imported: (node, name) => report({ node, messageId: 'imported', data: { name, layer } }),
  };
}

/** The modules the rule forbids as a whole, however the file names them. */
function moduleImports(rule: Purity, file: LintedFile, imported: Reporters['imported']): ImportListener {
  return importListener(file, ({ node, target }) => {
    if (target.kind !== 'file' && rule.modules.includes(moduleName(target))) {
      imported(node, target.name);
    }
  });
}

/** The module as the import listener judges it, then each named import the rule forbids. */
function importDeclarationListener(
  rule: Purity,
  imports: ImportListener,
  used: Reporters['used'],
): (node: TSESTree.ImportDeclaration) => void {
  return (node) => {
    imports.ImportDeclaration(node);

    for (const specifier of namedSpecifiersOf(node)) {
      used(specifier, forbiddenNamedImport(rule, node.source.value, specifier));
    }
  };
}

function moduleName(target: { readonly kind: 'package' | 'builtin'; readonly name: string }): string {
  return target.kind === 'builtin' ? (target.name.replace(/^node:/, '').split('/')[0] ?? '') : target.name;
}

function namedSpecifiersOf(node: TSESTree.ImportDeclaration): TSESTree.ImportSpecifier[] {
  return node.specifiers.filter((specifier) => specifier.type === AST_NODE_TYPES.ImportSpecifier);
}

function forbiddenNamedImport(rule: Purity, source: string, node: TSESTree.ImportSpecifier): string | undefined {
  const name = node.imported.type === AST_NODE_TYPES.Identifier ? node.imported.name : node.imported.value;

  return rule.namedImports[source.replace(/^node:/, '')]?.includes(name) === true
    ? `${name} of "${source}"`
    : undefined;
}

function forbiddenMember(rule: Purity, object: string, property: string | undefined): string | undefined {
  const members = Object.hasOwn(rule.members, object) ? rule.members[object] : undefined;

  if (members === undefined || property === undefined) {
    return undefined;
  }

  return members.length === 0 || members.includes(property) ? `${object}.${property}` : undefined;
}

/** `const { env } = process` reads `process.env` as surely as the member expression does. */
function destructuringListener(
  rule: Purity,
  ambient: (node: TSESTree.Node) => string,
  used: Reporters['used'],
): (node: TSESTree.VariableDeclarator) => void {
  return (node) => {
    const source = node.init === null ? '' : ambient(node.init);

    for (const [property, name] of destructured(node)) {
      used(property, forbiddenMember(rule, source, name));
    }
  };
}

/** The properties a declarator takes out of its value by name, `env` of `const { env } = process`. */
function destructured(node: TSESTree.VariableDeclarator): [TSESTree.Property, string][] {
  if (node.id.type !== AST_NODE_TYPES.ObjectPattern) {
    return [];
  }

  return node.id.properties.flatMap((property): [TSESTree.Property, string][] => {
    if (property.type !== AST_NODE_TYPES.Property) {
      return [];
    }

    const name = keyName(property);

    return name === undefined ? [] : [[property, name]];
  });
}

function keyName(property: TSESTree.Property): string | undefined {
  if (property.key.type === AST_NODE_TYPES.Identifier && !property.computed) {
    return property.key.name;
  }

  return property.key.type === AST_NODE_TYPES.Literal && typeof property.key.value === 'string'
    ? property.key.value
    : undefined;
}

function forbiddenConstruction(rule: Purity, callee: string, argumentCount: number): string | undefined {
  if (rule.constructions.includes(callee)) {
    return `new ${callee}`;
  }

  return rule.bareConstructions.includes(callee) && argumentCount === 0
    ? `new ${callee}() without argument`
    : undefined;
}
