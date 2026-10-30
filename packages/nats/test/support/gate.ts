/** A promise the test resolves when it wants, to hold a handler where it needs it. */
export function gate(): { readonly opened: Promise<void>; open(): void } {
  let open = (): void => undefined;

  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { opened, open };
}
