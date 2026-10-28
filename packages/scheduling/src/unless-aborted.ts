/** A job that ignores its signal is left behind: the run ends when the signal is aborted, with its reason. */
export function unlessAborted<T>(signal: AbortSignal, work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    signal.addEventListener(
      'abort',
      () => {
        reject(reasonOf(signal));
      },
      { once: true },
    );

    work.then(resolve, reject);
  });
}

function reasonOf(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;

  return reason instanceof Error ? reason : new Error('The run was aborted.');
}
