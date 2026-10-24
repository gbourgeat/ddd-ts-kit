import fs from 'node:fs';
import { CONFIG_FILE } from '../../config';
import { readProjectFile } from '../alias/read-project-file';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import { scan } from '../scan/scan';

/** The config of Stryker, as it may be named at the root of a project. */
const STRYKER_CONFIG = /^\.?stryker\.conf(?:ig)?\.(?:[cm]?js|json|ts)$/;
const READER = 'governedMutation';

/** What a hand-written setting does to the measure, by the key that writes it. */
const BY_HAND: Readonly<Record<string, string>> = {
  mutate: 'replaces the mutated layers',
  mutator: 'replaces the mutations left out',
  ignorers: 'replaces the mutants left out',
  ignoreStatic: 'decides on the static mutants',
  thresholds: 'replaces the governed floor',
};

export interface StrykerFinding extends Finding {
  readonly file: string;
}

/** What the Stryker configs at the root of a project say about the measure that the config file does not govern. */
export function strykerSettings(project: Project): StrykerFinding[] {
  return rootFiles(project.root)
    .filter((file) => STRYKER_CONFIG.test(file))
    .flatMap((file) => {
      const text = readProjectFile(project, file);

      if (text === undefined) {
        return [];
      }

      const findings = file.endsWith('.json') ? ofJson(file, text) : ofScript(file, text);

      return findings.map((finding) => ({ file, ...finding }));
    });
}

/** A json config cannot call the kit: every governed setting it writes is written by hand. */
function ofJson(file: string, text: string): Finding[] {
  const lines = text.split('\n');

  return [
    notGoverned(file),
    ...Object.entries(BY_HAND).flatMap(([key, effect]) => {
      const index = lines.findIndex((line) => new RegExp(String.raw`^\s*"${key}"\s*:`).test(line));

      return index === -1 ? [] : [handWritten(key, effect, index + 1)];
    }),
  ];
}

function ofScript(file: string, text: string): Finding[] {
  const scanned = scan(text);
  const { code } = scanned;
  const governed = new RegExp(String.raw`\b${READER}\s*\(`).test(code);

  const byHand = Object.entries(BY_HAND).flatMap(([key, effect]) => {
    const found = new RegExp(String.raw`(?<![\w.$'"])${key}\s*:`).exec(code);

    return found === null ? [] : [handWritten(key, effect, scanned.lineAt(found.index))];
  });

  return [...(governed ? [] : [notGoverned(file)]), ...byHand];
}

function notGoverned(file: string): Finding {
  return {
    line: 1,
    message: `${file} does not read its mutation floor from ${CONFIG_FILE}.`,
    fix: `Import \`${READER}\` from '@ddd-ts-kit/testing/mutation' and spread \`...${READER}()\` into the config: the domain layer of every context is then mutated, the texts of its refusals left out, and held to the "mutation" floor of ${CONFIG_FILE}, written once.`,
  };
}

function handWritten(key: string, effect: string, line: number): Finding {
  return {
    line,
    message: `The mutation setting "${key}" is written by hand: it ${effect}.`,
    fix: `Remove "${key}": what is mutated, what is left out and the floor come from the "mutation" key of ${CONFIG_FILE} alone. To lower the floor, change it there and record the deviation ("what": "mutation.domain") with its decision record.`,
  };
}

function rootFiles(root: string): string[] {
  try {
    return fs.readdirSync(root).sort();
  } catch {
    return [];
  }
}
