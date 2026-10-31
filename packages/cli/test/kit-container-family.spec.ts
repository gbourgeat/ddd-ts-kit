import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './helpers';

const CLI = path.join(REPO_ROOT, 'packages/cli');
const NAMING_ONE_CONTAINER = /\bdi\s*[!=]==\s*'tsyringe'/;

function filesUnder(directory: string): string[] {
  return fs
    .readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .map((file) => path.join(directory, file))
    .filter((file) => fs.statSync(file).isFile());
}

const relative = (file: string): string => path.relative(CLI, file);

/**
 * tsyringe, InversifyJS and Awilix are one family: what is written for one is written for the three.
 * A branch started before they became one still writes the old form, and git has nothing to say
 * about a new file or a new comparison; most stacks on the two others only run at night.
 */
describe('the containers of the kit, as one family', () => {
  it('asks onKitContainer, never whether the container is tsyringe', () => {
    const found = filesUnder(path.join(CLI, 'src')).filter((file) =>
      NAMING_ONE_CONTAINER.test(fs.readFileSync(file, 'utf8')),
    );

    expect(found.map(relative)).toEqual([]);
  });

  it('names no template after tsyringe', () => {
    const found = filesUnder(path.join(CLI, 'templates')).filter((file) => path.basename(file).includes('tsyringe'));

    expect(found.map(relative)).toEqual([]);
  });

  it('has no template that reads di.tsyringe, or the entry point of tsyringe', () => {
    const found = filesUnder(path.join(CLI, 'templates')).filter((file) =>
      /di\.tsyringe|@ddd-ts-kit\/di\/tsyringe/.test(fs.readFileSync(file, 'utf8')),
    );

    expect(found.map(relative)).toEqual([]);
  });
});
