import { CliError } from '../../cli-error.js';
import { renderTemplate } from '../../templating/index.js';
import { applyWiring } from '../apply-wiring.js';
import { declarePermission } from '../declare-permission.js';
import { emit } from '../emit.js';
import { isDeclared } from '../is-declared.js';
import type { Kind } from '../kind.js';
import { label } from '../label.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import { permissionNamed } from '../permission-named.js';
import { vars } from '../vars.js';

export const policyKind: Kind = {
  name: 'policy',
  aliases: [],
  usage: 'policy <context> <Name> --permission <aggregate>.<action>',
  summary:
    'A rule about one element (only the author, not after closing), its spec and its registration with the policies Access asks.',
  positionals: ['context', 'Name'],
  writesShared: true,
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'policy', strip: ['policy'] });
    const { permission } = scope.flags;

    if (permission === undefined) {
      throw new CliError(
        'A policy needs --permission.',
        'A policy refines one permission: pass --permission <aggregate>.<action>, for example --permission invoice.void.',
      );
    }

    declarePermission(scope, permissionNamed(scope, permission), name);

    const context = vars(scope, { name: named(name), access: { permission } });

    emit(scope, context, [
      ['policy/policy.ts.tpl', `application/authorization/${name.kebab}.policy.ts`],
      ['policy/policy.spec.ts.tpl', `test/unit/${name.kebab}.policy.spec.ts`],
    ]);

    // A declared policy is found through its decorator: only a policy written as a value is listed for `Access`.
    if (!isDeclared(scope.config)) {
      applyWiring(
        scope.ws,
        `${scope.config.platformDir}/auth/access-policies.ts`,
        renderTemplate('policy/registration.tpl', context),
      );
    }
  },
};
