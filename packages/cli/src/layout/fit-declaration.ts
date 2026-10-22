import { nesting } from './nesting';
import { splitTopLevel } from './split-top-level';

const STEP = '  ';
const NAMED_IMPORT = /^(import (?:type )?\{) (.+,.+) (\} from '[^']+';)$/;
const CLASS = /^((?:export )?(?:abstract )?class \w+(?:<.*?>)?) ((?:extends|implements) .+) \{$/;
const SIGNATURE = /^(?:export )?(?:(?:async|abstract|private|protected|public|static|override) )*(?:function )?\w+\(/;
const GENERIC_ALIAS = /^((?:export )?type \w+ = \w+<)(.+)(>;)$/;
const CONTROL = /^(?:if|for|while|switch|catch|return|await|new)\b/;

/**
 * The lines of a declaration that no longer fits its line, the way the formatter of a generated
 * project breaks it: the names of an import one per line, the heritage of a class clause by
 * clause, the parameters of a function or a method one per line. Undefined for anything else.
 */
export function fitDeclaration(declaration: string, indent: string): string[] | undefined {
  const named = NAMED_IMPORT.exec(declaration);
  const classed = CLASS.exec(declaration);

  if (named !== null) {
    return [named[1] ?? '', ...splitTopLevel(named[2] ?? '').map((name) => `${STEP}${name},`), named[3] ?? ''];
  }

  if (classed !== null) {
    return heritageApart(classed[1] ?? '', classed[2] ?? '', indent);
  }

  return (
    parametersApart(declaration, indent) ??
    typeArgumentsApart(declaration, indent) ??
    operandsApart(declaration, indent)
  );
}

const GENERIC_PARENT = /^(extends \w+<)(.+)>$/;

/** A class that only extends a generic parent keeps it on its line and gives each type argument its own; otherwise each clause takes a line. */
function heritageApart(declared: string, heritage: string, indent: string): string[] {
  const [, parent = '', passed = ''] = GENERIC_PARENT.exec(heritage) ?? [];
  const clauses = heritage.split(/ (?=implements )/);

  if (parent !== '' && clauses.length === 1) {
    const last = splitTopLevel(passed).length - 1;

    return [
      `${indent}${declared} ${parent}`,
      ...splitTopLevel(passed).map((argument, index) => `${indent}${STEP}${argument}${index < last ? ',' : ''}`),
      `${indent}> {`,
    ];
  }

  return [`${indent}${declared}`, ...clauses.map((clause) => `${indent}${STEP}${clause}`), `${indent}{`];
}

function parametersApart(declaration: string, indent: string): string[] | undefined {
  const depths = nesting(declaration);
  const open = declaration.indexOf('(');
  const close = depths.indexOf(0, open + 1);
  const isSignature = SIGNATURE.test(declaration) && !CONTROL.test(declaration);

  if (!isSignature || close === -1 || !/^\)(?:: .+)?(?: \{|;)$/.test(declaration.slice(close))) {
    return undefined;
  }

  return [
    `${indent}${declaration.slice(0, open + 1)}`,
    ...splitTopLevel(declaration.slice(open + 1, close)).map((parameter) => `${indent}${STEP}${parameter},`),
    `${indent}${declaration.slice(close)}`,
  ];
}

function typeArgumentsApart(declaration: string, indent: string): string[] | undefined {
  const [, opening = '', passed = '', closing = ''] = GENERIC_ALIAS.exec(declaration) ?? [];

  if (opening === '') {
    return undefined;
  }

  return [
    `${indent}${opening}`,
    ...splitTopLevel(passed).map(
      (argument, index, all) => `${indent}${STEP}${argument}${index < all.length - 1 ? ',' : ''}`,
    ),
    `${indent}${closing}`,
  ];
}

/** A condition written alone on its line, operand by operand, each `&&` left at the end of its line. */
function operandsApart(condition: string, indent: string): string[] | undefined {
  const depths = nesting(condition);
  const operands = condition.split(' && ');
  const isBare = !/[;{,]$/.test(condition) && !/^[?:]/.test(condition) && !condition.includes(' || ');
  const isFlat = [...condition.matchAll(/ && /g)].every((match) => depths[match.index] === 0);

  if (operands.length < 2 || !isBare || !isFlat) {
    return undefined;
  }

  return operands.map((operand, index) => `${indent}${operand}${index < operands.length - 1 ? ' &&' : ''}`);
}
