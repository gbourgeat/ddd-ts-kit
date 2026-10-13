const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const LISTED_GLOB = /^\s+-\s+["']?([^"'\s]+)["']?\s*$/gm;

/**
 * A rule file of Claude Code as a path-specific instruction of GitHub Copilot: the same text,
 * its `paths` list turned into the one `applyTo` string Copilot reads, globs separated by commas.
 */
export function copilotInstruction(rule: string): string | undefined {
  const frontmatter = FRONTMATTER.exec(rule);
  const globs = [...(frontmatter?.[1] ?? '').matchAll(LISTED_GLOB)].flatMap(([, glob]) => (glob ? [glob] : []));

  if (frontmatter === null || globs.length === 0) {
    return undefined;
  }

  return `---\napplyTo: "${globs.join(',')}"\n---\n${rule.slice(frontmatter[0].length)}`;
}
