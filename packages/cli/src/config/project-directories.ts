/** The directories of the config, where the generators write: each one inside the project, relative to its root. */
export const PROJECT_DIRECTORIES = ['sourceRoot', 'contextsDir', 'sharedKernelDir', 'platformDir'] as const;

export type ProjectDirectory = (typeof PROJECT_DIRECTORIES)[number];
