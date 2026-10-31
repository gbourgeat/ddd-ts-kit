import type { Config } from '../../config';
import { CONTEXT_FILES } from '../../context-files';
import type { Flaw } from '../model/flaw';

/**
 * What `tree/closed` says of a file of a context that 0.86 and 0.87 wrote in a role folder, the code list
 * (`domain/errors/codes.ts`) or the permission set (`application/authorization/<context>.permissions.ts`),
 * now at the root of the context; undefined for any other entry. `entries` are every entry of the
 * contexts, to tell whether the root holds the file already.
 */
export function earlierContextFile(entry: string, config: Config, entries: ReadonlySet<string>): Flaw | undefined {
  const [context = '', ...rest] = entry.slice(config.contextsDir.length + 1).split('/');
  const relative = rest.join('/');
  const file = CONTEXT_FILES.find((candidate) => candidate.earlier(context) === relative);

  if (file === undefined || !entry.startsWith(`${config.contextsDir}/`)) {
    return undefined;
  }

  const root = file.root(context);

  if (entries.has(`${config.contextsDir}/${context}/${root}`)) {
    return {
      message: `"${context}" holds ${relative} next to ${root}: one context has one of each.`,
      fix: `Keep ${root}, move into it what ${relative} holds that it lacks, and delete ${relative}.`,
    };
  }

  return {
    message: `${relative} of "${context}" is where 0.86 and 0.87 kept it: it lives at the root of the context now, ${root}.`,
    fix: 'Run `npx ddd-ts-kit context-layout`, which moves it to the root of its context and rewrites every import of it, then commit the result.',
  };
}
