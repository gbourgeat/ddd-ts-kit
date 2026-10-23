import { buildsThroughFactories } from '../errors/builds-through-factories';
import { codesSetIn } from '../errors/codes-set-in';
import { isErrorFile } from '../errors/is-error-file';
import { namesRefusals } from '../errors/names-refusals';
import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { perFile } from '../support/per-file';

const WHY = 'the HTTP mapping, the OpenAPI document, the audit trail and the tests know a refusal by its code alone.';

const FACTORIES_FIX = `Give each refusal of a context its own code, or call the factory that already sets this one: ${WHY}`;

const NAMED_FIX = `Give each refusal class of the context its own value in domain/errors/codes.ts, or throw the refusal that already has this code from one of its factories: ${WHY}`;

export const errorsCodeUnique: Rule = {
  id: 'errors/code-unique',
  description:
    'Under "stack.refusals": "factories" or "named", a code is given to one refusal of a context: no two factories, no two error classes and no two entries of domain/errors/codes.ts, of the domain/errors/ of a context, set the same code.',
  scope: 'project',
  run(project) {
    if (!buildsThroughFactories(project)) {
      return [];
    }

    const fix = namesRefusals(project) ? NAMED_FIX : FACTORIES_FIX;
    // Remembers, across the error files of a context, where each code was first written.
    const firstUse = new Map<string, string>();

    return perFile(project, this.id, (file) => codesTaken(file, firstUse, fix));
  },
};

function codesTaken(file: SourceFile, firstUse: Map<string, string>, fix: string): Finding[] {
  const { location } = file;

  if (location.area !== 'context' || !isErrorFile(file)) {
    return [];
  }

  return codesSetIn(file).flatMap(({ code, line }) => {
    const key = `${location.context} ${code}`;
    const first = firstUse.get(key);

    if (first === undefined) {
      firstUse.set(key, `${file.path}:${line}`);
    }

    return first === undefined
      ? []
      : [{ line, message: `The code "${code}" is already set in ${first}, in the same context.`, fix }];
  });
}
