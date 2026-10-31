import fs from 'node:fs';
import path from 'node:path';
import { git } from './git';

/** A repository with the pre-commit hook `hooks:install` leaves in a clone, without running lefthook. */
export function installHooks(root: string): void {
  git(root, 'init', '--quiet');
  fs.mkdirSync(path.join(root, '.git', 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(root, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\ncall_lefthook run "pre-commit" "$@"\n');
}
