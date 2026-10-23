import { todosIn } from '../workspace/todos-in';
import type { Remaining } from './remaining';

/** The markers written by hand next to `TODO(domain)`: a choice of the platform, a remark of a review. */
const MARKS: ReadonlyArray<readonly ['platform' | 'review', string]> = [
  ['platform', 'TODO(platform):'],
  ['review', 'TODO(review):'],
];

const TEST_TODO = /\b(?:it|test)\.todo\(\s*(['"`])(.*?)\1/;

/** The markers of one file, in the order of its lines. */
export function remainingIn(context: string, file: string, content: string): Remaining[] {
  const domain = todosIn(file, content).map((todo) => ({ kind: 'domain' as const, context, ...todo }));

  const others = content.split('\n').flatMap((text, index): Remaining[] => {
    const test = TEST_TODO.exec(text)?.[2];
    const at = { context, file, line: index + 1 };

    const marked = MARKS.flatMap(([kind, mark]): Remaining[] => {
      const found = text.indexOf(mark);

      return found === -1 ? [] : [{ kind, ...at, text: text.slice(found + mark.length).trim() }];
    });

    return [...marked, ...(test === undefined ? [] : [{ kind: 'test' as const, ...at, text: test }])];
  });

  return [...domain, ...others].sort((left, right) => left.line - right.line);
}
