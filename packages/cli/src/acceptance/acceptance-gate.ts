/**
 * What a story is held to: `written`, before the code of its rows, every slice covered by a
 * scenario written and none left to write; `passing`, before the story closes, none pending
 * either.
 */
export type AcceptanceGate = 'written' | 'passing';

export const ACCEPTANCE_GATES: readonly AcceptanceGate[] = ['written', 'passing'];
