export function replayHint(seed: number): string {
  return `Generated data seed: ${seed}. Replay this file with TEST_SEED=${seed}.`;
}
