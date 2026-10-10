import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import type { ClassShape } from '../structure/class-shape.js';
import type { MethodShape } from '../structure/method-shape.js';
import { inContext } from '../support/in-context.js';
import { perFile } from '../support/per-file.js';

const BOOLEAN_PARAMETER = /^(?:(?:public|private|protected|readonly|override)\s+)*([A-Za-z_$][\w$]*)\s*\??\s*(?::\s*boolean\s*(?:=.*)?|=\s*(?:true|false))$/;

export const cleanNoFlagArgument: Rule = {
  id: 'clean/no-flag-argument',
  description: 'No boolean parameter on a public method of the domain or a use case: two intentions are two methods.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) =>
      file.structure.classes.flatMap((shape) =>
        shape.methods
          .filter((method) => isJudged(file, shape, method))
          .flatMap((method) =>
            flagsOf(method).map((flag) => ({
              line: method.line,
              message: `${shape.name}.${method.name} takes the flag "${flag}".`,
              fix: `Split ${method.name} into two methods named after each intention, so that a call site says what it does without a true or false to decode.`,
            })),
          ),
      ),
    );
  },
};

function flagsOf(method: MethodShape): string[] {
  return method.parameters.flatMap((parameter) => BOOLEAN_PARAMETER.exec(parameter.replace(/\s+/g, ' '))?.[1] ?? []);
}

/** Public behaviour of the domain, and the `execute` of a use case. Messages carry data: they are exempt. */
function isJudged(file: SourceFile, shape: ClassShape, method: MethodShape): boolean {
  if (!inContext(file.location) || file.isTest || method.visibility !== 'public' || method.isConstructor) return false;
  if (/(?:Command|Query)$/.test(shape.name)) return false;
  if (file.location.layer === 'domain') return true;

  return file.location.layer === 'application' && method.name === 'execute';
}
