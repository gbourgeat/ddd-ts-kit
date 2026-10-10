import { concept } from '../concept.js';
import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import { vars } from '../vars.js';

export const entityKind: Kind = {
  name: 'entity',
  aliases: [],
  usage: 'entity <context> <Name> [--term "<Term>=<meaning>"]...',
  summary: 'An entity living inside an aggregate, and its spec.',
  positionals: ['context', 'Name'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'entity', strip: ['entity'] });

    emit(scope, vars(scope, { name: named(name) }), [
      ['entity/entity.ts.tpl', `domain/entities/${name.kebab}.entity.ts`],
      ['entity/entity.spec.ts.tpl', `test/unit/${name.kebab}.entity.spec.ts`],
    ]);
  },
};
