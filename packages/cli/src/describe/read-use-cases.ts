import { toName } from '../naming/index.js';
import type { UseCaseFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';

const FOLDERS = [
  ['command', 'commands', 'Command'],
  ['query', 'queries', 'Query'],
] as const;

/** The commands and the queries of a context, one per folder, each with the permission its declaration or its binding names. */
export function readUseCases(sources: ContextSources): UseCaseFact[] {
  const { ws, directory } = sources;

  return FOLDERS.flatMap(([kind, folder, suffix]) =>
    ws.directories(`${directory}/application/${folder}`).map((useCase) => {
      const name = toName(useCase).pascal;

      const declared = sources.declarations?.useCases.find(
        (candidate) => candidate.kind === kind && candidate.name === name,
      );

      return {
        kind,
        name,
        permission: declared?.requires ?? boundPermission(sources.module, `${name}${suffix}`),
        file: `${directory}/application/${folder}/${useCase}`,
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
