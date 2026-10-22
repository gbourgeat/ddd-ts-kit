import fs from 'node:fs';
import path from 'node:path';
import type { TSESLint } from '@typescript-eslint/utils';
import type { Project } from '../../project/linted-file';
import { locate } from '../../project/locate';
import { parseSource } from '../parse/parse-source';
import type { DeclaredValue } from './declared-value';
import { valuesDeclaredIn } from './values-declared-in';

/** How long a reading of the project is reused: a lint run reads it once, an editor sees a new value within seconds. */
const FRESH_FOR_MS = 5000;
const SKIPPED = new Set(['node_modules', 'dist', 'generated', 'test']);
const DECLARING = /as\s+const|definePermissions\(/;

type Parser = TSESLint.FlatConfig.Parser;

interface Reading {
  readonly at: number;
  readonly values: ReadonlyMap<string, readonly DeclaredValue[]>;
}

const readings = new Map<string, Reading>();

/**
 * The closed vocabularies the sources of the project declare, by value: the source root read on
 * disk and parsed with the parser of the run, tests left out; a value two vocabularies share is
 * listed under both. Without a parser, or for a file it cannot parse, nothing is declared.
 */
export function projectVocabularies(
  project: Project,
  parser: Parser | undefined,
  now = Date.now(),
): ReadonlyMap<string, readonly DeclaredValue[]> {
  const key = path.join(project.root, project.config.sourceRoot);
  const known = readings.get(key);

  if (known !== undefined && now >= known.at && now - known.at < FRESH_FOR_MS) {
    return known.values;
  }

  const values = new Map<string, DeclaredValue[]>();

  for (const [value, declared] of sourcesUnder(key).flatMap((file) => declaredIn(project, file, parser))) {
    values.set(value, [...(values.get(value) ?? []), declared]);
  }

  readings.set(key, { at: now, values });

  return values;
}

function declaredIn(project: Project, file: string, parser: Parser | undefined): [string, DeclaredValue][] {
  const text = fs.readFileSync(file, 'utf8');
  const program = DECLARING.test(text) && parser !== undefined ? parseSource(text, file, parser) : undefined;
  const relative = path.relative(project.root, file).split(path.sep).join('/');

  return program === undefined
    ? []
    : valuesDeclaredIn({ path: relative, location: locate(project.config, relative) }, program);
}

function sourcesUnder(directory: string): string[] {
  const entries = fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }) : [];

  return entries.flatMap((entry) => {
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return SKIPPED.has(entry.name) ? [] : sourcesUnder(full);
    }

    return /\.ts$/.test(entry.name) && !/\.(?:spec|test|d)\.ts$/.test(entry.name) ? [full] : [];
  });
}
