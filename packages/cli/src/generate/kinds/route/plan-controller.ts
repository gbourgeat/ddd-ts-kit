import type { Scope } from '../../scope';
import { cachePolicyText } from './cache-policy-text';
import type { ControllerPlan } from './controller-plan';
import { resolveGroup } from './resolve-group';
import { resourceOf } from './resource-of';
import type { RouteParts } from './route-vars';

/** Decides where a controller goes and what it stands with, from its route and the flags. */
export function planController(scope: Scope, parts: RouteParts): ControllerPlan {
  const { name, endpoint, useCase } = parts;
  const group = resolveGroup(scope, endpoint, useCase);
  const resource = group?.name.kebab ?? resourceOf(scope, endpoint);

  const plan: ControllerPlan = {
    ...parts,
    group,
    folder: `presentation/http/${resource}/${name.kebab}`,
    withMapper: scope.flags.mapper && !useCase.isSearch,
    withSerializer: scope.flags.serializer && useCase.isQuery && !useCase.isSearch,
  };

  const cache = cachePolicyText(scope.flags.cache, plan);

  return cache === undefined ? plan : { ...plan, cache };
}
