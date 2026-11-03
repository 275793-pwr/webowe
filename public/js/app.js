// "PERF:" comments mark spots left unoptimized on purpose.
$('#year').text(new Date().getFullYear());
track('page_load');

// One request returns all posts (the server no longer needs an N+1 round of detail calls).
$.getJSON('/api/posts', function (list) {
  var html = list.map(function (p) {
    var date = moment(p.date).format('D MMMM YYYY');
    return '<div class="col-md-6"><div class="card h-100">' +
      '<img class="card-img-top" src="' + p.image + '" alt="">' +
      '<div class="card-body"><h5 class="card-title">' + p.title + '</h5>' +
      '<small class="text-muted"><i class="fa-regular fa-calendar"></i> ' + date + '</small>' +
      '<p class="card-text mt-2">' + p.body + '</p>' +
      '<small class="text-muted"><i class="fa-regular fa-image"></i> Zdjęcie: <a href="' + p.credit + '" target="_blank" rel="noopener">Pixabay</a></small>' +
      '</div></div></div>';
  }).join('');
  $('#posts').append(html);
});

// Animated footer: the gradient hue cycles and the glow follows the cursor.
var $footer = $('#glow-footer'), hue = 0, glowX = 50;

// PERF: setInterval + jQuery .css() rewrites the gradient and box-shadow every 30 ms,
// forcing a repaint of the footer each time; keeps running when the tab is hidden.
setInterval(function () {
  hue = (hue + 3) % 360;
  $footer.css('background',
    'linear-gradient(90deg, hsl(' + hue + ',100%,50%), hsl(' + (hue + 120) % 360 + ',100%,50%), hsl(' + (hue + 240) % 360 + ',100%,50%))');
  $footer.css('box-shadow', '0 0 ' + (20 + 20 * Math.sin(hue / 20)) + 'px hsl(' + hue + ',100%,60%) inset');
}, 30);

// PERF: mousemove is not throttled and recalculates the element rect on each event.
$footer.on('mousemove', function (e) {
  var r = this.getBoundingClientRect();
  glowX = (e.clientX - r.left) / r.width * 100;
  $footer.css('text-shadow', '0 0 12px #fff, ' + (glowX - 50) / 2 + 'px 0 20px #fff');
});
