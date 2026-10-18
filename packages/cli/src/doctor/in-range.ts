/** A version as major, minor and patch; a pre-release part is not read. */
type Release = readonly [number, number, number];

/** One comparator of a range: an operator, then a version whose missing or `x` parts stand for any. */
const COMPARATOR = /^(\^|~|>=|<=|>|<|=)?v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;

const HYPHEN = /^(\S+)\s+-\s+(\S+)$/;

/**
 * Whether a version (`22.12.0`) is in a range written the way `engines.node` and `.nvmrc` write
 * one (`>=22.12.0`, `^20.19.0 || >=22.12.0`, `22`, `20.x`, `18 - 20`); undefined when the range
 * says it otherwise, such as `lts/*`: what cannot be read is not judged.
 */
export function inRange(version: string, range: string): boolean | undefined {
  const release = releaseOf(version);
  const sets = range.split('||').map(testsOf);

  if (release === undefined || sets.some((tests) => tests === undefined)) {
    return undefined;
  }

  return sets.some((tests) => tests?.every((test) => test(release)));
}

function releaseOf(version: string): Release | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());

  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** The comparators of one set, all of which a version meets; `*` and an empty set accept any. */
function testsOf(set: string): Array<(release: Release) => boolean> | undefined {
  const written = set.trim().replace(/(\^|~|>=|<=|>|<|=)\s+/g, '$1');
  const hyphen = HYPHEN.exec(written);
  const comparators = hyphen === null ? written.split(/\s+/).filter((part) => part !== '') : hyphenOf(hyphen);
  const tests = comparators.map(testOf);

  return tests.every((test) => test !== undefined) ? tests : undefined;
}

function hyphenOf([, from = '', to = '']: RegExpExecArray): string[] {
  return [`>=${from}`, `<=${to}`];
}

function testOf(text: string): ((release: Release) => boolean) | undefined {
  const comparator = comparatorOf(text);

  if (comparator === undefined) {
    return undefined;
  }

  const { operator, known } = comparator;

  return known === 0 ? () => operator !== '<' && operator !== '>' : boundedTest(comparator);
}

/** An operator, the lowest version the comparator writes, and how many of its parts it writes (`22.x`: one). */
interface Comparator {
  readonly operator: string;
  readonly floor: Release;
  readonly known: number;
}

function comparatorOf(text: string): Comparator | undefined {
  const match = COMPARATOR.exec(text);

  if (match === null) {
    return undefined;
  }

  const groups: ReadonlyArray<string | undefined> = match;
  const [, operator = '=', ...parts] = groups;
  const given = parts.map((part) => (part === undefined || /^[xX*]$/.test(part) ? undefined : Number(part)));
  const unknown = given.findIndex((part) => part === undefined);
  const known = unknown === -1 ? 3 : unknown;
  const floor: Release = [given[0] ?? 0, known > 1 ? (given[1] ?? 0) : 0, known > 2 ? (given[2] ?? 0) : 0];

  return { operator, floor, known };
}

function boundedTest({ operator, floor, known }: Comparator): (release: Release) => boolean {
  const next = bump(floor, known - 1);

  switch (operator) {
    case '>=':
      return (release) => compare(release, floor) >= 0;
    case '>':
      return known === 3 ? (release) => compare(release, floor) > 0 : (release) => compare(release, next) >= 0;
    case '<':
      return (release) => compare(release, floor) < 0;
    case '<=':
      return (release) => compare(release, next) < 0;
    default:
      return (release) => compare(release, floor) >= 0 && compare(release, ceilingOf(operator, floor, known)) < 0;
  }
}

/** The first version past an exact, a tilde or a caret comparator. */
function ceilingOf(operator: string, floor: Release, known: number): Release {
  if (operator === '~') {
    return bump(floor, known > 1 ? 1 : 0);
  }

  return bump(floor, operator === '^' ? caretPart(floor, known) : known - 1);
}

/** The part a caret range holds: the first that is not zero, or the last one written. */
function caretPart(floor: Release, known: number): number {
  const significant = floor.slice(0, known).findIndex((part) => part !== 0);

  return significant === -1 ? known - 1 : significant;
}

/** The first version past every one that shares the parts up to `index`. */
function bump([major, minor, patch]: Release, index: number): Release {
  if (index === 0) {
    return [major + 1, 0, 0];
  }

  return index === 1 ? [major, minor + 1, 0] : [major, minor, patch + 1];
}

function compare(left: Release, right: Release): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}
