import { describe, expect, it } from 'vitest';
import { COMMON_FLAGS } from '../src/generate/generate-options';
import { findKind } from '../src/generate/find-kind';
import { KINDS } from '../src/generate/kinds';
import { commandHelp } from '../src/help/command-help';
import { NOTES } from '../src/help/notes';
import { referenceText } from '../src/help/reference-text';
import { USAGE } from '../src/help/usage';
import { cli, tempDir } from './helpers';
import { jsonAt } from './support/json-at';

/** Every command the usage names, once. */
const COMMANDS = [...new Set([...USAGE.matchAll(/^ {2}ddd-ts-kit ([a-z-]+)/gm)].map((match) => match[1] ?? ''))];

describe('<command> --help', () => {
  it('prints the usage and the note of that command alone', () => {
    const help = cli(tempDir('help-describe'), 'describe', '--help').stdout;

    expect(help).toBe(
      [
        'Usage',
        '  ddd-ts-kit describe <context>',
        '',
        '  describe         one context as facts: use cases, routes, events, ports, policies, gateways, dependencies',
        '',
        'Every command accepts --json (machine-readable output, on one line) and --cwd <dir> (project root).',
      ].join('\n'),
    );
  });

  it('prints every usage line of the command and the notes of the flags they name', () => {
    const help = cli(tempDir('help-check'), 'check', '--help').stdout;

    expect(help).toContain('  ddd-ts-kit check --baseline write|prune');
    expect(help).toContain('  ddd-ts-kit check --commit-size [--staged] [--strict]');
    expect(help).toContain('  --explain        check follows the violations');
    expect(help).toContain('  --commit-size    the files and lines about to be committed');
    expect(help).not.toContain('ddd-ts-kit check-file');
    expect(help).not.toContain('ddd-ts-kit describe');
  });

  it('prints the notes of the flags that open with the command, and its kinds under generate', () => {
    const help = cli(tempDir('help-generate'), 'g', '--help').stdout;

    expect(help).toContain('  --module         generate writes the files of the layers');
    expect(help).toContain('  --local-only     generate refuses');
    expect(help).toContain(`Kinds\n  context `);
    expect(help).toContain('  value-object <context|shared-kernel> <Name>');
    expect(help).not.toContain('ddd-ts-kit init');
  });

  it('prints, over all the commands, every note of the reference', () => {
    const helps = COMMANDS.map((command) => commandHelp(command) ?? '').join('\n');

    expect(COMMANDS).toEqual(expect.arrayContaining(['init', 'generate', 'check', 'worker-scope', 'explain']));
    const lines = referenceText().split('\n\nKinds')[0]?.split('\n\n').at(-1)?.split('\n') ?? [];

    expect(lines.length).toBeGreaterThan(300);
    expect(lines.filter((line) => !helps.includes(line))).toEqual([]);
  });

  it('prints for each command exactly the notes that name it as theirs', () => {
    for (const command of COMMANDS) {
      const [, second = ''] = (commandHelp(command) ?? '').split('\n\n');

      const printed = second.startsWith('  ')
        ? second.split('\n').flatMap((line) => /^ {2}(\S+)/.exec(line)?.[1] ?? [])
        : [];

      expect(printed, command).toEqual(NOTES.filter((note) => note.command === command).map((note) => note.name));
    }
  });

  it('gives the help of a command as data under --json, on one line', () => {
    const root = tempDir('help-json');
    const describeHelp = cli(root, 'describe', '--help', '--json').stdout;

    expect(describeHelp.split('\n')).toHaveLength(1);

    expect(JSON.parse(describeHelp)).toEqual({
      command: 'describe',
      usage: ['ddd-ts-kit describe <context>'],
      notes: [{ name: 'describe', text: expect.stringMatching(/^one context as facts: use cases, routes/) }],
    });

    expect(cli(root, 'check', '--help', '--json').json()).toEqual({
      command: 'check',
      usage: expect.arrayContaining(['ddd-ts-kit check --baseline write|prune']),
      notes: [
        { name: '--commit-size', text: expect.stringContaining('600 lines by default, generated files not counted') },
        { name: '--explain', text: expect.stringContaining('check follows the violations') },
      ],
    });
  });

  it('answers help <command> as <command> --help', () => {
    const root = tempDir('help-command');

    expect(cli(root, 'help', 'worker-scope').stdout).toBe(cli(root, 'worker-scope', '--help').stdout);
    expect(cli(root, 'worker-scope', '--help').stdout).toContain('  --resume         worker-scope reads');
  });

  it.each([['--help'], ['help'], ['nothing-of-the-kind', '--help']])('keeps the whole reference for %s', (...argv) => {
    expect(cli(tempDir('help-whole'), ...argv).stdout).toContain(referenceText());
  });
});

