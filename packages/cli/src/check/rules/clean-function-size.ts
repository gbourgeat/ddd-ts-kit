import type { FunctionShape } from '../structure.js';
import type { Config } from '../../config.js';
import type { Rule, SourceFile } from '../types.js';
import { reporter } from './helpers.js';

export const cleanFunctionSize: Rule = {
  id: 'clean/function-size',
  description: 'A function has at most 3 parameters and 30 lines (configurable under `limits`); a longer one is doing more than one thing.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.flatMap((file) => measured(file).flatMap((shape) => [...tooManyParameters(shape, project.config.limits), ...tooLong(shape, project.config.limits)].map(({ message, fix }) => report({ file: file.path, line: shape.line }, message, fix))));
  },
};

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

interface Excess {
  readonly message: string;
  readonly fix: string;
}

function measured(file: SourceFile): Measured[] {
  const isComposition = file.location.area === 'context' && file.location.layer === 'module';
  const measure = (shape: FunctionShape, label: string): Omit<Measured, 'isInjected'> => ({ label, line: shape.line, parameters: shape.parameters.length, bodyLines: shape.bodyLines, isComposition });
  const methods = file.structure.classes.flatMap((shape) => shape.methods.map((method) => ({ ...measure(method, `${shape.name}.${method.name}`), isInjected: method.isConstructor })));
  return [...methods, ...file.structure.functions.map((shape) => ({ ...measure(shape, shape.name), isInjected: false }))];
}

function tooManyParameters(shape: Measured, limits: Config['limits']): Excess[] {
  if (shape.isInjected || shape.parameters <= limits.maxParameters) return [];
  return [
    {
      message: `${shape.label} takes ${shape.parameters} parameters (limit ${limits.maxParameters}).`,
      fix: 'Group the parameters that travel together into a value object or a named parameter object: they are a concept that has no name yet.',
    },
  ];
}

function tooLong(shape: Measured, limits: Config['limits']): Excess[] {
  if (shape.isComposition || shape.bodyLines <= limits.maxFunctionLines) return [];
  return [
    {
      message: `${shape.label} is ${shape.bodyLines} lines long (limit ${limits.maxFunctionLines}).`,
      fix: 'Extract each step into a function named after what it does, placed below this one, until the body reads as a list of intentions.',
    },
  ];
}
