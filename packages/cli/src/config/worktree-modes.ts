/** How the guard of the plugin keeps the code out of the main checkout of the trunk: refuse it there, or only say so. */
export const WORKTREE_MODES = ['required', 'advised'] as const;
