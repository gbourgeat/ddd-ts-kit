/** One parameter of the constructor of a command, past its actor: what a background job carries in its payload. */
export interface CommandInput {
  readonly name: string;
  /** As written; undefined when only a default value says it. */
  readonly type: string | undefined;
  /** Declared with `?` or given a default. */
  readonly optional: boolean;
}

const MODIFIERS = /^(?:(?:public|private|protected|readonly|override)\s+)+/;
const DECLARED = /^([A-Za-z_$][\w$]*)\s*(\?)?\s*(?::([^=]+))?(=.*)?$/s;

/** Reads `readonly calendarId: string`, `reason?: string` or `limit = 10` as the generator needs it. */
export function commandInputOf(parameter: string): CommandInput {
  const declared = DECLARED.exec(parameter.replace(MODIFIERS, '').trim());
  const type = declared?.[3]?.trim();

  return {
    name: declared?.[1] ?? parameter,
    type: type === '' ? undefined : type,
    optional: declared?.[2] !== undefined || declared?.[4] !== undefined,
  };
}
