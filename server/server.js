// Minimal blog backend. "PERF:" comments mark spots left unoptimized on purpose.
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const zlib = require('zlib');

// Compression: Brotli/gzip for text responses (HTML, CSS, JS, JSON, SVG), no extra dependency.
const COMPRESSIBLE = /text|json|javascript|svg|xml/;
app.use((req, res, next) => {
  const ae = req.headers['accept-encoding'] || '';
  const enc = /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : null;
  if (!enc) return next();
  res.append('Vary', 'Accept-Encoding');
  const write = res.write.bind(res), end = res.end.bind(res);
  let stream;
  const init = () => {
    if (stream !== undefined) return stream;
    const type = String(res.getHeader('Content-Type') || '');
    if (res.getHeader('Content-Encoding') || res.statusCode === 204 || res.statusCode === 304 || req.method === 'HEAD' || !COMPRESSIBLE.test(type)) {
      return (stream = null);
    }
    stream = enc === 'br'
      ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } })
      : zlib.createGzip();
    res.setHeader('Content-Encoding', enc);
    res.removeHeader('Content-Length');
    stream.on('data', chunk => write(chunk));
    stream.on('end', () => end());
    return stream;
  };
  res.write = (chunk, encoding, cb) => { const s = init(); return s ? s.write(chunk, encoding, cb) : write(chunk, encoding, cb); };
  res.end = (chunk, encoding, cb) => {
    const s = init();
    if (!s) return end(chunk, encoding, cb);
    if (typeof chunk === 'function') chunk = undefined;
    if (chunk) s.write(chunk, typeof encoding === 'string' ? encoding : undefined);
    s.end();
    return res;
  };
  next();
});

// Non-blocking logging: append-mode write streams instead of appendFileSync on every request.
const accessLog = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
const eventsLog = fs.createWriteStream(path.join(__dirname, 'events.log'), { flags: 'a' });
app.use((req, res, next) => {
  accessLog.write(`${new Date().toISOString()} ${req.method} ${req.url}\n`);
  next();
});

// Simulated network/database latency.
app.use((req, res, next) => setTimeout(next, 50 + Math.random() * 100));

