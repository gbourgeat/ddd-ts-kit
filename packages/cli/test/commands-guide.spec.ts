import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { commandsGuideRegion } from '../src/help/commands-guide-region.js';
import { referenceText } from '../src/help/reference-text.js';
import { cli, REPO_ROOT } from './helpers.js';

/** The English page, and its French page once written: the reference is the help of the CLI, in English on both. */
const GUIDES = ['docs/guides/commands.md', 'docs/guides/commands.fr.md']
  .map((guide) => path.join(REPO_ROOT, guide))
  .filter((guide, index) => index === 0 || fs.existsSync(guide));

const SOURCES = ['packages/cli/src/commands', 'packages/cli/src/check/commands'];

/** The options a command declares to its parser: `name: { type: ... }`, `name: TEXT`, and the flag lists of `init`. */
function declaredOptions(): string[] {
  const texts = SOURCES.flatMap((directory) =>
    fs
      .readdirSync(path.join(REPO_ROOT, directory))
      .map((file) => fs.readFileSync(path.join(REPO_ROOT, directory, file), 'utf8')),
  );

  const options = texts.flatMap((text) => [
    ...[...text.matchAll(/^\s+'?([a-z][a-z-]*)'?: (?:\{ type: '(?:string|boolean)'|TEXTS?\b|SWITCH\b)/gm)].map(
      (match) => match[1],
    ),
    ...[...text.matchAll(/const (?:STACK_FLAGS|OTHER_TEXT_FLAGS) = \[([\s\S]*?)\]/g)].flatMap((match) =>
      [...(match[1] ?? '').matchAll(/'([a-z-]+)'/g)].map((name) => name[1]),
    ),
  ]);

  return [...new Set(options.filter((option) => option !== undefined))];
}

describe('docs/guides/commands.md', () => {
  it.each(GUIDES)('%s holds, between its markers, the reference the help of the CLI prints', (guide) => {
    const page = fs.readFileSync(guide, 'utf8');

    const written = page.slice(
      page.indexOf('<!-- ddd-ts-kit:commands -->'),
      page.indexOf('<!-- /ddd-ts-kit:commands -->'),
    );

    expect(written, 'stale: `npm run build && node pipeline/monorepo/commands-guide.mjs`').toBe(
      `<!-- ddd-ts-kit:commands -->\n${commandsGuideRegion().join('\n')}\n`,
    );
  });

  it('is the help of the CLI, which names every command and every flag a command accepts', () => {
    const help = cli(REPO_ROOT, '--help').stdout;
    const options = declaredOptions();

    expect(help).toContain(referenceText());
    expect(options).toEqual(expect.arrayContaining(['ci-extras', 'term', 'changed-since', 'commit-size', 'worktree']));
    expect(options.filter((option) => !referenceText().includes(`--${option}`))).toEqual([]);

    for (const command of ['init', 'generate', 'list', 'describe', 'status', 'todo', 'docs', 'check', 'explain']) {
      expect(referenceText()).toContain(`ddd-ts-kit ${command}`);
    }
  });
});
