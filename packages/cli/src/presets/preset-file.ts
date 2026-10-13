/** One file a preset writes into its context. */
export interface PresetFile {
  /** Under `templates/presets/<name>/`. */
  readonly template: string;
  /** Under the directory of the context. */
  readonly target: string;
  /**
   * Written after the generators of the preset ran, over what they wrote: the files a generator
   * keeps adding to (the tables of the context), which the preset then lays out whole.
   */
  readonly afterSteps?: boolean;
}
