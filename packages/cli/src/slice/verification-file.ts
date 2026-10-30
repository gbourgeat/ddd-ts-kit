import { KIT_FOLDER } from '../workspace/kit-folder';

/** Written by `verify-slice` in the worktree of a worker: its last verification, read by `status --workers` and `worker-scope --resume`. */
export const VERIFICATION_FILE = `${KIT_FOLDER}/verification.json`;
