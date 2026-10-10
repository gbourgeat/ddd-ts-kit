/** `reason` is a stable machine code (`NO_MATCHING_ROLE`), never a sentence and never data. */
export type Decision = { readonly allowed: true } | { readonly allowed: false; readonly reason: string };

export const ALLOWED: Decision = Object.freeze({ allowed: true });

export function deny(reason: string): Decision {
  return { allowed: false, reason };
}
