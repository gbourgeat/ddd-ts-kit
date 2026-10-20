/** A version as Semantic Versioning 2.0.0 writes it: three numbers, a pre-release part, build metadata. */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

interface Version {
  readonly release: readonly [number, number, number];
  readonly preRelease: readonly string[];
}

/**
 * The higher of two versions by the precedence of Semantic Versioning (a pre-release below its
 * release, build metadata ignored), as written; the first when they rank the same. Undefined when
 * either is not a semantic version: which one to keep is then a person's decision.
 */
export function higherVersion(one: string, other: string): string | undefined {
  const first = parsed(one);
  const second = parsed(other);

  if (first === undefined || second === undefined) {
    return undefined;
  }

  return compare(first, second) >= 0 ? one : other;
}

function parsed(written: string): Version | undefined {
  const match = SEMVER.exec(written);

  if (match === null) {
    return undefined;
  }

  return {
    release: [Number(match[1]), Number(match[2]), Number(match[3])],
    preRelease: match[4] === undefined ? [] : match[4].split('.'),
  };
}

function compare(first: Version, second: Version): number {
  const release = first.release.map((part, index) => part - (second.release[index] ?? 0)).find((delta) => delta !== 0);

  if (release !== undefined) {
    return release;
  }

  if (first.preRelease.length === 0 || second.preRelease.length === 0) {
    return second.preRelease.length - first.preRelease.length;
  }

  return comparePreRelease(first.preRelease, second.preRelease);
}

/** Identifier by identifier: numbers by value and below words, words in ASCII order, then the longer one higher. */
function comparePreRelease(first: readonly string[], second: readonly string[]): number {
  for (let index = 0; index < Math.min(first.length, second.length); index += 1) {
    const delta = compareIdentifier(first[index] ?? '', second[index] ?? '');

    if (delta !== 0) {
      return delta;
    }
  }

  return first.length - second.length;
}

function compareIdentifier(first: string, second: string): number {
  const numeric = /^\d+$/;

  if (numeric.test(first) && numeric.test(second)) {
    return Number(first) - Number(second);
  }

  if (numeric.test(first) !== numeric.test(second)) {
    return numeric.test(first) ? -1 : 1;
  }

  if (first === second) {
    return 0;
  }

  return first < second ? -1 : 1;
}