describe('generate <kind> --help', () => {
  it('prints that kind alone: its usage, its summary, what it writes outside its context and --module', () => {
    const help = cli(tempDir('help-kind'), 'generate', 'vo', '--help').stdout;

    expect(help.split('\n').slice(0, 2)).toEqual([
      'Usage',
      '  ddd-ts-kit generate value-object <context|shared-kernel> <Name> [--term "<Term>=<meaning>"]... [--module <module>]   (alias: vo)',
    ]);

    expect(help).toContain(`\n\n${findKind('vo')?.summary ?? 'a summary'}\n`);
    expect(help).toContain('Writes outside its context: <sharedKernelDir>/<name>.vo.ts and its spec;');
    expect(help).toContain('Only when the first argument is shared-kernel');
    expect(help).toContain('Takes [--module <module>]');
    expect(help).toContain(`Every kind also takes ${COMMON_FLAGS.map((flag) => `[--${flag}]`).join(' ')}`);
    expect(help).not.toContain('aggregate <context> <Name>');
  });

  it('reads the kind past the value of a flag placed before it', () => {
    const help = cli(tempDir('help-kind-after-flag'), 'generate', '--module', 'pricing', 'aggregate', '--help').stdout;

    expect(help.split('\n')[1]).toMatch(/^ {2}ddd-ts-kit generate aggregate <context> <Name>/);
  });

  it('says when a kind writes inside its context only and refuses --module', () => {
    const help = cli(tempDir('help-kind-inside'), 'generate', 'test-world', '--help').stdout;

    expect(help).toContain('Writes inside its context only.');
    expect(help).toContain('Refuses --module');
  });

  it('answers that kind as one object under --json, the entry generate --help --json lists for it', () => {
    const root = tempDir('help-kind-json');
    const kinds = jsonAt(cli(root, 'generate', '--help', '--json').json(), 'kinds');

    const kind = cli(root, 'generate', 'value-object', '--help', '--json').json();

    expect(kinds).toHaveLength(KINDS.length);
    expect(kinds).toContainEqual(kind);
    expect(kind).toEqual(expect.objectContaining({ name: 'value-object', writesInModules: true }));
  });
});

describe('a refused option', () => {
  it('is answered with the usage line of its command', () => {
    const refused = cli(tempDir('refused-option'), 'describe', 'billing', '--modul');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain("error: Unknown option '--modul'.");
    expect(refused.stderr).toContain('  fix: ddd-ts-kit describe <context>');
  });

  it('is answered with every usage line of a command that has several, aligned under the first', () => {
    const refused = cli(tempDir('refused-option-lines'), 'check', '--baselin');

    expect(refused.stderr).toContain('  fix: ddd-ts-kit check [paths...]');
    expect(refused.stderr).toContain('\n       ddd-ts-kit check --baseline write|prune');
  });

  it('is answered with the usage line of the kind under g, the kind read past the value of a flag', () => {
    const refused = cli(
      tempDir('refused-alias-option'),
      'g',
      '--module',
      'pricing',
      'vo',
      'billing',
      'Money',
      '--modul',
    );

    expect(refused.stderr).toContain('  fix: ddd-ts-kit generate value-object <context|shared-kernel> <Name>');
  });

  it('names the alias g among the commands when the command is unknown', () => {
    expect(cli(tempDir('unknown-command'), 'nothing-of-the-kind').stderr).toMatch(
      /fix: Use one of: affected, init, generate, .*explain\. g is generate\./,
    );
  });

  it('is answered with the usage line of the kind under generate, in JSON too', () => {
    const refused = cli(tempDir('refused-kind-option'), 'generate', 'vo', 'billing', 'Money', '--modul', '--json');

    expect(jsonAt(refused.json(), 'error')).toEqual({
      message: expect.stringContaining("Unknown option '--modul'."),
      fix: 'ddd-ts-kit generate value-object <context|shared-kernel> <Name> [--term "<Term>=<meaning>"]... [--module <module>]',
    });
  });
});
