import { emit } from '../emit';
import type { Kind } from '../kind';
import { label } from '../label';
import { named } from '../named';
import { openScope } from '../open-scope';
import { vars } from '../vars';

export const aclKind: Kind = {
  name: 'acl',
  aliases: [],
  usage: 'acl <context> <upstreamOrSystemName>',
  summary: 'An anti-corruption translator for the model of another context or system, and its spec.',
  positionals: ['context', 'upstreamOrSystemName'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'upstream', strip: ['translator'] });

    const relationship = scope.config.contexts[scope.context.kebab]?.upstreams.find(
      (candidate) => candidate.context === name.kebab,
    )?.relationship;

    emit(scope, vars(scope, { name: named(name) }), [
      ['acl/translator.ts.tpl', `infrastructure/anti-corruption/${name.kebab}.translator.ts`],
      ['acl/translator.spec.ts.tpl', `test/integration/${name.kebab}.translator.spec.ts`],
    ]);

    if (scope.config.contexts[name.kebab] !== undefined && relationship !== 'anti-corruption-layer') {
      scope.ws.note(
        `"${name.kebab}" is a context of this project: declare it in contexts.${scope.context.kebab}.upstreams with the relationship "anti-corruption-layer".`,
      );
    }
  },
};
