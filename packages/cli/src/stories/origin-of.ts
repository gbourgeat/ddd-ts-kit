import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';

const INTENTS_DIR = 'docs/architecture/intents';
const INCIDENTS_DIR = 'docs/architecture/incidents';

/** `Status: accepted` in the header of an intent: the product owner's acceptance, set in a pull request (a comment of the template says it too, and is not read). */
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

  const header = withoutComments(fs.readFileSync(absolute, 'utf8').split(/^##\s/m)[0] ?? '');

  if (!ACCEPTED.test(header)) {
    throw new CliError(
      `${relative} is not an accepted intent.`,
      'The product owner accepts an intent by setting `Status: accepted` in its header, in a pull request; a story starts from an accepted intent, or from an incident record.',
    );
  }

  return relative;
}

/** The text with its HTML comments taken out, one pass after another until none is left, and an unclosed one to the end. */
function withoutComments(text: string): string {
  let current = text;
  let previous = '';

  while (current !== previous) {
    previous = current;
    current = current.replace(/<!--[\s\S]*?-->/g, '');
  }

  const unclosed = current.indexOf('<!--');

  return unclosed === -1 ? current : current.slice(0, unclosed);
}
