import { isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
import { Policy } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions.js';

// TODO(domain): give `allows` the aggregate "{{name.words}}" reads as its second parameter, add `appliesTo(subject: unknown): boolean { return subject instanceof <Aggregate>; }`, and decide from the actor, the loaded element and `now`; the handler asks it through `Access.authorize(command.actor, permission, element)`.
@Policy({{context.camel}}Permissions['{{access.permission}}'], { name: '{{context.kebab}}.{{name.kebab}}' })
export class {{name.pascal}}Policy {
  allows(actor: Actor): boolean {
    return isAuthenticated(actor);
  }
}
