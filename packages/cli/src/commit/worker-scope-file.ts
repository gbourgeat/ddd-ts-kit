import { KIT_FOLDER } from '../workspace/kit-folder';

/** Written in the worktree of a worker: the one context it builds. Local to a worktree, never committed. */
export const WORKER_SCOPE_FILE = `${KIT_FOLDER}/worker.json`;
