import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './helpers.js';

const CLI = 'packages/cli/src/naming';
const ESLINT = 'packages/eslint-plugin/src/support/event-sourcing';

/** The words of the `new Set([...])` declared under this constant in a source file of the repository. */
function wordsOf(file: string, constant: string): string[] {
  const source = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
  const start = source.indexOf(`const ${constant} = new Set([`);
  const list = source.slice(start, source.indexOf(']);', start));

  return [...list.matchAll(/'([a-z]+)'/g)].map(([, word]) => word ?? '').sort();
}

/**
 * The generator and the checker of the CLI, and the ESLint plugin, judge the name of an event
 * with the same words: the CLI has no dependency and the plugin does not depend on the CLI, so
 * each keeps its copy, and this spec holds the copies equal.
 */
describe('the words that judge the name of an event', () => {
  it.each([
    ['the past participles that do not end in -ed', 'IRREGULAR_PAST', 'is-past-word.ts', 'is-past-participle.ts'],
    [
      'the participles that read as a command at the head of a name',
      'READS_AS_COMMAND',
      'is-past-fact.ts',
      'is-past-fact.ts',
    ],
  ])('are the same in the CLI and in the ESLint plugin: %s', (_what, constant, cli, eslint) => {
    const inCli = wordsOf(`${CLI}/${cli}`, constant);

    expect(inCli.length).toBeGreaterThan(10);
    expect(wordsOf(`${ESLINT}/${eslint}`, constant)).toEqual(inCli);
  });
});
