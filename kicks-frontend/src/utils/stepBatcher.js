// Per-variant rapid-click batcher for admin inventory steppers.
//
// Clicks accumulate per variant key and flush as ONE delta after a short
// quiet window. Only one flight per key is ever in flight, so a stale
// response can never overwrite newer optimistic state — reconciliation only
// ever applies deltas, never absolute values.
export const STEP_BATCH_WINDOW_MS = 400;

export class StepBatcher {
  constructor({ windowMs = STEP_BATCH_WINDOW_MS, onFlush, onError } = {}) {
    this.windowMs = windowMs;
    this.onFlush = onFlush;
    this.onError = onError;
    this.queues = new Map();
  }

  keys() {
    return [...this.queues.keys()];
  }

  pending(key) {
    return this.queues.get(String(key))?.pending || 0;
  }

  isActive(key) {
    const queue = this.queues.get(String(key));
    return Boolean(queue && (queue.pending !== 0 || queue.flushing || queue.timer));
  }

  push(key, delta) {
    const id = String(key);
    let queue = this.queues.get(id);
    if (!queue) {
      queue = { pending: 0, timer: null, flushing: false };
      this.queues.set(id, queue);
    }
    queue.pending += delta;
    if (queue.timer) clearTimeout(queue.timer);
    queue.timer = setTimeout(() => this.flush(id), this.windowMs);
    return queue.pending;
  }

  async flush(key) {
    const id = String(key);
    const queue = this.queues.get(id);
    if (!queue || queue.flushing) return null;
    if (!queue.pending) {
      queue.timer = null;
      return null;
    }
    const delta = queue.pending;
    queue.pending = 0;
    queue.timer = null;
    queue.flushing = true;
    try {
      const result = await this.onFlush?.(id, delta);
      return result ?? null;
    } catch (error) {
      this.onError?.(id, delta, error);
      return null;
    } finally {
      queue.flushing = false;
      // Clicks that landed mid-flight stay queued and flush next.
      if (queue.pending !== 0 && !queue.timer) {
        queue.timer = setTimeout(() => this.flush(id), this.windowMs);
      }
    }
  }

  dispose() {
    for (const queue of this.queues.values()) {
      if (queue.timer) clearTimeout(queue.timer);
      queue.timer = null;
    }
  }
}
