/** What the work rejected with, or `undefined` when it went through. */
export async function failureOf(work: () => Promise<unknown>): Promise<unknown> {
  try {
    await work();
  } catch (error) {
    // A thrown `undefined` would read as "no failure".
    return error ?? new Error('rejected without a reason');
  }

  return undefined;
}
