#!/usr/bin/env node
/**
 * The checked samples of the documentation compile. A TypeScript fence preceded by the line
 * `<!-- checked sample -->` is written as a module under .ddd-ts-kit/doc-samples/ (gitignored),
 * at the root of the repository so that `@ddd-ts-kit/*` resolve to the packages of the
 * workspace, and compiled with the TypeScript of the workspace, strict as tsconfig.base.json,
 * with standard decorators. A sample that needs the legacy decorators is preceded by
 * `<!-- checked sample: legacy-decorators -->` instead.
 *
 *   npm run build && node pipeline/monorepo/doc-samples.mjs --check              every page in scope and its French page
 *   npm run build && node pipeline/monorepo/doc-samples.mjs --check <pages...>   these pages only
 *
 * Each failure is printed as `<page>:<line>: <compiler message>`, the line being the line of
 * the page the error is on; the fence starts a few lines above. Exit 1 if any.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { englishPages, frenchOf } from './translations.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MARKER = /^<!-- checked sample(?::\s*(legacy-decorators))? -->$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const TYPESCRIPT_FENCE = /^`{3,}\s*(?:ts|typescript|tsx)$/;
const NOT_FOLLOWED = 'a checked sample marker is not followed by a ```ts fence';
const MODES = { standard: false, legacy: true };

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exit(main(process.argv.slice(2)));
}

function main(args) {
  const files = args.filter((arg) => arg !== '--check').map((file) => path.relative(ROOT, path.resolve(file)));
  const pages = files.length > 0 ? files.map((file) => file.split(path.sep).join('/')) : documentedPages(ROOT);
  const { samples, problems } = collect(ROOT, pages);
  const failures = [...problems, ...compile(ROOT, samples)];

  for (const failure of failures) {
    console.log(failure);
  }

  console.log(
    failures.length === 0
      ? `${samples.length} checked sample(s) of ${pages.length} page(s) compile.`
      : `\n${failures.length} problem(s) in the checked samples. The convention is in docs/translation.md.`,
  );

  return failures.length === 0 ? 0 : 1;
}

/** Every English page in scope, and its French page when it exists. */
function documentedPages(root) {
  return englishPages(root).flatMap((english) => [
    english,
    ...(fs.existsSync(path.join(root, frenchOf(english))) ? [frenchOf(english)] : []),
  ]);
}

/** The samples of the given pages, and the markers that precede no TypeScript fence. */
export function collect(root, pages) {
  const found = pages.map((page) => ({ page, ...samplesOf(fs.readFileSync(path.join(root, page), 'utf8')) }));

  return {
    samples: found.flatMap(({ page, samples }) => samples.map((sample) => ({ page, ...sample }))),
    problems: found.flatMap(({ page, problems }) => problems.map((problem) => `${page}:${problem}`)),
  };
}

/**
 * The checked samples of one Markdown text: `{ line, code, legacy }`, `line` being the line of
 * the opening fence, and the problems of markers that are not followed by a TypeScript fence.
 * A marker inside a fence (an example of the convention itself) is text, not a marker.
 */
export function samplesOf(text) {
  const lines = text.split('\n');
  const state = { lines, samples: [], problems: [], fence: undefined, pending: undefined };

  lines.forEach((line, index) => readLine(state, line, index));

  if (state.fence?.sample === true) {
    state.problems.push(`${state.fence.line}: the fence of this checked sample is never closed`);
  }

  if (state.pending !== undefined) {
    state.problems.push(`${state.pending.line}: ${NOT_FOLLOWED}`);
  }

  return { samples: state.samples, problems: state.problems };
}

function readLine(state, line, index) {
  const fence = FENCE.exec(line)?.[1];

  if (state.fence !== undefined) {
    readInsideFence(state, { line, index, fence });
  } else if (fence !== undefined) {
    openFence(state, { line, index, fence });
  } else {
    readProse(state, line, index);
  }
}

/** Inside a fence, a line closes it or is code; the code of a checked sample is kept. */
function readInsideFence(state, { line, index, fence }) {
  const open = state.fence;
  const closes = fence !== undefined && fence[0] === open.marker[0] && fence.length >= open.marker.length;

  if (!closes || line.trim() !== fence) {
    return;
  }

  if (open.sample) {
    state.samples.push({ line: open.line, code: state.lines.slice(open.line, index).join('\n'), legacy: open.legacy });
  }

  state.fence = undefined;
}

