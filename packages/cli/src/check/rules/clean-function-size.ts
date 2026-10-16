import { FUNCTION_LINES_CEILING, type Limits } from '../../config/index.js';
import type { Finding } from '../model/finding.js';
import type { Flaw } from '../model/flaw.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import type { Violation } from '../model/violation.js';
import type { FunctionShape } from '../structure/function-shape.js';
import { inlineFunctions } from '../structure/inline-functions.js';
import { reporter } from '../support/reporter.js';

interface Measured {
  readonly label: string;
  readonly line: number;
  readonly parameters: number;
  readonly bodyLines: number;
  /** A constructor lists the dependencies it is given: that is wiring, not a signature to shorten. */
  readonly isInjected: boolean;
  /** The module file of a context is its composition: a list that grows with the context, not logic to split. */
  readonly isComposition: boolean;
}

const SPLIT_FIX =
  'Extract each step into a function named after what it does, placed below this one, until the body reads as a list of intentions; a test suite is split into several top-level `describe` blocks of the same spec file, one per behaviour (a nested `describe` counts in its parent), and into a second spec file only past the 350 lines of clean/file-size.';

export const cleanFunctionSize: Rule = {
  id: 'clean/function-size',
  description: `A function has at most 3 parameters and 30 lines (configurable under \`limits\`), and never more than ${FUNCTION_LINES_CEILING} lines, which is an error whatever the severity of the rule.`,
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const { limits } = project.config;

    return project.files.flatMap((file) => {
      const declared = measured(file).flatMap((shape): Violation[] => {
        const at = { file: file.path, line: shape.line };
        const ceiling = overTheCeiling(shape);

        if (ceiling !== undefined) {
          return [{ ...report(at, ceiling.message, ceiling.fix), severity: 'error' }];
        }

        return [...tooManyParameters(shape, limits), ...tooLong(shape, limits)].map(({ message, fix }) =>
          report(at, message, fix),
        );
      });

      return [
        ...declared,
        ...inline(file).map(
          ({ line, message, fix }): Violation => ({
            ...report({ file: file.path, line }, message, fix),
            severity: 'error',
          }),
        ),
      ];
    });
  },
};

function measured(file: SourceFile): Measured[] {
  const isComposition = file.location.area === 'context' && file.location.layer === 'module';

  const measure = (shape: FunctionShape, label: string): Omit<Measured, 'isInjected'> => ({
    label,
    line: shape.line,
    parameters: countedParameters(shape.parameters),
    bodyLines: shape.bodyLines,
    isComposition,
  });

  const methods = file.structure.classes.flatMap((shape) =>
    shape.methods.map((method) => ({
      ...measure(method, `${shape.name}.${method.name}`),
      isInjected: method.isConstructor,
    })),
  );

  return [
    ...methods,
    ...file.structure.functions.map((shape) => ({ ...measure(shape, shape.name), isInjected: false })),
  ];
}

/** Arrows, function expressions and nested functions are held to the ceiling only: a callback of `describe` or `it` as any other. */
function inline(file: SourceFile): Finding[] {
  return inlineFunctions(file.scan, FUNCTION_LINES_CEILING).map(({ label, line, bodyLines }) => ({
    line,
    ...ceilingFlaw(label, bodyLines),
  }));
}

/** The ceiling holds everywhere, module files and tests included, and is not configurable. */
function overTheCeiling(shape: Measured): Flaw | undefined {
  return shape.bodyLines <= FUNCTION_LINES_CEILING ? undefined : ceilingFlaw(shape.label, shape.bodyLines);
}

function ceilingFlaw(label: string, bodyLines: number): Flaw {
  return {
    message: `${label} is ${bodyLines} lines long: no function is longer than ${FUNCTION_LINES_CEILING} lines.`,
    fix: SPLIT_FIX,
  };
}

/** A parameter typed `Actor` or `Date`: who acts and when, the context of an intention rather than its input. */
const CONTEXT_PARAMETER = /^[\w$]+\s*:\s*(?:Actor|Date)\s*$/;

/** The parameters a signature is judged on: one that carries the actor or the instant is not counted. */
function countedParameters(parameters: readonly string[]): number {
  return parameters.some((parameter) => CONTEXT_PARAMETER.test(parameter.trim()))
    ? parameters.length - 1
    : parameters.length;
}

function tooManyParameters(shape: Measured, limits: Limits): Flaw[] {
  if (shape.isInjected || shape.parameters <= limits.maxParameters) {
    return [];
  }

  return [
    {
      message: `${shape.label} takes ${shape.parameters} parameters (limit ${limits.maxParameters}, an actor or an instant not counted).`,
      fix: 'Group the parameters that travel together into a typed props object or a value object (`Invoice.draft({ customer, lines, currency, draftedAt })`): they are a concept that has no name yet. Never add one more parameter, nor split the function only to get under the limit.',
    },
  ];
}

function tooLong(shape: Measured, limits: Limits): Flaw[] {
  if (shape.isComposition || shape.bodyLines <= limits.maxFunctionLines) {
    return [];
  }

  return [
    { message: `${shape.label} is ${shape.bodyLines} lines long (limit ${limits.maxFunctionLines}).`, fix: SPLIT_FIX },
  ];
}
