import type { ClassShape, MethodShape } from '../structure.js';
import type { Rule, SourceFile } from '../types.js';
import { inContext, reporter } from './helpers.js';

const BOOLEAN_PARAMETER = /^(?:(?:public|private|protected|readonly|override)\s+)*([A-Za-z_$][\w$]*)\s*\??\s*(?::\s*boolean\s*(?:=.*)?|=\s*(?:true|false))$/;

export const cleanNoFlagArgument: Rule = {
  id: 'clean/no-flag-argument',
  description: 'No boolean parameter on a public method of the domain or a use case: two intentions are two methods.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.flatMap((file) =>
      judgedMethods(file).flatMap(({ shape, method }) =>
        flagsOf(method).map((flag) =>
          report(
            { file: file.path, line: method.line },
            `${shape.name}.${method.name} takes the flag "${flag}".`,
            `Split ${method.name} into two methods named after each intention, so that a call site says what it does without a true or false to decode.`,
          ),
        ),
      ),
    );
  },
};

function judgedMethods(file: SourceFile): { shape: ClassShape; method: MethodShape }[] {
  return file.structure.classes.flatMap((shape) => shape.methods.filter((method) => isJudged(file, shape, method)).map((method) => ({ shape, method })));
}

function flagsOf(method: MethodShape): string[] {
  return method.parameters.map((parameter) => BOOLEAN_PARAMETER.exec(parameter.replace(/\s+/g, ' '))?.[1]).filter((name) => name !== undefined);
}

/** Public behaviour of the domain, and the `execute` of a use case. Messages carry data: they are exempt. */
function isJudged(file: SourceFile, shape: ClassShape, method: MethodShape): boolean {
  if (!inContext(file.location) || file.isTest || method.visibility !== 'public' || method.isConstructor) return false;
  if (/(?:Command|Query)$/.test(shape.name)) return false;
  if (file.location.layer === 'domain') return true;
  return file.location.layer === 'application' && method.name === 'execute';
}
