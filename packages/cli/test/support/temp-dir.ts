import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

const created: string[] = [];

export function tempDir(label: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `ddd-ts-kit-${label}-`));

  created.push(directory);

  return directory;
}

/**
 * Removes a throwaway directory once its case has ended, instead of at the end of the file: a sweep
 * over every stack keeps one copy of every package of the kit per case, and a runner's disk is not
 * the size of the sweep. What is removed here is not removed again by the end of the file.
 */
export function removeTempDir(directory: string): void {
  const at = created.indexOf(directory);

  if (at !== -1) {
    created.splice(at, 1);
  }

  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

/**
 * The throwaway projects of a file are removed together: each holds a copy of every package of
 * the kit, and on a busy runner removing them one after the other outlasted the hook timeout of
 * the end-to-end run. A git process of a throwaway repository can still be writing its objects
 * when the file ends, hence the retries.
 */
const CLEANUP_TIMEOUT = 600_000;

afterAll(async () => {
  await Promise.all(
    created
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })),
  );
}, CLEANUP_TIMEOUT);
