/** The deviation that records a package added to an allow-list of the config. */
export function outsidePackageDeviation(list: string, name: string): Record<string, string> {
  return { what: `${list}.${name}`, adr: '0001', reason: 'Needed by the fixture.' };
}
