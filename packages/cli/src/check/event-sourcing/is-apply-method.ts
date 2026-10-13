const APPLY = /^apply[A-Z]/;

/** An apply method changes the state for one event; `restore` takes the state of a snapshot. */
export function isApplyMethod(name: string): boolean {
  return APPLY.test(name) || name === 'restore';
}
