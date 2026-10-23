import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { ancestors } from '../ancestors';
import { CallGraph } from './call-graph';
import { isFunction } from '../classes/is-function';

export interface ModuleFinding {
  readonly node: TSESTree.Identifier;
  readonly data: { readonly name: string; readonly line: number };
}

interface Declared {
  readonly id: TSESTree.Identifier;
  /** The function declaration or the variable declarator: uses inside it are its own body. */
  readonly extent: TSESTree.Node;
  readonly exported: boolean;
  /** A function declaration can be called above its text; a constant holding a function cannot. */
  readonly hoisted: boolean;
  readonly uses: readonly TSESTree.Node[];
}

/** Non-exported top-level functions declared above their first caller. */
export function misplacedFunctions(
  program: TSESTree.Program,
  sourceCode: Readonly<TSESLint.SourceCode>,
): ModuleFinding[] {
  const declared = program.body.flatMap((statement) => declaredIn(statement, sourceCode));
  const graph = callGraph(declared);

  return declared.flatMap((helper) => {
    if (helper.exported || helper.uses.some(isExport) || (!helper.hoisted && helper.uses.some(runsAtLoad))) {
      return [];
    }

    const callers = helper.uses.filter((use) => !isRecursive({ helper, use, declared, graph }));

    const first = callers.reduce<TSESTree.Node | undefined>(
      (earliest, use) => (earliest === undefined || use.range[0] < earliest.range[0] ? use : earliest),
      undefined,
    );

    if (first === undefined || first.range[0] < helper.extent.range[0]) {
      return [];
    }

    return [{ node: helper.id, data: { name: helper.id.name, line: first.loc.start.line } }];
  });
}

function declaredIn(statement: TSESTree.ProgramStatement, sourceCode: Readonly<TSESLint.SourceCode>): Declared[] {
  const exported =
    statement.type === AST_NODE_TYPES.ExportNamedDeclaration ||
    statement.type === AST_NODE_TYPES.ExportDefaultDeclaration;

  const declaration = exported ? statement.declaration : statement;

  if (declaration?.type === AST_NODE_TYPES.FunctionDeclaration && declaration.id !== null) {
    return [describe({ id: declaration.id, extent: declaration, exported, hoisted: true }, sourceCode)];
  }

  if (declaration?.type !== AST_NODE_TYPES.VariableDeclaration) {
    return [];
  }

  return declaration.declarations.flatMap((declarator) =>
    declarator.id.type === AST_NODE_TYPES.Identifier && declarator.init !== null && isFunction(declarator.init)
      ? [describe({ id: declarator.id, extent: declarator, exported, hoisted: false }, sourceCode)]
      : [],
  );
}

function describe(declared: Omit<Declared, 'uses'>, sourceCode: Readonly<TSESLint.SourceCode>): Declared {
  const variable = sourceCode
    .getDeclaredVariables(declared.extent)
    .find((candidate) => candidate.identifiers.includes(declared.id));

  const references = variable?.references.filter((reference) => !reference.init && reference.isValueReference) ?? [];

  return {
    ...declared,
    uses: references.map((reference) => reference.identifier).filter((use) => !isInside(use, declared.extent)),
  };
}

function callGraph(declared: readonly Declared[]): CallGraph<Declared> {
  const graph = new CallGraph<Declared>();

  for (const callee of declared) {
    for (const use of callee.uses) {
      const caller = declared.find((candidate) => isInside(use, candidate.extent));

      if (caller !== undefined) {
        graph.add(caller, callee);
      }
    }
  }

  return graph;
}

interface Call {
  readonly helper: Declared;
  readonly use: TSESTree.Node;
  readonly declared: readonly Declared[];
  readonly graph: CallGraph<Declared>;
}

/** A use inside a function that the helper itself calls: mutual recursion has no right order. */
function isRecursive({ helper, use, declared, graph }: Call): boolean {
  const caller = declared.find((candidate) => isInside(use, candidate.extent));

  return caller !== undefined && graph.reaches(helper, caller);
}

function isExport(use: TSESTree.Node): boolean {
  return (
    use.parent?.type === AST_NODE_TYPES.ExportSpecifier || use.parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration
  );
}

/** Evaluated while the module loads: such a use needs a constant to be initialised above it. */
function runsAtLoad(use: TSESTree.Node): boolean {
  for (const ancestor of ancestors(use)) {
    if (isFunction(ancestor) || ancestor.type === AST_NODE_TYPES.FunctionDeclaration) {
      return false;
    }

    if (ancestor.type === AST_NODE_TYPES.PropertyDefinition && !ancestor.static) {
      return false;
    }
  }

  return true;
}

function isInside(node: TSESTree.Node, container: TSESTree.Node): boolean {
  return node.range[0] >= container.range[0] && node.range[1] <= container.range[1];
}
