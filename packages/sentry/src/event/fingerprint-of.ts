import { DomainError, type ErrorReport } from '@ddd-ts-kit/kernel';

const FRAME = /^\s*at (?:async )?(?:(.+?) \()?(?:.*[/\\])?([^/\\:()]+):\d+:\d+\)?$/;

/**
 * What makes two events the same problem. Never the message: it quotes identifiers, and one
 * problem would become thousands of issues. A `DomainError` is its class and its code. Any
 * other error is its class, its code when it has one, and where it was raised: the function
 * and the file of the first frame, without line numbers, which move at every release.
 */
export function fingerprintOf(error: unknown, report: ErrorReport): string[] {
  const type = error instanceof Error ? error.constructor.name : typeof error;
  const code = report.errorCode === undefined ? [] : [report.errorCode];

  if (error instanceof DomainError) return [type, ...code];

  return [type, ...code, ...raisedAt(error)];
}

function raisedAt(error: unknown): string[] {
  if (!(error instanceof Error) || error.stack === undefined) return [];

  for (const line of error.stack.split('\n')) {
    const frame = FRAME.exec(line);

    if (frame !== null) return [[frame[1], frame[2]].filter((part) => part !== undefined).join(' ')];
  }

  return [];
}
