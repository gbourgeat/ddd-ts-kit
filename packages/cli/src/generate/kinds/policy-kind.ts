import { CliError } from '../../cli-error';
import { toName } from '../../naming';
import { renderTemplate } from '../../templating';
import { applyWiring } from '../apply-wiring';
import { declarePermission } from '../declare-permission';
import { emit } from '../emit';
import { isDeclared } from '../is-declared';
import type { Kind } from '../kind';
import { label } from '../label';
import { learnTerms } from '../learn-terms';
import { markPolicyQuestions } from '../mark-policy-questions';
import { named } from '../named';
import { openScope } from '../open-scope';
import { permissionNamed } from '../permission-named';
import { vars } from '../vars';
import { platformPath } from '../platform-path';

export const policyKind: Kind = {
  name: 'policy',
  aliases: [],
  usage: 'policy <context> <Name> --permission <aggregate>.<action> [--term "<Term>=<meaning>"]...',
  summary:
    'A rule about one element (only the author, not after closing), its spec and its registration with the policies Access asks.',
  positionals: ['context', 'Name'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = label(scope, request.args[1] ?? '', { what: 'policy', strip: ['policy'] });
    const { permission } = scope.flags;

    if (permission === undefined) {
      throw new CliError(
        'A policy needs --permission.',
        'A policy refines one permission: pass --permission <aggregate>.<action>, for example --permission invoice.void.',
      );
    }

    declarePermission(scope, permissionNamed(scope, permission), name);

    const context = vars(scope, { name: named(name), access: { permission, question: questionOf(permission) } });

    emit(scope, context, [
      ['policy/policy.ts.tpl', `application/authorization/${name.kebab}.policy.ts`],
      ['policy/policy.spec.ts.tpl', `test/unit/${name.kebab}.policy.spec.ts`],
    ]);

    markPolicyQuestions(scope, permission);

    // A declared policy is found through its decorator: only a policy written as a value is listed for `Access`.
    if (!isDeclared(scope.config)) {
      applyWiring(
        scope.ws,
        platformPath(scope, 'auth/authorization/access-policies.ts'),
        renderTemplate('policy/registration.tpl', context),
      );
    }
  },
};

/**
 * The question a policy answers, the title of its spec: the last segment of the permission is its
 * action, the ones before it its element. `invoice.cancel` asks "Who may cancel an invoice",
 * `invoice.line.add` "Who may add an invoice line".
 */
function questionOf(permission: string): string {
  const segments = permission.split('.');
  const element = toName(segments.slice(0, -1).join('-'));

  return `Who may ${toName(segments.at(-1) ?? '').words} ${element.article} ${element.words}`;
}
