/**
 * Global concurrency semaphore + FIFO request queue for the Gatekeeper.
 *
 * Layer 2 of the protection system:
 *   - MAX_CONCURRENT_GATEKEEPER (default 3) requests in-flight at once
 *   - Excess requests queue and are forwarded when a slot opens (FIFO, fair)
 *   - MAX_QUEUE_SIZE (default 10) maximum pending requests; beyond that → 429
 *   - QUEUE_TIMEOUT_MS (default 20 000) wait limit per queued request → 503
 *
 * This is in-memory because the api-server is a persistent Node.js process.
 * A Redis-backed approach would be needed only for multiple server instances.
 */

export const MAX_SLOTS = Number(process.env.MAX_CONCURRENT_GATEKEEPER ?? 3);
export const MAX_QUEUE = Number(process.env.MAX_QUEUE_SIZE ?? 10);
export const TIMEOUT_MS = Number(process.env.QUEUE_TIMEOUT_MS ?? 20_000);

// ─── Custom errors ─────────────────────────────────────────────────────────────

export class QueueFullError extends Error {
  constructor() {
    super('Request queue is full. Mesurado is at capacity. Please retry in a few seconds.');
    this.name = 'QueueFullError';
  }
}

export class QueueTimeoutError extends Error {
  constructor() {
    super('Request waited too long in queue and was dropped.');
    this.name = 'QueueTimeoutError';
  }
}

export class QueueClearedError extends Error {
  constructor() {
    super('Queue was administratively cleared.');
    this.name = 'QueueClearedError';
  }
}

// ─── Queue item ────────────────────────────────────────────────────────────────

interface QueueItem {
  resolve: () => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

// ─── GatekeeperQueue class ─────────────────────────────────────────────────────

class GatekeeperQueue {
  private slots = 0;
  private queue: QueueItem[] = [];

  /**
   * Acquire a concurrency slot.
   *
   * Returns a `release` function that MUST be called (even on error) to free
   * the slot and unblock the next queued request.
   *
   * Throws:
   *   QueueFullError   — if the queue is already at MAX_QUEUE
   *   QueueTimeoutError — if the request waited longer than TIMEOUT_MS
   *   QueueClearedError — if an admin cleared the queue while waiting
   */
  async acquire(): Promise<() => void> {
    if (this.slots < MAX_SLOTS) {
      this.slots++;
      return this.makeRelease();
    }

    if (this.queue.length >= MAX_QUEUE) {
      throw new QueueFullError();
    }

    return new Promise<() => void>((resolve, reject) => {
      let settled = false;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      const timeoutHandle = setTimeout(() => {
        settle(() => {
          const idx = this.queue.findIndex(q => q.resolve === onSlotReady);
          if (idx !== -1) this.queue.splice(idx, 1);
          reject(new QueueTimeoutError());
        });
      }, TIMEOUT_MS);

      const onSlotReady = () => {
        settle(() => {
          clearTimeout(timeoutHandle);
          this.slots++;
          resolve(this.makeRelease());
        });
      };

      this.queue.push({
        resolve: onSlotReady,
        reject: (err) => {
          settle(() => {
            clearTimeout(timeoutHandle);
            reject(err);
          });
        },
        enqueuedAt: Date.now(),
        timeoutHandle,
      });
    });
  }

  /** Build a one-shot release function bound to this acquisition. */
  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.slots = Math.max(0, this.slots - 1);
      this.drain();
    };
  }

  /** Promote the oldest queued request when a slot opens. */
  private drain(): void {
    while (this.queue.length > 0 && this.slots < MAX_SLOTS) {
      const next = this.queue.shift()!;
      next.resolve();
    }
  }

  // ─── Admin helpers ──────────────────────────────────────────────────────────

  /** Current state snapshot (safe to serialise to JSON for admin API). */
  status() {
    return {
      activeSlots: this.slots,
      maxSlots: MAX_SLOTS,
      queueLength: this.queue.length,
      maxQueueSize: MAX_QUEUE,
      timeoutMs: TIMEOUT_MS,
      queuedRequests: this.queue.map((q, i) => ({
        position: i + 1,
        waitingMs: Date.now() - q.enqueuedAt,
      })),
    };
  }

  /**
   * Drain all pending queue entries, rejecting each with QueueClearedError.
   * Returns the number of requests dropped.
   */
  clearQueue(): number {
    const count = this.queue.length;
    const items = this.queue.splice(0);
    for (const item of items) {
      clearTimeout(item.timeoutHandle);
      item.reject(new QueueClearedError());
    }
    return count;
  }
}

// Singleton — shared across all requests in this process
export const gatekeeperQueue = new GatekeeperQueue();
