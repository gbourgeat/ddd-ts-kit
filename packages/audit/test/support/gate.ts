/** A promise that resolves when `open` is called: what orders the steps of two concurrent units of work. */
export function gate(): { readonly opened: Promise<void>; open(): void } {
  let open: () => void = () => undefined;

  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { opened, open: () => open() };
}
