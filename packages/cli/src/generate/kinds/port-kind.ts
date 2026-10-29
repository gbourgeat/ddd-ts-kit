import { emit } from '../emit';
import { toName } from '../../naming';
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
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'port', strip: ['port'] });
    const module = request.flags.module === undefined ? '' : ` --module ${toName(request.flags.module).kebab}`;
    const adapter = `\`ddd-ts-kit generate adapter ${scope.context.kebab} ${name.pascal}${module}\``;

    emit(scope, vars(scope, { name: named(name) }), [
      ['port/port.ts.tpl', `application/ports/${name.kebab}.port.ts`],
      ['port/fake.ts.tpl', `test/fakes/${name.kebab}.fake.ts`],
    ]);

    const simulated =
      'with `--kind simulated`, one that answers in memory, for an environment whose provider is simulated';

    scope.ws.note(
      isDeclared(scope.config)
        ? `${name.pascal} has no adapter yet: ${adapter} writes one that declares itself in infrastructure/external (${simulated}).`
        : `${name.pascal} has no adapter yet: ${adapter} writes one in infrastructure/external and binds it in ${scope.context.kebab}.module.ts (${simulated}).`,
    );
  },
};
