import fs from 'node:fs';
import path from 'node:path';
import { findRoot } from '../commands/find-root';
import { CONFIG_FILE } from '../config';
import { inDialect } from './in-dialect';
import { packageManagerOf } from './package-manager-of';

/**
 * A sentence written for npm, as the package manager of a project says it: the project is the one
 * holding the config, upward from `start`. The one place a refusal or a note takes the manager into
 * a sentence. The config is read on a best effort; with none, or one that names no manager, the
 * text stays npm's.
 */
export function inProjectDialect(text: string, start: string): string {
  try {
    const config = fs.readFileSync(path.join(findRoot(path.resolve(start)), CONFIG_FILE), 'utf8');

    return inDialect(text, packageManagerOf(config));
  } catch {
    return text;
  }
}
