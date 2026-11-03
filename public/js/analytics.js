// Stand-in for a third-party tag.
// PERF: loaded synchronously in <head> and busy-waits ~100 ms at startup, blocking parsing.
(function () {
  var start = Date.now();
  while (Date.now() - start < 100) { Math.sqrt(Math.random()); }
  window.track = function (e) {
    // sendBeacon is asynchronous and survives page unload; fall back to fetch keepalive.
    var body = JSON.stringify({ e: e, t: Date.now() });
    if (!(navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' })))) {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
    }
  };
})();
