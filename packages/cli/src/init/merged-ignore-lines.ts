/** The comment above the lines `init` adds to an ignore file of the team. */
const KIT_LINES = '# Lines of ddd-ts-kit init: the lines of the team, below, have the last word.';

/**
 * An ignore file of the team with the lines of the kit it lacks, put first under a comment, so that
 * the rules of the team, after them, keep the last word as git reads them (the last match wins).
 * A line of the kit on a path the team already writes rules for (`dist` where the team has
 * `dist/*` and `!dist/.gitkeep`) is left out: git cannot take back a file of a folder a line
 * ignores, whatever comes after it, so it would undo what the team decided.
 */
export function mergedIgnoreLines(team: string, kit: string): string {
  const lines = team.split('\n');
  const present = new Set(lines.map((line) => line.trim()));
  const decided = new Set(lines.filter(isRule).map(firstSegment));

  const missing = kit
    .split('\n')
    .filter((line) => isRule(line) && !present.has(line.trim()) && !decided.has(firstSegment(line)));

  if (missing.length === 0) {
    return team;
  }

  const [first, ...rest] = lines;

  return first === KIT_LINES
    ? [KIT_LINES, ...missing, ...rest].join('\n')
    : `${[KIT_LINES, ...missing].join('\n')}\n${team}`;
}

function isRule(line: string): boolean {
  return line.trim() !== '' && !line.trim().startsWith('#');
}

/** The first segment of the path a rule names: `dist` for `dist`, `/dist/`, `dist/*` and `!dist/.gitkeep`. */
function firstSegment(line: string): string {
  return line.trim().replace(/^!/, '').replace(/^\//, '').split('/')[0] ?? '';
}
