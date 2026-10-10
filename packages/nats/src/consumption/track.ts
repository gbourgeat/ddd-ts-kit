/** Keeps `work` in `set` for as long as it is pending. */
export function track(set: Set<Promise<void>>, work: Promise<void>): void {
  set.add(work);

  const done = (): void => {
    set.delete(work);
  };

  void work.then(done, done);
}
