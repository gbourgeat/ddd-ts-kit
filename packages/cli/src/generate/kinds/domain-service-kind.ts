import { concept } from '../concept';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { named } from '../named';
import { openScope } from '../open-scope';
import { vars } from '../vars';

export const domainServiceKind: Kind = {
  name: 'domain-service',
  aliases: [],
  usage: 'domain-service <context> <Name> [--term "<Term>=<meaning>"]...',
  summary: 'A stateless domain service, and its spec.',
  positionals: ['context', 'Name'],
  writesShared: false,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'domain service', strip: ['service'] });

    emit(scope, vars(scope, { name: named(name) }), [
      ['domain-service/domain-service.ts.tpl', `domain/services/${name.kebab}.service.ts`],
      ['domain-service/domain-service.spec.ts.tpl', `test/unit/${name.kebab}.service.spec.ts`],
    ]);
  },
};
