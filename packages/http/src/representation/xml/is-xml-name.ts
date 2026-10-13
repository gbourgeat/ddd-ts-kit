const NAME = /^[\p{L}_][\p{L}\p{N}._-]*$/u;

/** Whether a property name can be written as the name of an element as it is: no colon, no space, no leading digit. */
export function isXmlName(name: string): boolean {
  return NAME.test(name);
}
