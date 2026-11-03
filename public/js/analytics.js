// Stand-in for a third-party tag. Loaded after window "load" (see index.html), so it no longer
// blocks parsing; the 100 ms busy-wait was removed.
(function () {
  window.track = function (e) {
    // sendBeacon is asynchronous and survives page unload; fall back to fetch keepalive.
    var body = JSON.stringify({ e: e, t: Date.now() });
    if (!(navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' })))) {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
    }
  };
  // Flush events queued before the tag was loaded.
  (window.__trackQ || []).forEach(function (q) { window.track(q[0]); });
  window.__trackQ = [];
})();
