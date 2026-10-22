import type { Finding } from '../model/finding';
import type { SourceFile } from '../model/source-file';
import { answeredLiterals } from './answered-literals';
import { exportedFunctionBody } from './exported-function-body';
import { exportedValues } from './exported-values';
import { generateHint } from './generate-hint';
import { returnsPackageType } from './returns-package-type';
import { standsForAValue } from './stands-for-a-value';

/**
 * The exported functions of a file of the model that answer a record of data: a value of the
 * model written as a function. A function that answers a value object, a boolean, a number, an
 * object of functions only (a specification, a strategy), a record holding what a call of the
 * model built, a record derived by a spread, or a type of a package is not one.
 */
export function plainValueFunctions(file: SourceFile): Finding[] {
  return exportedValues(file).flatMap((exported) => {
    const body = exportedFunctionBody(exported);

    if (body === undefined || returnsPackageType(file, exported, body)) {
      return [];
    }

    const answers = answeredLiterals(exported.text, body);

    if (!answers.some((open) => standsForAValue(exported.text, open, file.scan.code))) {
      return [];
    }

    const name = exported.name.charAt(0).toUpperCase() + exported.name.slice(1);

    return [
      {
        line: exported.line,
        message: `${exported.name} builds a plain object: a value of the model written as a function.`,
        fix: `Write it as a value object class (${generateHint(file, name)}): its rules checked once in a static factory, \`equals\` to compare two of them, its operations as methods next to its data. A domain service, a state machine, a specification, a function that answers value objects it builds or derives a record with a spread stays as it is.`,
      },
    ];
  });
}
