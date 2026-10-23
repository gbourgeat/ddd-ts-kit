import { execFile } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
/** How many compilations run at once: a quarter of the cores, two at least, so that several spec files compiling at the same time leave the runner its share. */
const COMPILATIONS_AT_ONCE = Math.max(2, Math.floor(availableParallelism() / 4));
const MODULES = path.resolve(import.meta.dirname, '../../../../node_modules');
const KERNEL = '@ddd-ts-kit/kernel';
/** The built kernel, read where the workspace keeps it: where a package manager links it differs from one to the next. */
const KERNEL_PACKAGE = path.resolve(import.meta.dirname, '../../../kernel');

const COMPILERS = {
  'TypeScript 7 (native)': path.join(MODULES, '@typescript/native/bin/tsc'),
  'TypeScript 6': path.join(MODULES, 'typescript/bin/tsc'),
};

const SETTINGS = {
  'standard decorators': ['--experimentalDecorators', 'false'],
  'standard decorators, fields assigned': ['--experimentalDecorators', 'false', '--useDefineForClassFields', 'false'],
  experimentalDecorators: ['--experimentalDecorators', 'true'],
  'experimentalDecorators with emitDecoratorMetadata': [
    '--experimentalDecorators',
    'true',
    '--emitDecoratorMetadata',
    'true',
  ],
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

/**
 * Every compiler with every decorator setting, for a fixture project whose tsconfig is in `fixtures`.
 * The first compile starts every compilation, a few at a time: a mode does not wait for the ones
 * declared before it, and the file that reads them all is as long as the slowest, not as their sum.
 */
export function decoratorModes(fixtures: string): DecoratorMode[] {
  const compilations = new Map<string, Promise<unknown>>();

  const modes = Object.entries(COMPILERS).flatMap(([compiler, script], compilerIndex) =>
    Object.entries(SETTINGS).map(([setting, flags], settingIndex) => {
      const output = path.join(fixtures, 'dist', `${compilerIndex}-${settingIndex}`);

      return { label: `${compiler}, ${setting}`, output, args: [script, '-p', fixtures, '--outDir', output, ...flags] };
    }),
  );

  const compiled = (label: string): Promise<unknown> => {
    if (compilations.size === 0) {
      const slot = atMost(COMPILATIONS_AT_ONCE);

      for (const mode of modes) {
        compilations.set(
          mode.label,
          slot(() => run(process.execPath, mode.args).then(() => copyKernelInto(mode.output))),
        );
      }
    }

    return compilations.get(label) ?? Promise.reject(new Error(`No compilation of ${label}`));
  };

  return modes.map(({ label, output }) => {
    const compile = async (): Promise<string> => {
      await compiled(label).catch(explained);

      return output;
    };

    return {
      label,
      compile,
      kernel: async () => import(/* @vite-ignore */ pathToFileURL(path.join(await compile(), kernelEntry())).href),
    };
  });
}

/** Runs the tasks it is given at most `count` at a time, in the order they come. */
function atMost(count: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const waiting: (() => void)[] = [];

  return async (task) => {
    if (active >= count) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }

    active += 1;

    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
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
  cpSync(path.join(KERNEL_PACKAGE, 'package.json'), path.join(copy, 'package.json'));

  cpSync(path.join(KERNEL_PACKAGE, 'dist'), path.join(copy, 'dist'), {
    recursive: true,
    filter: (source) => !source.endsWith('.map') && !source.endsWith('.d.ts'),
  });
}

function explained(error: unknown): never {
  const output = typeof error === 'object' && error !== null && 'stdout' in error ? String(error.stdout) : '';

  throw new Error(`The fixture project does not compile:\n${output}`, { cause: error });
}
