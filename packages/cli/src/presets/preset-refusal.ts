/** Why a preset is not written, and what to change for it to be. */
export interface PresetRefusal {
  readonly message: string;
  readonly fix: string;
}
