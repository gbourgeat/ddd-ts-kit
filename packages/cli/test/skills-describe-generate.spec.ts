import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, REPO_ROOT, tempDir } from './helpers';
import { initProject } from './support/init-project';

/** Every page of the skills and the agents of the plugin, by its path from the root of the repository. */
function pluginPages(): string[] {
  return ['plugin/skills', 'plugin/agents'].flatMap((directory) =>
    fs
      .readdirSync(path.join(REPO_ROOT, directory), { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.md'))
      .map((file) => path.posix.join(directory, file.split(path.sep).join('/'))),
  );
}

const read = (page: string): string => fs.readFileSync(path.join(REPO_ROOT, page), 'utf8');

describe('the skills, on what generate prints', () => {
  it('send the agent to the todos places, never to a next list the CLI no longer prints', () => {
    const pages = pluginPages();
    const naming = pages.filter((page) => /`next` (?:places|list)|lists `next`|, next, todos/.test(read(page)));

    expect(pages.length).toBeGreaterThan(30);
    expect(naming).toEqual([]);
  });

  it('give the output of every kind with the keys generate --json prints', () => {
    const root = initProject('--context', 'billing:core');
    const printed = cli(root, 'generate', 'value-object', 'billing', 'Money', '--term', 'Money=An amount', '--json');
    const keys = Object.keys(printed.json() as object).join(', ');

    expect(read('plugin/skills/scaffold/kinds.md')).toContain(`Output of every kind: \`{ ${keys} }\``);
  });

  it('look up the arguments of one kind with generate <kind> --help, not the whole reference', () => {
    expect(cli(tempDir('kind-help-skill'), 'generate', 'aggregate', '--help').stdout).toContain('Usage');

    for (const page of ['plugin/skills/scaffold/SKILL.md', 'plugin/skills/scaffold/kinds.md']) {
      expect(read(page), page).toContain('`npx ddd-ts-kit generate <kind> --help`');
      expect(read(page), page).not.toMatch(/`npx ddd-ts-kit --help`/);
    }
  });
});