// Caching: HTML and own CSS/JS are revalidated through ETag (their names are not fingerprinted),
// libraries, images, video and fonts are cached for a year (replace the file under a new name to change it).
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders(res, file) {
    if (/\.(html|css|js)$/.test(file) && !file.includes(`${path.sep}vendor${path.sep}`)) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

const POSTS = [
  {
    id: 1,
    title: 'Sky Tower – wrocławski wieżowiec z widokiem na cały region',
    date: '2026-01-10',
    image: '/img/1.webp', // PERF: original multi-megapixel JPEG used as-is
    credit: 'https://pixabay.com/pl/photos/wie%C5%BCowiec-wroc%C5%82aw-architektura-4315080/',
    body: 'Sky Tower to jeden z najwyższych budynków w Polsce – jego wysokość wraz z iglicą wynosi około 212 metrów, a mieszkania, biura i sklepy mieszczą się na prawie pięćdziesięciu kondygnacjach. Wieżowiec oddano do użytku w 2012 roku i od tamtej pory na stałe wpisał się w panoramę miasta, widoczną z wielu kilometrów. Największą atrakcją dla turystów jest taras widokowy na 49. piętrze, z którego w słoneczne dni widać nie tylko cały Wrocław z jego mostami i wyspami, ale też odległe zarysy Sudetów. U podnóża budynku działa centrum handlowe, w którym można zjeść, zrobić zakupy i odpocząć po zwiedzaniu. Sky Tower pokazuje, jak bardzo zmienił się Wrocław – z miasta kojarzonego głównie z zabytkową zabudową w nowoczesną metropolię, która nie boi się odważnej architektury. Najlepiej wybrać się tam o zachodzie słońca, gdy światła miasta zaczynają się zapalać.'
  },
  {
    id: 2,
    title: 'Rynek – serce Starego Miasta',
    date: '2026-02-10',
    image: '/img/2.webp',
    credit: 'https://pixabay.com/pl/photos/star%C3%B3wka-rynek-wroc%C5%82aw-architektura-5062333/',
    body: 'Wrocławski Rynek to jeden z największych średniowiecznych placów miejskich w Europie i prawdziwe serce Starego Miasta. Powstał w XIII wieku, gdy miasto lokowano na nowo po najeździe Tatarów, a jego regularny układ przetrwał do dziś. Środek placu zajmuje gotycki Ratusz z bogato zdobionymi fasadami, rzeźbami i astronomicznym zegarem, który co roku przyciąga tłumy fotografujących. Wokół stoją kolorowe kamienice, często z własnymi nazwami i historiami, jak Złoty Pies czy Pod Gryfami. Latem na Rynku trudno o wolny stolik, bo kawiarnie i restauracje rozstawiają ogródki niemal pod każdą kamienicą. Warto też zajrzeć w boczne uliczki, gdzie kryją się knajpki, galerie i małe sklepiki z lokalnymi pamiątkami. O każdej porze dnia plac tętni życiem i jest idealnym punktem wyjścia do spaceru po mieście.'
  },
  {
    id: 3,
    title: 'Hala Stulecia – betonowa legenda z listy UNESCO',
    date: '2026-03-10',
    image: '/img/3.webp',
    credit: 'https://pixabay.com/pl/photos/hala-stulecia-wroc%C5%82aw-polska-4496672/',
    body: 'Hala Stulecia, zaprojektowana przez architekta Maxa Berga i otwarta w 1913 roku, jest jednym z najważniejszych zabytków nowoczesnej architektury w Europie. W czasie budowy jej żelbetowa kopuła o średnicy około 65 metrów była największą konstrukcją tego typu na świecie, a odważne rozwiązania inżynieryjne wyprzedzały swoją epokę. W 2006 roku obiekt został wpisany na Listę Światowego Dziedzictwa UNESCO, co potwierdziło jego wyjątkową wartość. Dzisiaj w hali odbywają się koncerty, targi, wydarzenia sportowe i wystawy, więc zawsze coś się tam dzieje. W okolicy znajdziesz Pergolę z multimedialną fontanną, która wieczorami pokazuje światło, wodę i muzykę, a także piękny Ogród Japoński i wrocławskie zoo. To idealne miejsce na cały dzień spacerów, zwłaszcza w ciepłe miesiące, gdy parki wokół hali są pełne rodzin i spacerowiczów.'
  },
  {
    id: 4,
    title: 'Most Grunwaldzki – stalowy symbol miasta',
    date: '2026-04-10',
    image: '/img/4.webp',
    credit: 'https://pixabay.com/pl/photos/most-%D0%B3%D1%80%D1%8E%D0%BD%D0%B2%D0%B0%D0%BB%D1%8C%D0%B4%D1%81%D0%BA%D0%B8%D0%B9-przednia-wroc%C5%82aw-3766603/',
    body: 'Most Grunwaldzki, zbudowany w 1910 roku i dawniej nazywany Mostem Cesarskim, to jeden z najbardziej rozpoznawalnych symboli Wrocławia. Jest to most wiszący nad Odrą, który łączy okolice Starego Miasta z dzielnicą uniwersytecką i Ostrowem Tumskim po przeciwnej stronie. Jego smukłe pylony i stalowe liny stanowią świetny temat do zdjęć, szczególnie o zmierzchu, gdy światła odbijają się w wodzie. Po wojnie most przeszedł wiele remontów, a mimo to zachował swój charakterystyczny wygląd i nadal służy tysiącom pieszych, rowerzystów i kierowców każdego dnia. Pod nim często cumują statki wycieczkowe i tramwaje wodne, a nad brzegiem biegną bulwary pełne spacerowiczów. Spacer po moście i wzdłuż rzeki to jedna z najprzyjemniejszych i najtańszych atrakcji, jakie oferuje miasto.'
  },
  {
    id: 5,
    title: 'Wrocławskie krasnale – małe figurki, wielka atrakcja',
    date: '2026-05-10',
    image: '/img/5.webp',
    credit: 'https://pixabay.com/pl/photos/ludzik-gnom-cz%C5%82owieczek-sylwetka-931433/',
    body: 'Wrocławskie krasnale to jedna z najbardziej niezwykłych atrakcji miasta i dowód, że historia potrafi mieć poczucie humoru. Ich początki sięgają lat osiemdziesiątych XX wieku, kiedy krasnal był symbolem pokojowego oporu wobec władzy w ruchu Pomarańczowej Alternatywy. Pierwsze brązowe figurki pojawiły się na ulicach w 2001 roku i od tamtej pory ich liczba stale rośnie – dziś mieszkańcy i turyści mogą wypatrywać kilkuset postaci, ukrytych na chodnikach, murach, parapetach i latarniach. Każdy krasnal ma własną profesję, charakter i opowieść, od Złotnika po Bankiera czy Syzyfka. Zbieranie ich na mapie miasta, z pomocą darmowej aplikacji lub papierowej mapy, to świetny pretekst, żeby zwiedzić zakątki, do których zwykle nikt nie zagląda. Dzieci uwielbiają tę zabawę, a dorośli odkrywają przy okazji urokliwe uliczki.'
  }
];

// Full posts in a single response (no N+1 on the client); short cache with background revalidation.
app.get('/api/posts', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
  res.json(POSTS);
});

app.get('/api/posts/:id', (req, res) => {
  const post = POSTS.find(p => p.id === Number(req.params.id));
  post ? res.json(post) : res.status(404).json({ error: 'not found' });
});

app.post('/api/track', express.json(), (req, res) => {
  eventsLog.write(JSON.stringify(req.body) + '\n');
  res.sendStatus(204);
});

app.listen(PORT, () => console.log(`Blog running on http://localhost:${PORT}`));
