// timer.js — Web-Worker-backed timer globals (loaded first, before all other
// scripts, see index.html).
//
// Every timer in the app — and in third-party scripts that run after this
// one — now schedules through scripts/timer-worker.js instead of the main
// thread. The worker owns the real timers and posts a "tick" for each
// firing; the worker-timer below re-runs the original callback on the main
// thread so it can still touch the DOM / YouTube player, with the exact
// native timer contract:
//   * `this` is the global object, and
//   * any extra `arg1..arg3` arguments are forwarded to the callback.
//
// This is what makes the existing `this.xxxTimerId = workerSetInterval(...)` /
// `workerClearInterval(this.xxxTimerId)` call sites and the argument-forwarding
// call sites (e.g. `reduceVolumeForFadeOut(tenPercentVol)`,
// `setGuessAsFinished(secondsRemaining)`) keep working unchanged.
(function (globalScope) {
  'use strict';

  const worker = new Worker('scripts/timer-worker.js');
  const pending = new Map();

  let handleSeq = 0;
  let ticking = false;
  let ticks = [];

  // `worker.onmessage` is invoked by the browser with `this` bound to the
  // worker scope, NOT the page global; so everything here is captured via
  // lexical scope instead of `this`. `globalScope` is the page global
  // object (`this` at install time — `window` in a classic script), and
  // the callbacks are re-invoked with exactly that binding.
  worker.onmessage = (event) => {
    const { type, handle } = event.data;
    if (type !== 'tick') {
      return;
    }

    if (!pending.has(handle)) {
      return; // Already cleared before its tick arrived.
    }

    ticks.push(handle);
    if (!ticking) {
      ticking = true;
      queueMicrotask(drainTicks);
    }
  };

  function drainTicks() {
    ticking = false;
    const batch = ticks;
    ticks = [];

    for (const handle of batch) {
      const entry = pending.get(handle);
      if (!entry) {
        continue; // Cleared since the tick was queued.
      }
      if (!entry.interval) {
        pending.delete(handle);
      }

      const entryArg1 = entry.arg1;
      const entryArg2 = entry.arg2;
      const entryArg3 = entry.arg3;
      const cb = entry.callback;

      if (typeof cb === 'function') {
        // Native contract: timers are invoked as globals with `this` = the
        // global object, and extra args forwarded.
        cb.call(globalScope, entryArg1, entryArg2, entryArg3);
      } else if (typeof cb === 'string') {
        // Native contract: string code is evaluated as if in global scope.
        (0, eval)(cb);
      }
    }
  }

  function schedule(callback, delay, arg1, arg2, arg3, interval) {
    const handle = ++handleSeq;

    pending.set(handle, {
      callback,
      interval: !!interval,
      arg1,
      arg2,
      arg3
    });

    // The worker assigns this exact handle to the Nth schedule message,
    // so return it synchronously (no round-trip wait).
    worker.postMessage({ type: 'schedule', handle, delay, interval });

    return handle;
  }

  globalScope.workerSetTimeout= function (callback, delay, arg1, arg2, arg3) {
    return schedule(callback, delay, arg1, arg2, arg3, false);
  };

  globalScope.workerSetInterval = function (callback, delay, arg1, arg2, arg3) {
    return schedule(callback, delay, arg1, arg2, arg3, true);
  };

  // `this` in every call site resolves to the global object in this app,
  // but we don't rely on it — we just clear the handle.
  function clear(handle) {
    if (handle === undefined || handle === null) {
      return;
    }
    pending.delete(handle);
    worker.postMessage({ type: 'cancel', handle });
  }
  globalScope.workerClearTimeout = clear;
  globalScope.workerClearInterval = clear;
})(this);
