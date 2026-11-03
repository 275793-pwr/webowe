// Stand-in for a third-party tag. Loaded after window "load" (see index.html), so it no longer
// blocks parsing; the 100 ms busy-wait was removed.
// PERF: synchronous XHR blocks the main thread; use navigator.sendBeacon instead.
(function () {
  window.track = function (e) {
    var x = new XMLHttpRequest();
    x.open('POST', '/api/track', false);
    x.setRequestHeader('Content-Type', 'application/json');
    x.send(JSON.stringify({ e: e, t: Date.now() }));
  };
  // Flush events queued before the tag was loaded.
  (window.__trackQ || []).forEach(function (q) { window.track(q[0]); });
  window.__trackQ = [];
})();
