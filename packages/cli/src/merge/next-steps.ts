/** What `next:` says after each outcome of merge-trunk. */
export const NEXT_STEPS = {
  upToDate: 'nothing to merge: the branch already holds the trunk',
  dryRun: 'run the same command without --dry-run to start the merge',
  resolve: 'resolve each hunk, `git add <file>`, then `npx ddd-ts-kit merge-trunk --continue`',
  confirmBase:
    'nothing was changed. Confirm the base: `npx ddd-ts-kit merge-trunk --since <commit>`, the newest commit of this branch the trunk holds, once the lines above are found on the trunk or are decided',
  migrations: 'do what the migrations step says, then `npx ddd-ts-kit merge-trunk --continue` (or `--abort`)',
  install: 'fix the install (its output above), then `npx ddd-ts-kit merge-trunk --continue`',
  regenerate:
    'fix what makes `npm run regenerate` fail (its output above), then `npx ddd-ts-kit merge-trunk --continue`',
  lostLines:
    'restore them (`git show ORIG_HEAD:<file>`), then `npx ddd-ts-kit merge-trunk --continue`; a deliberate removal: `--continue --accept-lost` (recorded in the merge commit)',
  leftOut:
    'stage each path that belongs to the merge (`git add`), move the others aside, then `npx ddd-ts-kit merge-trunk --continue`',
  commit: 'fix what git refused (above), then `npx ddd-ts-kit merge-trunk --continue`',
  committed: '`npm run verify` in this worktree, then push',
  landed: '`npm run verify` in this worktree, push, then squash-merge the pull request',
} as const;
