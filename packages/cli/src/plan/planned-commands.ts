/** A generator command of a `Start with` cell, between backquotes, with or without `npx ddd-ts-kit` before it. */
const COMMAND = /`(?:npx ddd-ts-kit )?(?:generate|g) ([^`]+)`/g;

/** A word of a command line, as a shell reads it: characters without a space, quoted texts included. */
const WORD = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;

const QUOTED = /"([^"]*)"|'([^']*)'/g;

/** A generator command of a row: as the row writes it, and as the arguments that follow `generate`. */
export interface PlannedCommand {
  /** `generate aggregate billing Invoice`, as the row writes it, without `npx ddd-ts-kit` and with `g` written `generate`. */
  readonly text: string;
  /** `['aggregate', 'billing', 'Invoice']`, the quotes removed as a shell removes them. */
  readonly argv: readonly string[];
}

/** The generator commands a `Start with` cell holds, in its order; none for a cell that runs no generator (`none: ...`). */
export function plannedCommands(startWith: string): PlannedCommand[] {
  return [...startWith.matchAll(COMMAND)].map(([, line = '']) => ({
    text: `generate ${line}`,
    argv: [...line.matchAll(WORD)].map(([word]) => word.replace(QUOTED, '$1$2')),
  }));
}
