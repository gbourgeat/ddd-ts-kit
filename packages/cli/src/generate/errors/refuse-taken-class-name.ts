import path from 'node:path';
import { CliError } from '../../cli-error';
import type { Name } from '../../naming';
import { filesUnder } from '../files-under';
import type { Scope } from '../scope';

/**
 * A refusal class never takes the name of another class of its context: `Invoice` beside the
 * aggregate `Invoice` makes every import of one of them ambiguous. Its own file, where a second
 * factory is added, and the tests are left out.
 */
export function refuseTakenClassName(scope: Scope, refusal: Name): void {
  const own = `${refusal.kebab}.error.ts`;
  const declares = new RegExp(`(?:^|\\n)\\s*export\\s+(?:abstract\\s+)?class\\s+${refusal.pascal}\\b`);

  const taken = filesUnder(scope.ws, scope.dir)
    .filter((file) => isSource(file) && path.posix.basename(file) !== own)
    .find((file) => declares.test(scope.ws.read(`${scope.dir}/${file}`) ?? ''));

  if (taken !== undefined) {
    throw new CliError(
      `"${refusal.pascal}" names a class of the context already, in ${scope.dir}/${taken}.`,
      `Name the refusal after what is refused, in the words of the glossary (for example ${refusal.pascal}AlreadyIssued): a refusal class never takes the name of another class of its context.`,
    );
  }
}

function isSource(file: string): boolean {
  return file.endsWith('.ts') && !file.startsWith('test/') && !/\.(?:spec|test)\.ts$/.test(file);
}
