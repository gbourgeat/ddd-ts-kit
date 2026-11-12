import type { CriteriaCase } from './criteria-case';

/**
 * The text searches that ignore case: the same rows on every store for the ASCII letters and for
 * a letter with one upper-case and one lower-case form, and the text taken as literally as
 * `contains` takes it.
 */
export const IGNORING_CASE_CASES: readonly CriteriaCase[] = [
  {
    name: 'containsIgnoringCase finds the text in any case',
    read: (all) => all.where('title', 'containsIgnoringCase', 'ANNUAL'),
    ids: ['a1', 'a8', 'a2'],
  },
  {
    name: 'containsIgnoringCase reads a text of mixed case',
    read: (all) => all.where('title', 'containsIgnoringCase', 'rEvIeW'),
    ids: ['a1', 'a8'],
  },
  {
    name: 'containsIgnoringCase finds a non-ASCII letter written in the other case',
    read: (all) => all.where('title', 'containsIgnoringCase', 'élan V'),
    ids: ['a7'],
  },
  {
    name: 'containsIgnoringCase keeps the accents: e is not é',
    read: (all) => all.where('title', 'containsIgnoringCase', 'elan'),
    ids: [],
  },
  {
    name: 'containsIgnoringCase takes % as a character',
    read: (all) => all.where('title', 'containsIgnoringCase', '0% R'),
    ids: ['a3'],
  },
  {
    name: 'containsIgnoringCase takes _ as a character',
    read: (all) => all.where('title', 'containsIgnoringCase', 'W_U'),
    ids: ['a4'],
  },
  {
    name: 'containsIgnoringCase never reads _ as any character',
    read: (all) => all.where('title', 'containsIgnoringCase', 'a_nual'),
    ids: [],
  },
  {
    name: 'containsIgnoringCase takes a backslash as a character',
    read: (all) => all.where('title', 'containsIgnoringCase', 'N \\ I'),
    ids: ['a6'],
  },
  {
    name: 'containsIgnoringCase takes a quote as a character',
    read: (all) => all.where('title', 'containsIgnoringCase', "o'b"),
    ids: ['a6'],
  },
  {
    name: 'containsIgnoringCase never reads a dot or a star as a pattern',
    read: (all) =>
      all.or((any) => any.where('title', 'containsIgnoringCase', 'w.u').where('title', 'containsIgnoringCase', '*')),
    ids: [],
  },
  {
    name: 'containsIgnoringCase takes a hyphen, a colon and a comma as characters',
    read: (all) =>
      all.or((any) =>
        any.where('title', 'containsIgnoringCase', '-UP: K').where('title', 'containsIgnoringCase', 'L, R'),
      ),
    ids: ['a8', 'a5'],
  },
  {
    name: 'startsWithIgnoringCase finds the text in any case',
    read: (all) => all.where('title', 'startsWithIgnoringCase', 'follow'),
    ids: ['a4', 'a5'],
  },
  {
    name: 'startsWithIgnoringCase only reads the start',
    read: (all) => all.where('title', 'startsWithIgnoringCase', 'REVIEW'),
    ids: [],
  },
  {
    name: 'startsWithIgnoringCase finds a non-ASCII letter written in the other case',
    read: (all) => all.where('title', 'startsWithIgnoringCase', 'éL'),
    ids: ['a7'],
  },
  {
    name: 'startsWithIgnoringCase takes % and _ as characters',
    read: (all) =>
      all.or((any) =>
        any
          .where('title', 'startsWithIgnoringCase', '100% r')
          .where('title', 'startsWithIgnoringCase', 'FOLLOW_')
          .where('title', 'startsWithIgnoringCase', '%')
          .where('title', 'startsWithIgnoringCase', '_'),
      ),
    ids: ['a3', 'a4'],
  },
  {
    name: 'not of containsIgnoringCase',
    read: (all) => all.not((none) => none.where('title', 'containsIgnoringCase', 'Annual')),
    ids: ['a3', 'a4', 'a5', 'a6', 'a7'],
  },
  {
    name: 'not of startsWithIgnoringCase',
    read: (all) => all.not((none) => none.where('title', 'startsWithIgnoringCase', 'FOLLOW')),
    ids: ['a1', 'a8', 'a2', 'a3', 'a6', 'a7'],
  },
];
