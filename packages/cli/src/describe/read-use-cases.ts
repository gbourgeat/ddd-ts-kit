import { toName } from '../naming';
import type { UseCaseFact } from './context-description';
import type { ContextSources } from './context-sources';
import { roleDirectoriesOf } from '../model-modules';

const FOLDERS = [
  ['command', 'commands', 'Command'],
  ['query', 'queries', 'Query'],
] as const;

/** The commands and the queries of a context, one per folder, each with the permission its declaration or its binding names. */
export function readUseCases(sources: ContextSources): UseCaseFact[] {
  const { ws } = sources;

  return FOLDERS.flatMap(([kind, folder, suffix]) =>
    roleDirectoriesOf(ws, sources, `application/${folder}`).map((useCase) => {
      const name = toName(useCase.name).pascal;

      const declared = sources.declarations?.useCases.find(
        (candidate) => candidate.kind === kind && candidate.name === name,
      );

      return {
        kind,
        name,
        permission: declared?.requires ?? boundPermission(sources.module, `${name}${suffix}`),
        file: useCase.path,
      };
    }),
  ).sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * What a module file says of a message: `builder.command(M).requires(p)` or `.public()`,
 * `requires(M, p)` or `publicUseCase(M)`, whatever the number of lines the statement takes.
 */
function boundPermission(module: string, message: string): string {
  if (new RegExp(String.raw`\(\s*${message}\s*\)\s*\.public\(\)|\bpublicUseCase\(\s*${message}\s*\)`).test(module)) {
    return 'public';
  }

  const required = new RegExp(
    String.raw`\(\s*${message}\s*\)\s*\.requires\(\s*([^\n]*?)\s*(?:\)\s*\.|,\s*\{?\s*\n)|\brequires\(\s*${message}\s*,\s*([^\n]*?)\s*(?:\)|,\s*\{|,)\s*,?\s*\n`,
  ).exec(module);

  const written = (required?.[1] ?? required?.[2] ?? '').trim();

  return /\['([^']+)'\]/.exec(written)?.[1] ?? written;
}
