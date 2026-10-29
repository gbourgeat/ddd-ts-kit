/** An ignore file of the team with the lines of the kit it lacks appended, in their order; its own lines kept as they are. */
export function mergedIgnoreLines(team: string, kit: string): string {
  const present = new Set(team.split('\n').map((line) => line.trim()));
  const missing = kit.split('\n').filter((line) => line.trim() !== '' && !present.has(line.trim()));

  if (missing.length === 0) {
    return team;
  }

  return `${team}${team.endsWith('\n') || team === '' ? '' : '\n'}${missing.join('\n')}\n`;
}
