import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { read, REPO_ROOT, write } from '../helpers.js';

/** The compiler the generated scripts call by path: `npx tsc` would run the older one, kept for the tools. */
export const NATIVE_COMPILER = path.join(REPO_ROOT, 'node_modules/@typescript/native/bin/tsc');

const PACKAGES = path.join(REPO_ROOT, 'packages');
const TOOLS = ['cli', 'eslint-plugin'];

/**
 * What the compiler says of a generated project read against the SOURCES of the workspace
 * packages, so that a template can never lag behind their real API; empty when it type-checks.
 */
export function typeErrors(root: string): string {
  fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');

  write(
    root,
    'tsconfig.e2e.json',
    JSON.stringify({
      extends: './tsconfig.json',
      // `paths` of an extending config replaces the one it extends: the aliases of the project are repeated next to the sources of the packages.
      compilerOptions: { noEmit: true, rootDir: '/', paths: { ...aliasPaths(root), ...sourcePaths() } },
      include: ['src', 'scripts', 'test', path.join(PACKAGES, 'validation/src/*.d.ts')],
    }),
  );

  try {
    execFileSync(process.execPath, [NATIVE_COMPILER, '-p', 'tsconfig.e2e.json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    return '';
  } catch (error) {
    return error instanceof Error && 'stdout' in error ? String(error.stdout) : String(error);
  }
}

function aliasPaths(root: string): Record<string, string[]> {
  const { compilerOptions } = JSON.parse(read(root, 'tsconfig.json')) as {
    compilerOptions: { paths: Record<string, string[]> };
  };

  return compilerOptions.paths;
}

/** Every entry of every runtime package, resolved to its source file. */
function sourcePaths(): Record<string, string[]> {
  const paths: Record<string, string[]> = {};

  for (const name of fs.readdirSync(PACKAGES).filter((entry) => !TOOLS.includes(entry))) {
    const source = (entry: string): string => path.join(PACKAGES, name, 'src', `${entry}.ts`);

    if (fs.existsSync(source('index'))) {
      paths[`@ddd-ts-kit/${name}`] = [source('index')];
    }

    paths[`@ddd-ts-kit/${name}/*`] = [source('*')];
  }

  return paths;
}
