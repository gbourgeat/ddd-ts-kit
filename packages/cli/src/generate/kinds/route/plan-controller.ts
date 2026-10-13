import type { Scope } from '../../scope.js';
import { cachePolicyText } from './cache-policy-text.js';
import type { ControllerPlan } from './controller-plan.js';
import { resolveGroup } from './resolve-group.js';
import { resourceOf } from './resource-of.js';
import type { RouteParts } from './route-vars.js';

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
