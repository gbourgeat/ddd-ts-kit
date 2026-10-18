/** The name proposed for a factory without a prefix: `calendar` reads `forCalendar`. */
export function prefixedName(name: string): string {
  return `for${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}
