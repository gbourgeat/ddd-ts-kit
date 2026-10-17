/** The lines of what a command printed, without blank ones; none when it printed nothing or failed. */
export function linesOf(output: string | undefined): string[] {
  return (output ?? '').split('\n').filter((line) => line.trim() !== '');
}
