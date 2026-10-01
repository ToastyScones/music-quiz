// timer-worker.js
//
// Web Worker that owns all timers so that no timer ever fires from the
// main thread.
//
// The main thread (scripts/timer.js) delegates every timer to this worker.
// The real browser timers (setTimeout/setInterval) live here, and the main
// thread receives a "tick" for every firing so it can re-run the original
// callback. This keeps callback evaluation on the main thread (required for
// DOM / YouTube player access) while the timer *scheduling and firing* are
// worker-driven and immune to main-thread tab throttling.
//
// Message protocol:
//   main -> worker: { type: 'schedule', handle, delay, interval }
//   main -> worker: { type: 'cancel',   handle }
//   worker -> main: { type: 'tick',     handle }  (one per pending firing)

let nextHandle = 0;
const timers = new Map();

self.onmessage = (event) => {
  const { type, handle, delay, interval } = event.data;

  if (type === 'schedule') {
    // `handle` is assigned by the main thread; the Nth schedule message
    // becomes handle N on both sides, so the main thread can issue its
    // return value synchronously without waiting for this worker.
    const fire = () => {
      self.postMessage({ type: 'tick', handle });
    };

    if (interval) {
      // A 0 / negative / NaN period is clamped to a 1ms period.
      const workerId = setInterval(fire, Math.max(delay || 0, 1));
      timers.set(handle, { workerId, interval: true });
    } else if (delay <= 0) {
      // Mirror native 0ms timeouts: queue the firing as a macrotask
      // rather than waiting.
      fire();
    } else {
      const workerId = setTimeout(fire, delay);
      timers.set(handle, { workerId, interval: false });
    }
    return;
  }

  if (type === 'cancel') {
    const timer = timers.get(handle);
    if (!timer) {
      return;
    }
    if (timer.interval) {
      clearInterval(timer.workerId);
    } else {
      clearTimeout(timer.workerId);
    }
    timers.delete(handle);
  }
};
