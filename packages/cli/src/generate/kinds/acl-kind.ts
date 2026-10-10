import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { label } from '../label.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import { vars } from '../vars.js';

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
    const relationship = scope.config.contexts[scope.context.kebab]?.upstreams.find((candidate) => candidate.context === name.kebab)?.relationship;

    emit(scope, vars(scope, { name: named(name) }), [
      ['acl/translator.ts.tpl', `infrastructure/anti-corruption/${name.kebab}.translator.ts`],
      ['acl/translator.spec.ts.tpl', `test/unit/${name.kebab}.translator.spec.ts`],
    ]);

    if (scope.config.contexts[name.kebab] !== undefined && relationship !== 'anti-corruption-layer') {
      scope.ws.note(`"${name.kebab}" is a context of this project: declare it in contexts.${scope.context.kebab}.upstreams with the relationship "anti-corruption-layer".`);
    }
  },
};
