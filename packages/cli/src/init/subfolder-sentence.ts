/** What the project writes that a tool reads at the top of the git repository only. */
const ROOT_ONLY_FILES = '.github/ (the workflows and dependabot.yml), .gitlab-ci.yml and lefthook.yml';

/**
 * The files GitHub, GitLab and lefthook read at the top of the repository only, and where the install
 * permissions belong, for a project that lives in a folder of a larger repository (a monorepo).
 */
export function subfolderSentence(folder: string, manager: string): string {
  const workspace =
    manager === 'pnpm'
      ? ' pnpm reads allowBuilds and strictDepBuilds in the pnpm-workspace.yaml of the workspace root: put them there, the one in this folder is not read from the root.'
      : '';

  return `${ROOT_ONLY_FILES} are read at the top of the git repository only, so the copies in ${folder} never run there: move them to the top (GitHub jobs then need working-directory: ${folder}), or run the checks and hooks from this folder yourself.${workspace}`;
}
