import { todosIn } from '../workspace/todos-in.js';
import type { Remaining } from './remaining.js';

const PLATFORM_MARK = 'TODO(platform):';
const TEST_TODO = /\b(?:it|test)\.todo\(\s*(['"`])(.*?)\1/;

/** The markers of one file, in the order of its lines. */
export function remainingIn(context: string, file: string, content: string): Remaining[] {
  const domain = todosIn(file, content).map((todo) => ({ kind: 'domain' as const, context, ...todo }));

  const others = content.split('\n').flatMap((text, index): Remaining[] => {
    const platform = text.indexOf(PLATFORM_MARK);
    const test = TEST_TODO.exec(text)?.[2];
    const at = { context, file, line: index + 1 };

    return [
      ...(platform === -1 ? [] : [{ kind: 'platform' as const, ...at, text: text.slice(platform + PLATFORM_MARK.length).trim() }]),
      ...(test === undefined ? [] : [{ kind: 'test' as const, ...at, text: test }]),
    ];
  });

  return [...domain, ...others].sort((left, right) => left.line - right.line);
}
