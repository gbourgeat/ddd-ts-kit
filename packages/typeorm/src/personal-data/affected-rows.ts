/** The rows a statement reached, as the driver counts them: a driver that does not count answers none. */
export function affectedRows({ affected }: { readonly affected?: number | null }): number {
  return affected ?? 0;
}
