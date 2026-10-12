import { buildsThroughFactories } from '../errors/builds-through-factories.js';
import { errorCodes } from '../errors/error-codes.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { perFile } from '../support/per-file.js';

const FIX =
  'Give each refusal of a context its own code, or call the factory that already sets this one: the HTTP mapping, the OpenAPI document, the audit trail and the tests know a refusal by its code alone.';

export const errorsCodeUnique: Rule = {
  id: 'errors/code-unique',
  description:
    'Under "stack.refusals": "factories", a code is given to one refusal of a context: no two factories, and no two error classes, of the domain/errors/ of a context set the same code.',
  scope: 'project',
  run(project) {
    if (!buildsThroughFactories(project)) {
      return [];
    }

    // Remembers, across the error files of a context, where each code was first written.
    const firstUse = new Map<string, string>();

    return perFile(project, this.id, (file) => codesTaken(file, firstUse));
  },
};

function codesTaken(file: SourceFile, firstUse: Map<string, string>): Finding[] {
  const { location } = file;

  if (location.area !== 'context' || location.layer !== 'domain' || location.inside[0] !== 'errors' || file.isTest) {
    return [];
  }

  return errorCodes(file.scan).flatMap(({ code, line }) => {
    const key = `${location.context} ${code}`;
    const first = firstUse.get(key);

    if (first === undefined) {
      firstUse.set(key, `${file.path}:${line}`);
    }

    return first === undefined
      ? []
      : [{ line, message: `The code "${code}" is already set in ${first}, in the same context.`, fix: FIX }];
  });
}
