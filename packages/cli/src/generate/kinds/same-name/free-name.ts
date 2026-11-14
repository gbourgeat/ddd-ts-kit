import type { Name } from '../../../naming';
import { capitalize } from '../../../naming/capitalize';

/** The numbers tried after the two names that read well: a schema index never holds that many tables of one name. */
const SUFFIXES = Array.from({ length: 98 }, (_, index) => index + 2);

/**
 * The name a table bears in the schema index when another holds its own: the one of its context
 * first, `shippingOrders`. That name may be held too, by the table `shipping_orders` of any context
 * or by the schema constant of the context (`shippingSchema`): a name that hides another would
 * compile, and the table it hides would never be created. The first free one is taken, of
 * `shippingOrders`, `shippingContextOrders`, then `shippingOrders2` and on.
 */
export function freeName(context: Name, constant: string, isTaken: (name: string) => boolean): string {
  const qualified = `${context.camel}${capitalize(constant)}`;

  const candidates = [
    qualified,
    `${context.camel}Context${capitalize(constant)}`,
    ...SUFFIXES.map((suffix) => `${qualified}${suffix}`),
  ];

  return candidates.find((candidate) => !isTaken(candidate)) ?? qualified;
}
