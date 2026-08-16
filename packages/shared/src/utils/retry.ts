export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

export class RetryableError extends Error {
  readonly attempt: number;
  readonly maxRetries: number;

  constructor(message: string, attempt: number, maxRetries: number) {
    super(message);
    this.name = 'RetryableError';
    this.attempt = attempt;
    this.maxRetries = maxRetries;
  }
}

export class OperationTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string) {
    super(message ?? `Operation timed out after ${timeoutMs}ms`);
    this.name = 'OperationTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  shouldRetry?: (error: Error) => boolean
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs = 30_000, timeoutMs } = options;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (timeoutMs && Date.now() - startTime > timeoutMs) {
      throw new OperationTimeoutError(timeoutMs);
    }

    try {
      return await operation();
    } catch (error) {
      const err = error as Error;
      if (attempt === maxRetries) {
        throw err;
      }

      const retryable = shouldRetry ? shouldRetry(err) : true;
      if (!retryable) {
        throw err;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      await sleep(delay);
    }
  }

  throw new Error('Unreachable');
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new OperationTimeoutError(timeoutMs, message)),
        timeoutMs
      )
    ).catch((err) => {
      if (err instanceof OperationTimeoutError) {
        throw err;
      }
      throw err;
    }),
  ]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
