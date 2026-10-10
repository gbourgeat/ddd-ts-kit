/** What a contract compares of an error as a logger wrote it. */
export interface ErrorOutline {
  readonly type: unknown;
  readonly code: unknown;
  readonly message: unknown;
  /** `titled`: starts with the class and the message; `frames`: frames only; `none`: no stack. */
  readonly stack: 'titled' | 'frames' | 'none';
  readonly cause: ErrorOutline | undefined;
}

const FIRST_FRAME = /^\s+at /;

/** The outline of a written field, or `undefined` when it is not the description of an error. */
export function errorOutlineOf(written: unknown): ErrorOutline | undefined {
  if (!isRecord(written) || typeof written.type !== 'string') return undefined;

  return {
    type: written.type,
    code: written.code,
    message: written.message,
    stack: stackKind(written),
    cause: errorOutlineOf(written.cause),
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function stackKind({ type, message, stack }: Readonly<Record<string, unknown>>): ErrorOutline['stack'] {
  if (typeof stack !== 'string') return 'none';

  if (FIRST_FRAME.test(stack)) return 'frames';

  return stack.startsWith(`${String(type)}: ${String(message)}\n`) ? 'titled' : 'none';
}
