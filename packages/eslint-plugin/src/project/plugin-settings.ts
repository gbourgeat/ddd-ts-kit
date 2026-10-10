/** `settings['ddd-ts-kit']`: lets a test or an editor inject what is otherwise read from disk. */
export interface PluginSettings {
  readonly config?: unknown;
  readonly rootDir?: string;
  /** Posix path relative to the project root, used instead of the real file name. */
  readonly filename?: string;
}
