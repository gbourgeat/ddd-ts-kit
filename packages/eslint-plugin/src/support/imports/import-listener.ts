import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { resolveImport, type ImportTarget } from '../../project/resolve-import';
import type { LintedFile } from '../../project/linted-file';
import { staticString } from './static-string';

export interface ImportedName {
  /** The name exported by the module, whatever it is renamed to locally. */
  readonly name: string;
  readonly node: TSESTree.Node;
}

export interface ImportSite {
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

/** The listeners of the imports, the one of the declarations always there: a rule that adds to it calls it. */
export type ImportListener = TSESLint.RuleListener & {
  readonly ImportDeclaration: (node: TSESTree.ImportDeclaration) => void;
};

/** Every way a module names another one: static, type-only, re-export, dynamic, `require`, `import()` types. */
export function importListener(file: LintedFile, visit: Visit): ImportListener {
  const see = (source: TSESTree.Node | null | undefined, taken: Taken = WHOLE): void => {
    if (source === null || source === undefined) {
      return;
    }

    const specifier = staticString(source);

    if (specifier === undefined) {
      return;
    }

    visit({ specifier, node: source, target: resolveImport(file.config, file.path, specifier), ...taken });
  };

  return {
    ImportDeclaration: (node) => see(node.source, importedNames(node)),
    ExportNamedDeclaration: (node) =>
      see(node.source, {
        names: node.specifiers.map((specifier) => ({ name: moduleExportName(specifier.local), node: specifier })),
        whole: false,
      }),
    ExportAllDeclaration: (node) => see(node.source),
    ImportExpression: (node) => see(node.source),
    TSImportType: (node) => see(node.source),
    TSExternalModuleReference: (node) => see(node.expression),
    CallExpression: (node) => see(isRequireCall(node) ? node.arguments[0] : undefined),
  };
}

function importedNames(node: TSESTree.ImportDeclaration): Taken {
  const named = node.specifiers.filter((specifier) => specifier.type === AST_NODE_TYPES.ImportSpecifier);

  return {
    names: named.map((specifier) => ({ name: moduleExportName(specifier.imported), node: specifier })),
    whole: named.length < node.specifiers.length,
  };
}

function moduleExportName(name: TSESTree.Identifier | TSESTree.StringLiteral): string {
  return name.type === AST_NODE_TYPES.Identifier ? name.name : name.value;
}

function isRequireCall(node: TSESTree.CallExpression): boolean {
  return (
    node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'require' && node.arguments.length === 1
  );
}
