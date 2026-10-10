import fs from 'node:fs';
import { CONFIG_FILE } from '../../config/index.js';
import { readProjectFile } from '../alias/read-project-file.js';
import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import { scan } from '../scan/scan.js';
import { matchingBracket } from '../text/matching-bracket.js';

/** The config of the unit and integration specs: the one a coverage run reads. */
const MAIN_CONFIG = /^(vitest|jest)\.config\.[cm]?[jt]s$/;
const ANY_CONFIG = /^(vitest|jest)(?:\.[\w-]+)*\.(?:config|workspace)\.[cm]?[jt]s$/;

const READER: Readonly<Record<string, string>> = { vitest: 'governedCoverage', jest: 'governedJestCoverage' };

const SPREAD: Readonly<Record<string, string>> = {
  vitest: '`...governedCoverage(mode)` into `test.coverage`',
  jest: '`...governedJestCoverage()` into the config',
};

/** What a hand-written setting does to the measure, by the key that writes it. */
const BY_HAND: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  vitest: {
    include: 'replaces the measured layers',
    exclude: 'hides files from the measure',
    thresholds: 'replaces the governed thresholds',
    ignoreClassMethods: 'hides methods from the measure',
  },
  jest: {
    collectCoverageFrom: 'replaces the measured layers',
    coveragePathIgnorePatterns: 'hides files from the measure',
    coverageThreshold: 'replaces the governed thresholds',
  },
};

export interface RunnerFinding extends Finding {
  readonly file: string;
}

/** What the test runner configs at the root of a project say about coverage that the config file does not govern. */
export function runnerSettings(project: Project): RunnerFinding[] {
  return rootFiles(project.root).flatMap((file) => {
    const runner = ANY_CONFIG.exec(file)?.[1];
    const text = runner === undefined ? undefined : readProjectFile(project, file);

    if (runner === undefined || text === undefined) {
      return [];
    }

    const scanned = scan(text);
    const lineAt = (offset: number): number => scanned.lineAt(offset);
    const findings = [...notGoverned(file, runner, scanned.code), ...byHand(runner, scanned.code, lineAt)];

    return findings.map((finding) => ({ file, ...finding }));
  });
}

function notGoverned(file: string, runner: string, code: string): Finding[] {
  const reader = READER[runner] ?? '';

  if (!MAIN_CONFIG.test(file) || new RegExp(String.raw`\b${reader}\s*\(`).test(code)) {
    return [];
  }

  return [
    {
      line: 1,
      message: `${file} does not read its coverage thresholds from ${CONFIG_FILE}.`,
      fix: `Import \`${reader}\` from '@ddd-ts-kit/testing/coverage' and spread ${SPREAD[runner] ?? ''}: the four layers of every context are then measured against the "coverage" thresholds of ${CONFIG_FILE}, written once.`,
    },
  ];
}

function byHand(runner: string, code: string, lineAt: (offset: number) => number): Finding[] {
  const settings = BY_HAND[runner] ?? {};
  const scope = runner === 'vitest' ? coverageBlocks(code) : [{ start: 0, end: code.length }];

  return scope.flatMap(({ start, end }) =>
    Object.entries(settings).flatMap(([key, effect]) => {
      const found = new RegExp(String.raw`(?<![\w.$])${key}\s*:`).exec(code.slice(start, end));

      return found === null ? [] : [handWritten(key, effect, lineAt(start + found.index))];
    }),
  );
}

function handWritten(key: string, effect: string, line: number): Finding {
  return {
    line,
    message: `The coverage setting "${key}" is written by hand: it ${effect}.`,
    fix: `Remove "${key}": what is measured and the floor of each layer come from the "coverage" key of ${CONFIG_FILE} alone. To lower a threshold, change it there and record the deviation ("what": "coverage.<layer>.<rate>") with its decision record.`,
  };
}

interface Span {
  readonly start: number;
  readonly end: number;
}

/** The object literals written after a `coverage:` key. */
function coverageBlocks(code: string): Span[] {
  return [...code.matchAll(/(?<![\w.$])coverage\s*:\s*\{/g)].map((match) => {
    const open = match.index + match[0].length - 1;

    return { start: open, end: matchingBracket(code, open) };
  });
}

function rootFiles(root: string): string[] {
  try {
    return fs.readdirSync(root).sort();
  } catch {
    return [];
  }
}
