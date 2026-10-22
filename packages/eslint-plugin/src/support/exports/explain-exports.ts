import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { derivedFormsOf } from './derived-forms-of';
import type { ExportExplanation } from './export-explanation';
import type { ModuleShape } from './module-shape';
import { sharesPrivateState } from './shares-private-state';
import { signatureOf } from './signature-of';
import { typeClosure } from './type-closure';
import { typeFamilyOf } from './type-family-of';

type Source = Readonly<TSESLint.SourceCode>;

/**
 * Says how the exported classes, interfaces and functions of a module make one thing, or answers
 * undefined when they do not. Every explanation that holds adds the names it allows the file to carry.
 */
export function explainExports(shape: ModuleShape, sourceCode: Source): ExportExplanation | undefined {
  if (shape.counted.length === 0) {
    return { mains: [] };
  }

  const named = [bySignature(shape), byTypeFamily(shape)].flatMap((explanation) =>
    explanation === undefined || explanation.mains === 'free' ? [] : explanation.mains,
  );

  if (named.length > 0) {
    return { mains: [...new Set(named)] };
  }

  return byTypeFamily(shape) ?? byPrivateState(shape, sourceCode);
}

/** One export and the types of its own signature. */
function bySignature(shape: ModuleShape): ExportExplanation | undefined {
  const names = [...new Set(shape.exports.map((declaration) => declaration.name))];

  const mains = names.filter((main) => {
    const together = [main, ...derivedFormsOf(shape, main)];

    return othersAreSignatureTypes(shape, together, signaturesOf(shape, together));
  });

  return mains.length === 0 ? undefined : { mains };
}

/** A type with its constructors or combinators. */
function byTypeFamily(shape: ModuleShape): ExportExplanation | undefined {
  const family = typeFamilyOf(shape);

  if (family === undefined) {
    return undefined;
  }

  const together = [family, ...functionNames(shape)];

  if (!othersAreSignatureTypes(shape, together, signaturesOf(shape, together))) {
    return undefined;
  }

  return { mains: shape.exports.some((declaration) => declaration.name === family) ? [family] : 'free' };
}

/** The accessors of one module-private state. */
function byPrivateState(shape: ModuleShape, sourceCode: Source): ExportExplanation | undefined {
  const together = functionNames(shape);

  const explained =
    sharesPrivateState(shape, sourceCode) && othersAreSignatureTypes(shape, together, signaturesOf(shape, together));

  return explained ? { mains: 'free' } : undefined;
}

function functionNames(shape: ModuleShape): string[] {
  return shape.exports.filter((declaration) => declaration.kind === 'function').map((declaration) => declaration.name);
}

function signaturesOf(shape: ModuleShape, names: readonly string[]): TSESTree.Node[] {
  return shape.declarations
    .filter((declaration) => names.includes(declaration.name))
    .flatMap((declaration) => signatureOf(declaration.node));
}

function othersAreSignatureTypes(
  shape: ModuleShape,
  together: readonly string[],
  signatures: readonly TSESTree.Node[],
): boolean {
  const reached = typeClosure(shape, signatures);

  const isInterface = (name: string): boolean =>
    shape.exports.every((declaration) => declaration.name !== name || declaration.kind === 'interface');

  return shape.counted.every((name) => together.includes(name) || (reached.has(name) && isInterface(name)));
}
