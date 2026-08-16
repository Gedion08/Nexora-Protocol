import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry, withTimeout, OperationTimeoutError, MAX_RETRIES, RETRY_BACKOFF_MS } from '../src/utils/retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should stop retrying on non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('invalid arg'));

    await expect(withRetry(
      fn, 
      { maxRetries: 3, baseDelayMs: 10 },
      (error) => error.message !== 'invalid arg'
    )).rejects.toThrow('invalid arg');
    
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('withTimeout', () => {
  it('should return result before timeout', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withTimeout(fn, 1000, 'timed out');
    expect(result).toBe('success');
  });

  it('should throw OperationTimeoutError after timeout', async () => {
    const fn = vi.fn().mockImplementation(() => new Promise(() => {}));

    const promise = withTimeout(fn, 100, 'custom timeout message');
    
    try {
      await promise;
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('custom timeout message');
    }
  });
});

describe('OperationTimeoutError', () => {
  it('should create error with message', () => {
    const error = new OperationTimeoutError(5000);
    expect(error.message).toBe('Operation timed out after 5000ms');
    expect(error.timeoutMs).toBe(5000);
    expect(error.name).toBe('OperationTimeoutError');
  });
});
