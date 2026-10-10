import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { defineRule, type Report } from './rule/define-rule.js';
import { ambientName } from './globals/ambient-name.js';
import { propertyName } from './globals/property-name.js';
import { importListener } from './imports/import-listener.js';
import { innerLayer } from './imports/inner-layer.js';

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

      const used = usageReporter(layer, report);
      const ambient = (node: TSESTree.Node): string => ambientName(sourceCode, node) ?? '';

      return {
        ...importListener(file, ({ node, target }) => {
          if (target.kind !== 'file' && rule.modules.includes(moduleName(target))) {
            report({ node, messageId: 'imported', data: { name: target.name, layer } });
          }
        }),
        ImportSpecifier: (node) => used(node, forbiddenNamedImport(rule, node)),
        MemberExpression: (node) => used(node, forbiddenMember(rule, ambient(node.object), propertyName(node))),
        'CallExpression:exit': (node: TSESTree.CallExpression) =>
          used(node, rule.calls.includes(ambient(node.callee)) ? `${ambient(node.callee)}()` : undefined),
        NewExpression: (node) => used(node, forbiddenConstruction(rule, ambient(node.callee), node.arguments.length)),
      };
    },
  });
}

function usageReporter(
  layer: string,
  report: Report<'used' | 'imported'>,
): (node: TSESTree.Node, what: string | undefined) => void {
  return (node, what) => {
    if (what !== undefined) {
      report({ node, messageId: 'used', data: { what, layer } });
    }
  };
}

function moduleName(target: { readonly kind: 'package' | 'builtin'; readonly name: string }): string {
  return target.kind === 'builtin' ? (target.name.replace(/^node:/, '').split('/')[0] ?? '') : target.name;
}

function forbiddenNamedImport(rule: Purity, node: TSESTree.ImportSpecifier): string | undefined {
  if (node.parent.type !== AST_NODE_TYPES.ImportDeclaration) {
    return undefined;
  }

  const source = node.parent.source.value;
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

function forbiddenConstruction(rule: Purity, callee: string, argumentCount: number): string | undefined {
  if (rule.constructions.includes(callee)) {
    return `new ${callee}`;
  }

  return rule.bareConstructions.includes(callee) && argumentCount === 0
    ? `new ${callee}() without argument`
    : undefined;
}
