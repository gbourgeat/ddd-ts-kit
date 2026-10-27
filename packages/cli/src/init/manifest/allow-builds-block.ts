/** The lines of the `allowBuilds:` block of pnpm-workspace.yaml, undefined when the file has none. */
export function allowBuildsBlock(text: string): string | undefined {
  return /^allowBuilds:\n((?:[ \t]+.*\n?|\n)*)/m.exec(text)?.[1];
}
