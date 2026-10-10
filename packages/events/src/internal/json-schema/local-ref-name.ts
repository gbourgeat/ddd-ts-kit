const LOCAL_REF = /^#\/(?:\$defs|definitions)\/(.+)$/;

/** The name a local pointer (`#/$defs/Name`) designates, if it is one. */
export function localRefName(ref: unknown): string | undefined {
  return typeof ref === 'string' ? LOCAL_REF.exec(ref)?.[1] : undefined;
}
