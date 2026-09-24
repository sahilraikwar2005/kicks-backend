import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StepBatcher } from './stepBatcher.js';

// Framework-free queue tests: no DOM, no React, real short timers.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const makeBatcher = (calls, { windowMs = 25, failWith = null } = {}) => new StepBatcher({
  windowMs,
  onFlush: async (key, delta) => {
    calls.push({ key, delta });
    if (failWith) throw failWith;
  },
  onError: (key, delta, error) => {
    calls.push({ key, delta, errored: error });
  },
});

describe('StepBatcher', () => {
  it('batches rapid + clicks into one flush', async () => {
    const calls = [];
    const batcher = makeBatcher(calls);
    batcher.push('UK7', 1);
    batcher.push('UK7', 1);
    batcher.push('UK7', 1);
    batcher.push('UK7', 1);
    await sleep(80);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { key: 'UK7', delta: 4 });
    batcher.dispose();
  });

  it('batches rapid - clicks into one flush', async () => {
    const calls = [];
    const batcher = makeBatcher(calls);
    batcher.push('UK7', -1);
    batcher.push('UK7', -1);
    batcher.push('UK7', -1);
    await sleep(80);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { key: 'UK7', delta: -3 });
    batcher.dispose();
  });

  it('nets mixed clicks (++- sends +1)', async () => {
    const calls = [];
    const batcher = makeBatcher(calls);
    batcher.push('UK7', 1);
    batcher.push('UK7', 1);
    batcher.push('UK7', -1);
    await sleep(80);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { key: 'UK7', delta: 1 });
    batcher.dispose();
  });

  it('zero net (++--) never hits the network', async () => {
    const calls = [];
    const batcher = makeBatcher(calls);
    batcher.push('UK7', 1);
    batcher.push('UK7', 1);
    batcher.push('UK7', -1);
    batcher.push('UK7', -1);
    await sleep(80);
    assert.equal(calls.length, 0);
    assert.equal(batcher.pending('UK7'), 0);
    batcher.dispose();
  });

  it('variants keep independent queues', async () => {
    const calls = [];
    const batcher = makeBatcher(calls);
    batcher.push('UK7', 1);
    batcher.push('UK7', 1);
    batcher.push('UK7', 1);
    batcher.push('UK8', 1);
    batcher.push('UK8', -1);
    await sleep(80);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { key: 'UK7', delta: 3 });
    assert.equal(batcher.pending('UK8'), 0);
    batcher.dispose();
  });

  it('sequential bursts flush separately', async () => {
    const calls = [];
    const batcher = makeBatcher(calls);
    batcher.push('UK7', 1);
    batcher.push('UK7', 1);
    await sleep(80);
    batcher.push('UK7', 1);
    await sleep(80);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((call) => call.delta), [2, 1]);
    batcher.dispose();
  });

  it('clicks during flight flush as a second batch, never overwriting', async () => {
    const calls = [];
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const batcher = new StepBatcher({
      windowMs: 25,
      onFlush: async (key, delta) => {
        calls.push({ key, delta });
        await gate;
      },
    });
    batcher.push('UK7', 1);
    batcher.push('UK7', 1);
    batcher.push('UK7', 1);
    await sleep(60);
    assert.equal(calls.length, 1);
    batcher.push('UK7', 1);
    batcher.push('UK7', 1);
    release();
    await sleep(120);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((call) => call.delta), [3, 2]);
    batcher.dispose();
  });

  it('failed flush reports the failed delta for rollback', async () => {
    const flushCalls = [];
    const errorCalls = [];
    const failure = new Error('Insufficient stock');
    failure.status = 409;
    const batcher = new StepBatcher({
      windowMs: 25,
      onFlush: async (key, delta) => {
        flushCalls.push({ key, delta });
        throw failure;
      },
      onError: (key, delta, error) => {
        errorCalls.push({ key, delta, error });
      },
    });
    batcher.push('UK7', -5);
    await sleep(80);
    assert.equal(flushCalls.length, 1);
    assert.deepEqual(flushCalls[0], { key: 'UK7', delta: -5 });
    assert.equal(errorCalls.length, 1);
    assert.equal(errorCalls[0].delta, -5);
    assert.equal(errorCalls[0].error, failure);
    batcher.dispose();
  });

  it('isActive tracks pending and in-flight keys only', async () => {
    const calls = [];
    const batcher = makeBatcher(calls);
    assert.equal(batcher.isActive('UK7'), false);
    batcher.push('UK7', 1);
    assert.equal(batcher.isActive('UK7'), true);
    await sleep(80);
    assert.equal(batcher.isActive('UK7'), false);
    batcher.dispose();
  });
});
