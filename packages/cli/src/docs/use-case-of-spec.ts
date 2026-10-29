import type { UseCaseFact } from '../describe/context-description';
import { toName } from '../naming';
import { kebabOfUseCase as kebabOf } from './kebab-of-use-case';
import type { SpecSubject } from './spec-subject';
import type { UseCasesOfContext } from './use-cases-of-context';

/**
 * The use case a spec of the context states the rules of, by its name and its role: the handler of
 * the use case; its policy, named after it or deciding the permission it alone requires; its
 * controller or route, by the use case the route sends; its reader. None for any other spec.
 */
export function useCaseOfSpec(known: UseCasesOfContext, { subject, role }: SpecSubject): UseCaseFact | undefined {
  const named = known.useCases.find((useCase) => kebabOf(useCase) === subject);

  switch (role) {
    case 'handler':
      return named;
    case 'policy':
      return named ?? decidedBy(known, subject);
    case 'controller':
    case 'route':
      return sentBy(known, `${subject}.${role}.ts`) ?? named;
    case 'reader':
      return longest(known.useCases, (useCase) => endsWithWord(subject, kebabOf(useCase)));
    case 'repository':
      return longest(known.useCases, (useCase) => endsWithWord(subject, `${kebabOf(useCase)}-reader`));
    default:
      return undefined;
  }
}

/** The use case that alone requires the permission the policy of that name decides. */
function decidedBy({ useCases, policies }: UseCasesOfContext, subject: string): UseCaseFact | undefined {
  const policy = policies.find((candidate) => toName(candidate.name).kebab === subject);
  const requiring = useCases.filter((useCase) => policy !== undefined && useCase.permission === policy.permission);

  return requiring.length === 1 ? requiring[0] : undefined;
}

/** The use case the routes of a file send, when they all send the same one. */
function sentBy({ useCases, routes }: UseCasesOfContext, file: string): UseCaseFact | undefined {
  const sent = new Set(routes.filter((route) => route.file.endsWith(`/${file}`)).map((route) => route.useCase));
  const [name] = [...sent];

  return sent.size === 1 ? useCases.find((useCase) => useCase.name === name) : undefined;
}

function longest(useCases: readonly UseCaseFact[], fits: (useCase: UseCaseFact) => boolean): UseCaseFact | undefined {
  return useCases.filter(fits).sort((left, right) => kebabOf(right).length - kebabOf(left).length)[0];
}

/** `in-memory-search-invoices` ends with the words `search-invoices`, not with `invoices-search`. */
function endsWithWord(text: string, words: string): boolean {
  return text === words || text.endsWith(`-${words}`);
}
