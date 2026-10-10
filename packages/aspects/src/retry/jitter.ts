/** Turns the computed delay before a retry into the one that is waited. */
export type Jitter = (delayMs: number, attempt: number) => number;
