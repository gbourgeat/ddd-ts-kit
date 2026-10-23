import { execFile } from 'node:child_process';
import { rmSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
/** How many compilations run at once: a quarter of the cores, two at least, so that several spec files compiling at the same time leave the runner its share. */
const COMPILATIONS_AT_ONCE = Math.max(2, Math.floor(availableParallelism() / 4));
const MODULES = path.resolve(import.meta.dirname, '../../../../node_modules');

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
  /** Compiles the fixture project this way, type errors included, and loads one emitted file. */
  load(emitted: string): Promise<unknown>;
}

/**
 * Every compiler with every decorator setting, for a fixture project whose tsconfig is in `fixtures`.
 * The first load starts every compilation, a few at a time: a mode does not wait for the ones
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
          slot(() => run(process.execPath, mode.args)),
        );
      }
    }

    return compilations.get(label) ?? Promise.reject(new Error(`No compilation of ${label}`));
  };

  return modes.map(({ label, output }) => ({
    label,
    async load(emitted: string): Promise<unknown> {
      await compiled(label).catch(explained);

      return import(/* @vite-ignore */ pathToFileURL(path.join(output, emitted)).href);
    },
  }));
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

function explained(error: unknown): never {
  const output = typeof error === 'object' && error !== null && 'stdout' in error ? String(error.stdout) : '';

  throw new Error(`The fixture project does not compile:\n${output}`, { cause: error });
}
