import { eventually, type EventuallyOptions } from './eventually';

/**
 * Waits until the condition holds, for outcomes seen from the outside (a counter, a list): the
 * same polling as `eventually`, the condition returns a boolean instead of asserting.
 */
export async function until(
  condition: () => boolean | Promise<boolean>,
  options: EventuallyOptions = {},
): Promise<void> {
  await eventually(async () => {
    if (!(await condition())) {
      throw new Error('The condition was not met');
    }
  }, options);
}
