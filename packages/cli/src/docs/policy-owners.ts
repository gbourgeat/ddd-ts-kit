import type { UseCaseFact } from '../describe/context-description';
import { toName } from '../naming';
import { kebabOfUseCase } from './kebab-of-use-case';
import type { UseCasesOfContext } from './use-cases-of-context';

/**
 * The use cases a policy spec states the rules of: the one the policy is named after, then every
 * other one that requires the permission the policy decides, in the order of their names.
 */
export function policyOwners({ useCases, policies }: UseCasesOfContext, subject: string): UseCaseFact[] {
  const policy = policies.find((candidate) => toName(candidate.name).kebab === subject);

  const requiring = useCases.filter(
    (useCase) => policy !== undefined && policy.permission !== '' && useCase.permission === policy.permission,
  );

  const named = useCases.filter((useCase) => kebabOfUseCase(useCase) === subject);

  return [...named, ...requiring.filter((useCase) => !named.includes(useCase))];
}
