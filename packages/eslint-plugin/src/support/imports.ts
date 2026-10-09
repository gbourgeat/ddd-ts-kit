import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { resolveImport, type ContextLocation, type ImportTarget, type Layer } from '../project/classify.js';
import type { LintedFile } from '../project/linted-file.js';

interface ImportSite {
  readonly specifier: string;
  /** The specifier literal: where the report points. */
  readonly node: TSESTree.Node;
  readonly target: ImportTarget;
}

type Visit = (site: ImportSite) => void;

/** Every way a module names another one: static, type-only, re-export, dynamic, `require`, `import()` types. */
export function importListener(file: LintedFile, visit: Visit): TSESLint.RuleListener {
  const see = (source: TSESTree.Node | null | undefined): void => {
    if (source === null || source === undefined) return;
    const specifier = staticString(source);
    if (specifier === undefined) return;
    visit({ specifier, node: source, target: resolveImport(file.config, file.path, specifier) });
  };
  return {
    ImportDeclaration: (node) => see(node.source),
    ExportNamedDeclaration: (node) => see(node.source),
    ExportAllDeclaration: (node) => see(node.source),
    ImportExpression: (node) => see(node.source),
    TSImportType: (node) => see(node.source),
    TSExternalModuleReference: (node) => see(node.expression),
    CallExpression: (node) => see(isRequireCall(node) ? node.arguments[0] : undefined),
  };
}

export function inLayer(file: LintedFile, layer: Layer): ContextLocation | undefined {
  return file.location.area === 'context' && file.location.layer === layer && !file.isTest ? file.location : undefined;
}

export function inContext(file: LintedFile): ContextLocation | undefined {
  return file.location.area === 'context' ? file.location : undefined;
}

export function describeTarget(target: ImportTarget): string {
  if (target.kind !== 'file') return `"${target.name}"`;
  const { location } = target;
  if (location.area === 'context') return `${location.context}/${location.layer === 'module' ? 'module file' : location.layer}`;
  return location.area === 'other' ? target.path : location.area;
}

export function staticString(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Literal) return typeof node.value === 'string' ? node.value : undefined;
  if (node.type !== AST_NODE_TYPES.TemplateLiteral || node.expressions.length > 0) return undefined;
  return node.quasis[0]?.value.cooked ?? undefined;
}

function isRequireCall(node: TSESTree.CallExpression): boolean {
  return node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'require' && node.arguments.length === 1;
}
