/** The folder of the project where the kit keeps its own working files, ignored by git and never committed. */
export const KIT_FOLDER = '.ddd-ts-kit';

/** The lock a generator that writes the shared files holds while it runs. */
export const LOCK_FOLDER = `${KIT_FOLDER}/lock`;
