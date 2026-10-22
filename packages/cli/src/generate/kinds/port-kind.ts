import { emit } from '../emit';
import { isDeclared } from '../is-declared';
import type { Kind } from '../kind';
import { label } from '../label';
import { named } from '../named';
import { openScope } from '../open-scope';
import { vars } from '../vars';

export const portKind: Kind = {
  name: 'port',
  aliases: [],
  usage: 'port <context> <Name>',
  summary: 'A port of the application layer, an abstract class that is also its injection token, and its fake.',
  positionals: ['context', 'Name'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'port', strip: ['port'] });
    const adapter = `\`ddd-ts-kit generate adapter ${scope.context.kebab} ${name.pascal}\``;

    emit(scope, vars(scope, { name: named(name) }), [
      ['port/port.ts.tpl', `application/ports/${name.kebab}.port.ts`],
      ['port/fake.ts.tpl', `test/fakes/${name.kebab}.fake.ts`],
    ]);

    scope.ws.note(
      isDeclared(scope.config)
        ? `${name.pascal} has no adapter yet: ${adapter} writes one that declares itself in infrastructure/external.`
        : `${name.pascal} has no adapter yet: ${adapter} writes one in infrastructure/external and binds it in ${scope.context.kebab}.module.ts.`,
    );
  },
};
