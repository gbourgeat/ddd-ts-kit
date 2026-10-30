import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KINDS } from '../src/generate/kinds';
import { REPO_ROOT } from './helpers';

/** What a page may count, the true number read from the source, and how a page states it. */
interface Counted {
  readonly name: string;
  readonly actual: number;
  readonly pattern: RegExp;
}

/** A number written out, as the pages write it, in English and in French. */
const NUMBER = String.raw`(\d+|[a-zà-ÿ]+(?:-[a-zà-ÿ]+)*)`;

const UNITS_EN = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

const TEENS_EN = [
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const TENS_EN = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
const UNITS_FR = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const TEENS_FR = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS_FR = ['', '', 'vingt', 'trente', 'quarante', 'cinquante'];

const WORDS: ReadonlyMap<string, number> = new Map(
  Array.from({ length: 59 }, (_, index) => index + 1).flatMap((value) => [
    [inEnglish(value), value],
    [inFrench(value), value],
  ]),
);

const COUNTED: readonly Counted[] = [
  {
    name: 'kinds of generated building blocks',
    actual: KINDS.length,
    pattern: new RegExp(String.raw`\b${NUMBER} (?:kinds of building blocks|types de briques|sortes de briques)`, 'giu'),
  },
  {
    name: 'skills of the plugin',
    actual: entries('plugin/skills', (entry) => fs.existsSync(path.join(entry, 'SKILL.md'))),
    pattern: new RegExp(String.raw`\b${NUMBER} \*?skills\b`, 'giu'),
  },
  {
    name: 'agents of the plugin',
    actual: entries('plugin/agents', (entry) => entry.endsWith('.md')),
    pattern: new RegExp(String.raw`\b${NUMBER} agents\b(?! de code)`, 'giu'),
  },
];

/**
 * Pages that describe the kit as it is. Left out: the changelog and `changes/`, written once for a
 * release; the proposals, which quote the counts of their day; the templates and the example,
 * whose pages describe a generated project; the copy of the pages the site assembles on a
 * workstation, which git ignores and which may date from an earlier source.
 */
const LEFT_OUT = [
  /CHANGELOG(\.fr)?\.md$/,
  /^changes\//,
  /^docs\/proposals\//,
  /\/templates\//,
  /^examples\//,
  /^site\/src\/content\//,
];

describe('the counts a page states', () => {
  for (const counted of COUNTED) {
    it(`match the ${counted.name} in the source (${counted.actual})`, () => {
      const stated = pages().flatMap((page) => statements(page, counted));
      const wrong = stated.filter((statement) => statement.value !== counted.actual);

      expect(stated.length, `no page states the ${counted.name}: the pattern no longer matches`).toBeGreaterThan(0);

      expect(
        wrong.map((statement) => `${statement.where} says "${statement.text}", the source has ${counted.actual}`),
      ).toEqual([]);
    });
  }

  it('reads a number in figures and in words, in English and in French', () => {
    expect([42, 26, 6].map(inEnglish)).toEqual(['forty-two', 'twenty-six', 'six']);
    expect([42, 26, 6, 21].map(inFrench)).toEqual(['quarante-deux', 'vingt-six', 'six', 'vingt-et-un']);
    expect(['Twenty-six', 'vingt-six', '42', 'Six'].map(valueOf)).toEqual([26, 26, 42, 6]);
  });
});

interface Statement {
  readonly where: string;
  readonly text: string;
  readonly value: number | undefined;
}

function statements(page: string, counted: Counted): Statement[] {
  const lines = fs.readFileSync(path.join(REPO_ROOT, page), 'utf8').split('\n');

  return lines.flatMap((line, index) =>
    [...line.matchAll(counted.pattern)]
      .map((match) => ({ word: match[1] ?? '', text: match[0] }))
      .filter(({ word }) => /^\d+$/.test(word) || WORDS.has(word.toLowerCase()))
      .map(({ word, text }) => ({ where: `${page}:${index + 1}`, text, value: valueOf(word) })),
  );
}

function valueOf(word: string): number | undefined {
  return /^\d+$/.test(word) ? Number(word) : WORDS.get(word.toLowerCase());
}

function pages(): string[] {
  return tracked(REPO_ROOT)
    .filter((page) => page.endsWith('.md'))
    .filter((page) => !LEFT_OUT.some((pattern) => pattern.test(page)));
}

function tracked(root: string, dir = ''): string[] {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = dir === '' ? entry.name : `${dir}/${entry.name}`;

    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
      return [];
    }

    return entry.isDirectory() ? tracked(root, relative) : [relative];
  });
}

function entries(dir: string, keep: (entry: string) => boolean): number {
  const full = path.join(REPO_ROOT, dir);

  return fs
    .readdirSync(full)
    .map((entry) => path.join(full, entry))
    .filter(keep).length;
}

function inEnglish(value: number): string {
  if (value < 10) {
    return UNITS_EN[value] ?? '';
  }

  if (value < 20) {
    return TEENS_EN[value - 10] ?? '';
  }

  const unit = value % 10;
  const tens = TENS_EN[Math.floor(value / 10)] ?? '';

  return unit === 0 ? tens : `${tens}-${UNITS_EN[unit]}`;
}

function inFrench(value: number): string {
  if (value < 10) {
    return UNITS_FR[value] ?? '';
  }

  if (value < 20) {
    return TEENS_FR[value - 10] ?? '';
  }

  const unit = value % 10;
  const tens = TENS_FR[Math.floor(value / 10)] ?? '';

  if (unit === 0) {
    return tens;
  }

  return unit === 1 ? `${tens}-et-un` : `${tens}-${UNITS_FR[unit]}`;
}
