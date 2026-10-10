import { concept } from '../concept.js';
import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import { vars } from '../vars.js';

export const valueObjectKind: Kind = {
  name: 'value-object',
  aliases: ['vo'],
  usage: 'value-object <context> <Name> [--term "<Term>=<meaning>"]...',
  summary: 'An immutable value object validated in create, and its spec.',
  positionals: ['context', 'Name'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'value object', strip: ['vo'] });

    emit(scope, vars(scope, { name: named(name) }), [
      ['value-object/value-object.ts.tpl', `domain/value-objects/${name.kebab}.vo.ts`],
      ['value-object/value-object.spec.ts.tpl', `test/unit/${name.kebab}.vo.spec.ts`],
    ]);
  },
};
