import { CONTEXT_TENANCIES, isOneOf, type ContextConfig } from '../../config';
import { lineOfSequence } from '../support/line-of-sequence';

interface TenancyProblem {
  readonly line: number;
  readonly message: string;
  readonly fix: string;
}

/** `contexts.<name>.tenancy` names a place of the context against the tenancy the kit knows, or is absent. */
export function contextTenancy(name: string, { tenancy }: ContextConfig, configText: string): TenancyProblem[] {
  if (tenancy === undefined || isOneOf(CONTEXT_TENANCIES, tenancy)) {
    return [];
  }

  return [
    {
      line: lineOfSequence(configText, ['"contexts"', `"${name}":`, '"tenancy"']),
      message: `The context "${name}" has the tenancy "${tenancy}".`,
      fix: `Set contexts.${name}.tenancy to ${CONTEXT_TENANCIES.join(', ')} (the context decides who belongs to which tenant, its tables belong to none), or remove it: the context then holds tenant data as the project does.`,
    },
  ];
}
