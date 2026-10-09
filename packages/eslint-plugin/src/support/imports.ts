import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { resolveImport, type ContextLocation, type ImportTarget, type Layer } from '../project/classify.js';
import type { LintedFile } from '../project/linted-file.js';

export interface ImportedName {
  /** The name exported by the module, whatever it is renamed to locally. */
  readonly name: string;
  readonly node: TSESTree.Node;
}

interface ImportSite {
  readonly specifier: string;
  /** The specifier literal: where the report points. */
  readonly node: TSESTree.Node;
  readonly target: ImportTarget;
  /** The exports taken one by one: `{ a, b as c }`. */
  readonly names: readonly ImportedName[];
  /** True when the module is taken as a whole: default, namespace, `export *`, dynamic import, `require`. */
  readonly whole: boolean;
}

type Taken = Pick<ImportSite, 'names' | 'whole'>;

const WHOLE: Taken = { names: [], whole: true };

type Visit = (site: ImportSite) => void;

/** Every way a module names another one: static, type-only, re-export, dynamic, `require`, `import()` types. */
export function importListener(file: LintedFile, visit: Visit): TSESLint.RuleListener {
  const see = (source: TSESTree.Node | null | undefined, taken: Taken = WHOLE): void => {
    if (source === null || source === undefined) return;
    const specifier = staticString(source);
    if (specifier === undefined) return;
    visit({ specifier, node: source, target: resolveImport(file.config, file.path, specifier), ...taken });
  };
  return {
    ImportDeclaration: (node) => see(node.source, importedNames(node)),
    ExportNamedDeclaration: (node) => see(node.source, { names: node.specifiers.map((specifier) => ({ name: moduleExportName(specifier.local), node: specifier })), whole: false }),
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

/** `domain` or `application` for a production file of one of the two layers that hold the model and the use cases. */
export function innerLayer(file: LintedFile): 'domain' | 'application' | undefined {
  if (file.location.area !== 'context' || file.isTest) return undefined;
  const { layer } = file.location;
  return layer === 'domain' || layer === 'application' ? layer : undefined;
}

/** A production or test source of the project itself, as opposed to a script or a config file next to it. */
export function inSourceRoot(file: LintedFile): boolean {
  return file.path.startsWith(`${file.config.sourceRoot}/`);
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

function importedNames(node: TSESTree.ImportDeclaration): Taken {
  const named = node.specifiers.filter((specifier) => specifier.type === AST_NODE_TYPES.ImportSpecifier);
  return { names: named.map((specifier) => ({ name: moduleExportName(specifier.imported), node: specifier })), whole: named.length < node.specifiers.length };
}

function moduleExportName(name: TSESTree.Identifier | TSESTree.StringLiteral): string {
  return name.type === AST_NODE_TYPES.Identifier ? name.name : name.value;
}

function isRequireCall(node: TSESTree.CallExpression): boolean {
  return node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'require' && node.arguments.length === 1;
}
