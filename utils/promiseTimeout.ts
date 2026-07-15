/**
 * Race a promise against a wall-clock timeout.
 * Rejects with a clear Error when the timer wins.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'Operation'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Like withTimeout, but resolves to fallback instead of rejecting.
 */
export function withTimeoutFallback<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label = 'Operation'
): Promise<T> {
  return withTimeout(promise, ms, label).catch((error) => {
    if (import.meta.env.DEV) {
      console.warn(`[withTimeoutFallback] ${label}:`, error);
    }
    return fallback;
  });
}
