import { CliError } from '../../cli-error';
import type { FoundDeclaration } from './declarations-of';

/**
 * A version that was asked for and cannot be built on is refused, never replaced by another one:
 * the upstream publishes others, or declares this one without an exported event type.
 */
export function refuseUnpublishedVersion(found: readonly FoundDeclaration[], type: string, version: number): void {
  const published = [...new Set(found.map((candidate) => candidate.version))].sort((left, right) => left - right);

  if (published.includes(version)) {
    throw new CliError(
      `${type}@v${version} is declared without an exported event type to import.`,
      `Write \`export type <Name> = IntegrationEvent<...>\` beside its definition in the published language, then run the command again.`,
    );
  }

  if (published.length > 0) {
    throw new CliError(
      `${type} is published at ${published.map((each) => `v${each}`).join(', ')} only.`,
      `Pass one of ${published.map((each) => `${type}@v${each}`).join(', ')}, or the bare type for the newest.`,
    );
  }
}
