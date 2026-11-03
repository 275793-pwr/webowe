// Vanilla JS: jQuery, moment.js and the Bootstrap bundle are not needed.
// "PERF:" comments mark spots left for the other optimizations.
document.getElementById('year').textContent = new Date().getFullYear();
track('page_load');

// Navbar toggle (the only Bootstrap JS feature that was used).
var toggler = document.querySelector('.navbar-toggler');
toggler.addEventListener('click', function () {
  var open = document.getElementById('nav').classList.toggle('show');
  toggler.setAttribute('aria-expanded', open);
});

var dateFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
var ICON_CAL = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1h1.5v1.5h5V1H12v1.5h1.5a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1H4zM3 6v7.5h10V6z" fill="currentColor"/></svg>';
var ICON_IMG = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm1 1.5v6.2l2.5-2.7 2 2 2.5-3L13 9.9V3.5zm2 .8a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" fill="currentColor" fill-rule="evenodd"/></svg>';

function getJSON(url) { return fetch(url).then(function (r) { return r.json(); }); }

function renderPost(p, first) {
  var card = document.createElement('article');
  card.className = 'card';
  card.innerHTML =
    '<img class="card-img-top" alt="" decoding="async">' +
    '<div class="card-body"><h5 class="card-title"></h5>' +
    '<small class="text-muted">' + ICON_CAL + ' <span class="date"></span></small>' +
    '<p class="card-text"></p>' +
    '<small class="text-muted">' + ICON_IMG + ' Zdjęcie: <a target="_blank" rel="noopener">Pixabay</a></small>' +
    '</div>';
  // textContent / attributes instead of HTML string concatenation: post data cannot inject markup.
  var img = card.querySelector('img');
  if (!first) img.loading = 'lazy';
  img.src = p.image;
  card.querySelector('.card-title').textContent = p.title;
  card.querySelector('.date').textContent = dateFmt.format(new Date(p.date));
  card.querySelector('.card-text').textContent = p.body;
  card.querySelector('a').href = p.credit;
  document.getElementById('posts').appendChild(card);
}

// One request returns all posts (the server no longer needs an N+1 round of detail calls).
getJSON('/api/posts').then(function (list) {
  list.forEach(function (p, i) { renderPost(p, i === 0); });
});

// Footer glow: the hue animation is pure CSS; JS only pauses it off-screen / in hidden tabs
// and feeds the cursor position to a CSS variable (throttled to one update per frame).
var footer = document.getElementById('glow-footer'), visible = true;
function syncAnimation() { footer.classList.toggle('paused', !visible || document.hidden); }
if ('IntersectionObserver' in window) {
  new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; syncAnimation(); }).observe(footer);
}
document.addEventListener('visibilitychange', syncAnimation);

var rect = null, pending = false, mouseX = 0;
footer.addEventListener('mouseenter', function () { rect = footer.getBoundingClientRect(); });  // cached rect
footer.addEventListener('mousemove', function (e) {
  mouseX = e.clientX;
  if (pending) return;
  pending = true;
  requestAnimationFrame(function () {
    pending = false;
    if (!rect) rect = footer.getBoundingClientRect();
    footer.style.setProperty('--glow', ((mouseX - rect.left) / rect.width * 100).toFixed(1));
  });
});
