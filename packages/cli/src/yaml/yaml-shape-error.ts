/** A YAML text that is not as `toYaml` writes it: the reader of the kit takes no other. */
export class YamlShapeError extends Error {
  constructor(
    index: number,
    reason: string,
    readonly line = index + 1,
  ) {
    super(`line ${line}: ${reason}`);
    this.name = 'YamlShapeError';
  }
}
