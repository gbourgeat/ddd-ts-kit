import { concept } from '../concept';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { named } from '../named';
import { openScope } from '../open-scope';
import { vars } from '../vars';

export const valueObjectKind: Kind = {
  name: 'value-object',
  aliases: ['vo'],
  usage: 'value-object <context|shared-kernel> <Name> [--term "<Term>=<meaning>"]...',
  summary:
    'An immutable value object validated in create, and its spec: in domain/value-objects/ of a context, or at the root of the shared kernel, beside its spec, when at least two contexts use it.',
  positionals: ['context', 'Name'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request, { sharedKernel: true });

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'value object', strip: ['vo'] });

    emit(scope, vars(scope, { name: named(name) }), [
      ['value-object/value-object.ts.tpl', `domain/value-objects/${name.kebab}.vo.ts`],
      ['value-object/value-object.spec.ts.tpl', `test/unit/${name.kebab}.vo.spec.ts`],
    ]);
  },
};
