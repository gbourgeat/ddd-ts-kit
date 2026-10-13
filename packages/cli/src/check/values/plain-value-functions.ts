import { fileExports } from '../exports/file-exports.js';
import type { Finding } from '../model/finding.js';
import type { SourceFile } from '../model/source-file.js';
import { answeredLiterals } from './answered-literals.js';
import { exportedFunctionBody } from './exported-function-body.js';
import { generateHint } from './generate-hint.js';
import { standsForAValue } from './stands-for-a-value.js';

/**
 * The exported functions of a domain file that answer a plain object holding data: a value of
 * the model written as a function. A function that answers a value object, a boolean, a number
 * or an object of functions only (a specification, a strategy) is not one.
 */
export function plainValueFunctions(file: SourceFile): Finding[] {
  return fileExports(file).flatMap((exported) => {
    const body = exportedFunctionBody(exported);
    const answers = body === undefined ? [] : answeredLiterals(exported.text, body);

    if (!answers.some((open) => standsForAValue(exported.text, open))) {
      return [];
    }

    const name = exported.name.charAt(0).toUpperCase() + exported.name.slice(1);

    return [
      {
        line: exported.line,
        message: `${exported.name} builds a plain object: a value of the model written as a function.`,
        fix: `Write it as a value object class (${generateHint(file, name)}): its rules checked once in a static factory, \`equals\` to compare two of them, its operations as methods next to its data. A domain service, a state machine, a specification or a function that takes and returns value objects stays as it is.`,
      },
    ];
  });
}
