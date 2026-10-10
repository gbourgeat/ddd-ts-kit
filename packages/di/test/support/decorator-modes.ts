import { execFile } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const MODULES = path.resolve(import.meta.dirname, '../../../../node_modules');
const KERNEL = '@ddd-ts-kit/kernel';

const COMPILERS = {
  'TypeScript 7 (native)': path.join(MODULES, '@typescript/native/bin/tsc'),
  'TypeScript 6': path.join(MODULES, 'typescript/bin/tsc'),
};

const SETTINGS = {
  'standard decorators': ['--experimentalDecorators', 'false'],
  'standard decorators, fields assigned': ['--experimentalDecorators', 'false', '--useDefineForClassFields', 'false'],
  'experimentalDecorators': ['--experimentalDecorators', 'true'],
  'experimentalDecorators with emitDecoratorMetadata': ['--experimentalDecorators', 'true', '--emitDecoratorMetadata', 'true'],
  'experimentalDecorators, fields assigned': ['--experimentalDecorators', 'true', '--useDefineForClassFields', 'false'],
};

/** One way a project may be built: a compiler and its decorator settings. */
export interface DecoratorMode {
  readonly label: string;

  /**
   * Compiles the fixture project this way, type errors included, next to a copy of the built
   * kernel that the emitted files load instead of the one of the workspace, and answers where
   * it was emitted.
   */
  compile(): Promise<string>;

  /** The copy of the kernel the emitted files load: other classes than the ones of the workspace. */
  kernel(): Promise<unknown>;
}

/** Every compiler with every decorator setting, for a fixture project whose tsconfig is in `fixtures`. */
export function decoratorModes(fixtures: string): DecoratorMode[] {
  return Object.entries(COMPILERS).flatMap(([compiler, script], compilerIndex) =>
    Object.entries(SETTINGS).map(([setting, flags], settingIndex) => {
      const output = path.join(fixtures, 'dist', `${compilerIndex}-${settingIndex}`);
      let compiled: Promise<unknown> | undefined;

      const compile = async (): Promise<string> => {
        compiled ??= run(process.execPath, [script, '-p', fixtures, '--outDir', output, ...flags]).then(() => {
          copyKernelInto(output);
        });

        await compiled.catch(explained);

        return output;
      };

      return {
        label: `${compiler}, ${setting}`,
        compile,
        kernel: async () => import(/* @vite-ignore */ pathToFileURL(path.join(await compile(), kernelEntry())).href),
      };
    }),
  );
}

export function removeCompiled(fixtures: string): void {
  rmSync(path.join(fixtures, 'dist'), { recursive: true, force: true });
}

function kernelEntry(): string {
  return path.join('node_modules', KERNEL, 'dist', 'index.js');
}

/** A package of its own, found first by whatever the output imports: a second copy in the process. */
function copyKernelInto(output: string): void {
  const copy = path.join(output, 'node_modules', KERNEL);

  mkdirSync(copy, { recursive: true });
  cpSync(path.join(MODULES, KERNEL, 'package.json'), path.join(copy, 'package.json'));

  cpSync(path.join(MODULES, KERNEL, 'dist'), path.join(copy, 'dist'), {
    recursive: true,
    filter: (source) => !source.endsWith('.map') && !source.endsWith('.d.ts'),
  });
}

function explained(error: unknown): never {
  const output = typeof error === 'object' && error !== null && 'stdout' in error ? String(error.stdout) : '';

  throw new Error(`The fixture project does not compile:\n${output}`, { cause: error });
}