/** A fence opens: it is a checked sample when a marker waits for it and it is TypeScript. */
function openFence(state, { line, index, fence }) {
  const typescript = TYPESCRIPT_FENCE.test(line.trim());

  if (state.pending !== undefined && !typescript) {
    state.problems.push(`${state.pending.line}: ${NOT_FOLLOWED}`);
  }

  state.fence = {
    marker: fence,
    line: index + 1,
    sample: state.pending !== undefined && typescript,
    legacy: state.pending?.legacy === true,
  };
  state.pending = undefined;
}

/** Outside a fence: a marker waits for its fence; any other text before the fence is a problem. */
function readProse(state, line, index) {
  const marker = MARKER.exec(line.trim());

  if (state.pending !== undefined && (marker !== null || line.trim() !== '')) {
    state.problems.push(`${state.pending.line}: ${NOT_FOLLOWED}`);
    state.pending = undefined;
  }

  if (marker !== null) {
    state.pending = { line: index + 1, legacy: marker[1] !== undefined };
  }
}

/**
 * Writes the samples under `<root>/.ddd-ts-kit/doc-samples` (emptied first), compiles them in
 * one run per decorator mode, and answers the errors placed on the lines of their pages.
 */
export function compile(root, samples, directory = path.join(root, '.ddd-ts-kit', 'doc-samples')) {
  fs.rmSync(directory, { recursive: true, force: true });

  return Object.entries(MODES).flatMap(([mode, legacy]) => {
    const own = samples.filter((sample) => sample.legacy === legacy);

    if (own.length === 0) {
      return [];
    }

    const files = new Map(own.map((sample, index) => [moduleName(sample, index), sample]));
    fs.mkdirSync(path.join(directory, mode), { recursive: true });

    for (const [name, sample] of files) {
      fs.writeFileSync(path.join(directory, mode, name), `${sample.code}\n`);
    }

    fs.writeFileSync(path.join(directory, mode, 'tsconfig.json'), tsconfig(legacy));
    const run = runCompiler(path.join(directory, mode, 'tsconfig.json'));
    const errors = errorsOf(run.output, files);

    return run.status !== 0 && errors.length === 0
      ? [`doc-samples: the compiler failed: ${run.output.trim()}`]
      : errors;
  });
}

function moduleName(sample, index) {
  const slug = sample.page.replace(/\.md$/, '').replace(/[^A-Za-z0-9]+/g, '-');
  return `${String(index).padStart(4, '0')}-${slug}-L${sample.line}.ts`;
}

function tsconfig(legacy) {
  const base = path.join(ROOT, 'tsconfig.base.json');

  return `${JSON.stringify(
    {
      extends: base,
      compilerOptions: {
        composite: false,
        declaration: false,
        declarationMap: false,
        sourceMap: false,
        noEmit: true,
        moduleDetection: 'force',
        experimentalDecorators: legacy,
      },
      include: ['./*.ts'],
    },
    null,
    2,
  )}\n`;
}

/** The output of the TypeScript of the workspace, the native compiler first. */
function runCompiler(project) {
  const compilers = ['node_modules/@typescript/native/bin/tsc', 'node_modules/typescript/bin/tsc']
    .map((compiler) => path.join(ROOT, compiler))
    .filter((compiler) => fs.existsSync(compiler));

  if (compilers.length === 0) {
    throw new Error('No TypeScript compiler under node_modules: run npm ci first.');
  }

  const run = spawnSync(process.execPath, [compilers[0], '-p', project, '--pretty', 'false'], { encoding: 'utf8' });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

/** `file(line,col): error TSxxxx: message` lines, continuation lines joined, placed on their page. */
function errorsOf(output, files) {
  const errors = [];

  for (const line of output.split('\n')) {
    const error = /([^\\/(]+\.ts)\((\d+),(\d+)\): (error TS\d+: .*)$/.exec(line);
    const sample = error === null ? undefined : files.get(error[1]);

    if (error !== null && sample !== undefined) {
      errors.push(`${sample.page}:${sample.line + Number(error[2])}: ${error[4]}`);
    } else if (error === null && /^\s+\S/.test(line) && errors.length > 0) {
      errors[errors.length - 1] += ` ${line.trim()}`;
    } else if (/error TS\d+/.test(line)) {
      errors.push(`doc-samples: ${line.trim()}`);
    }
  }

  return errors;
}
