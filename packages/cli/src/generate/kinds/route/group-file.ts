/** Where a route group is written, inside its context and without extension: `presentation/http/appointments.routes`. */
export function groupFile(kebab: string): string {
  return `presentation/http/${kebab}.routes`;
}
