import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../check/support/is-record.js';
import type { ProjectFormatter } from './project-formatter.js';

interface KnownFormatter {
  readonly name: ProjectFormatter['name'];
  /** How the `format` script calls it. */
  readonly called: RegExp;
  readonly packageName: string;
  readonly command: string;
  readonly args: readonly string[];
}

const KNOWN: readonly KnownFormatter[] = [
  {
    name: 'Biome',
    called: /\bbiome\b/,
    packageName: '@biomejs/biome',
    command: 'biome',
    args: ['format', '--write', '--no-errors-on-unmatched'],
  },
  { name: 'Prettier', called: /\bprettier\b/, packageName: 'prettier', command: 'prettier', args: ['--write'] },
];

/**
 * The formatter the `format` script of the project's package.json runs, Biome or Prettier, found
 * in its node_modules; otherwise why nothing will be formatted. The script itself is not run: it
 * formats the whole project (`biome format --write .`), where only what drizzle-kit wrote is meant.
 */
export function findProjectFormatter(root: string): ProjectFormatter | string {
  const script = formatScript(root);
  const known = script === undefined ? undefined : KNOWN.find((formatter) => formatter.called.test(script));

  if (known === undefined) {
    return 'package.json has no `format` script that runs Biome or Prettier';
  }

  const bin = binOf(path.join(root, 'node_modules', known.packageName), known.command);

  return bin === undefined
    ? `the format script runs ${known.name}, which is not installed (run \`npm install\`)`
    : { name: known.name, bin, args: known.args };
}

function formatScript(root: string): string | undefined {
  const manifest = parsedFile(path.join(root, 'package.json'));
  const scripts = isRecord(manifest) ? manifest['scripts'] : undefined;
  const format = isRecord(scripts) ? scripts['format'] : undefined;

  return typeof format === 'string' ? format : undefined;
}

/** The file its package.json declares for the command, as npm links it into node_modules/.bin. */
function binOf(directory: string, command: string): string | undefined {
  const manifest = parsedFile(path.join(directory, 'package.json'));
  const bin = isRecord(manifest) ? manifest['bin'] : undefined;
  const declared = isRecord(bin) ? bin[command] : bin;
  const file = typeof declared === 'string' ? path.join(directory, declared) : undefined;

  return file !== undefined && fs.existsSync(file) ? file : undefined;
}

function parsedFile(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}
