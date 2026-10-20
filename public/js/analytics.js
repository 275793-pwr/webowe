// Stand-in for a third-party tag.
// PERF: loaded synchronously in <head> and busy-waits ~100 ms at startup, blocking parsing.
(function () {
  var start = Date.now();
  while (Date.now() - start < 100) { Math.sqrt(Math.random()); }
  window.track = function (e) {
    // PERF: synchronous XHR blocks the main thread; use navigator.sendBeacon instead.
    var x = new XMLHttpRequest();
    x.open('POST', '/api/track', false);
    x.setRequestHeader('Content-Type', 'application/json');
    x.send(JSON.stringify({ e: e, t: Date.now() }));
  };
})();
