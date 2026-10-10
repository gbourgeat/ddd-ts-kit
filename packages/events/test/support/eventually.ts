export async function eventually(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error('The condition was not met in time');
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
