import path from 'node:path';
import { ESLintUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../../project/linted-file';
import { locate } from '../../project/locate';
import { toPosix } from '../../project/to-posix';
import { camel } from './camel';
import type { ProposedName } from './proposed-name';

/** What the type checker tells of the project: which concept of the model an expression holds, and whether it is a repository. */
export interface TypedNames {
  /** An aggregate, an entity or a value object of the project, or a list of them, once awaited and without `undefined`. */
  modelOf(node: TSESTree.Node): ProposedName | undefined;
  /** An instance of a repository port of `domain/repositories/`. */
  isRepository(node: TSESTree.Node): boolean;
}

const MODEL_DIRECTORIES = ['aggregates', 'entities', 'value-objects'];

interface DeclaredType {
  readonly file: string;
  readonly name: string;
  readonly many: boolean;
}

/** Undefined when the parser was given no program: the rule then reads the names of the code. */
export function typedNames(
  context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
  file: LintedFile,
): TypedNames | undefined {
  const services = ESLintUtils.getParserServices(context, true);

  if (services.program === null) {
    return undefined;
  }

  const checker = services.program.getTypeChecker();

  /** The file that declares the type of `node`, the element type for a list, and the name of that type. */
  const declared = (node: TSESTree.Node): DeclaredType | undefined => {
    const found = services.getTypeAtLocation(node);
    const type = (checker.getAwaitedType(found) ?? found).getNonNullableType();
    const many = checker.isArrayType(type);
    const symbol = symbolOf(many ? type.getNumberIndexType() : type);
    const source = symbol?.declarations?.[0]?.getSourceFile().fileName;

    return symbol === undefined || source === undefined ? undefined : { file: source, name: symbol.getName(), many };
  };

  return {
    modelOf(node) {
      const type = declared(node);
      const place = type === undefined ? undefined : placeOf(file, type.file);

      if (type === undefined || place === undefined || !isModelPlace(place)) {
        return undefined;
      }

      return { element: camel(type.name), many: type.many };
    },
    isRepository(node) {
      const type = declared(node);
      const place = type === undefined ? undefined : placeOf(file, type.file);

      return place?.area === 'context' && place.layer === 'domain' && place.inside[0] === 'repositories';
    },
  };
}

function placeOf(file: LintedFile, absolute: string): ReturnType<typeof locate> | undefined {
  const relative = toPosix(path.relative(file.root, absolute));

  return relative.startsWith('../') || relative.includes('node_modules/') ? undefined : locate(file.config, relative);
}

function isModelPlace(place: ReturnType<typeof locate>): boolean {
  if (place.area === 'shared-kernel') {
    return true;
  }

  return place.area === 'context' && place.layer === 'domain' && MODEL_DIRECTORIES.includes(place.inside[0] ?? '');
}

/** The symbol a type is declared by: its class or interface, or the alias it was written with. */
function symbolOf<Symbol>(
  type: { getSymbol(): Symbol | undefined; readonly aliasSymbol?: Symbol } | undefined,
): Symbol | undefined {
  return type?.getSymbol() ?? type?.aliasSymbol;
}
