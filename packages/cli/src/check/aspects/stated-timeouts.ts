const NUMBER = /^\d[\d_]*$/;

/** What a piece of code says of time limits: the numbers given to `name(...)`, and whether each call is given one. */
export interface StatedTimeouts {
  readonly timeouts: readonly number[];
  readonly readable: boolean;
}

/**
 * The durations given to the calls of `name` (`timeout` of `@ddd-ts-kit/aspects`, `@Timeout` of
 * its decorators) in blanked code. A call given a variable or an expression is not readable.
 */
export function statedTimeouts(code: string, name: 'timeout' | '@Timeout'): StatedTimeouts {
  const given = [...code.matchAll(new RegExp(String.raw`(?<![\w$.])${name}\s*\(\s*([^,)]*)`, 'g'))].map((match) =>
    (match[1] ?? '').trim(),
  );

  return {
    timeouts: given.filter((duration) => NUMBER.test(duration)).map((duration) => Number(duration.replaceAll('_', ''))),
    readable: given.every((duration) => NUMBER.test(duration)),
  };
}
