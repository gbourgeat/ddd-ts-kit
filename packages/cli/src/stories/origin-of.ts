import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';

const INTENTS_DIR = 'docs/architecture/intents';
const INCIDENTS_DIR = 'docs/architecture/incidents';

/** `Status: accepted` in the header of an intent: the product owner's acceptance, set in a pull request. */
const ACCEPTED = /\bStatus:\s*accepted\b/i;

/**
 * The origin a story is seeded from, as `story-scope --from` records it: an intent of
 * `docs/architecture/intents/`, refused unless its header (before its first section) says
 * `Status: accepted`, or an incident record of `docs/architecture/incidents/`, accepted as it is.
 * Returned relative to the project root, with forward slashes.
 */
export function originOf(root: string, from: string): string {
  const absolute = path.resolve(root, from);
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  const expected = `an intent (${INTENTS_DIR}/<slug>.md, accepted) or an incident record (${INCIDENTS_DIR}/<id>.md)`;

  if (!fs.existsSync(absolute)) {
    throw new CliError(`${from} does not exist.`, `Pass ${expected} of the project, relative to its root.`);
  }

  if (relative.startsWith(`${INCIDENTS_DIR}/`)) {
    return relative;
  }

  if (!relative.startsWith(`${INTENTS_DIR}/`)) {
    throw new CliError(`${relative} is neither an intent nor an incident record.`, `Pass ${expected}.`);
  }

  if (!ACCEPTED.test(fs.readFileSync(absolute, 'utf8').split(/^##\s/m)[0] ?? '')) {
    throw new CliError(
      `${relative} is not an accepted intent.`,
      'The product owner accepts an intent by setting `Status: accepted` in its header, in a pull request; a story starts from an accepted intent, or from an incident record.',
    );
  }

  return relative;
}
