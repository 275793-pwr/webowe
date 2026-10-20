# Optimization proposals – "Wrocław bez tajemnic"

The app is a one-page blog: static HTML, jQuery front end ([public/js/app.js](public/js/app.js)) and an Express backend ([../server/server.js](../server/server.js)). The page weighs about 600 MB, almost all of it media. The list below is ordered by expected impact and split into **three independent optimizations**. Each one touches a different layer, so they can be measured alone and then combined.

| # | Optimization | Layer | Main metrics it moves |
|---|---|---|---|
| **A** | Media diet (video + images) | Assets | Transferred bytes, LCP, bandwidth contention |
| **B** | Network and server (API, compression, caching, I/O) | Backend + HTTP | TTFB, request waterfall, repeat-visit cost |
| **C** | Front-end payload and rendering (JS/CSS, blocking, animation) | Browser | FCP, TBT, main-thread/GPU load, CLS |

---

## Findings (baseline)

| Item | Size / cost | Where |
|---|---|---|
| Background video `1.webm` | **575 MB**, `preload="auto"`, blurred full-screen | [index.html](public/index.html), [style.css](public/css/style.css) |
| 5 JPEG post images | 13.7 MB total (1.5–4.3 MB each), full size, eager | [server.js](../server/server.js) `POSTS[].image` |
| Vendor JS: jQuery 285 KB, Bootstrap bundle 208 KB, moment 183 KB | 676 KB unminified, render-blocking in `<head>` | [index.html](public/index.html) |
| Vendor CSS: Bootstrap 280 KB + Font Awesome (all.css + 4 webfonts) | Only ~6 icons and a grid/card/navbar are used | [index.html](public/index.html) |
| `analytics.js` | Busy-waits 100 ms in `<head>`, then sync XHR | [analytics.js](public/js/analytics.js) |
| API | 1 list call + 5 sequential detail calls, each with 50–150 ms simulated latency | [app.js](public/js/app.js) |
| Server | No gzip/brotli, no `Cache-Control`, `appendFileSync` on every request and tracking event | [server.js](../server/server.js) |
| Footer animation | `setInterval(30 ms)` rewriting `background` and `box-shadow` via jQuery, runs in hidden tabs | [app.js](public/js/app.js) |
| Missing basics | No viewport meta, no favicon, `@import` in CSS, images without `width`/`height` | [index.html](public/index.html), [style.css](public/css/style.css) |

Note: the untracked `public/video/vid.webm` (7 MB) is already a much smaller replacement for the LFS-tracked 575 MB video and is the natural starting point for Optimization A.

---

## Optimization A – Media diet

**Goal:** cut transferred bytes by ~99% and stop the video from competing with content.

1. **Replace the video** with a compressed loop (target ≤ 3–5 MB):
   - Use `vid.webm` as the base, or re-encode: `ffmpeg -i 1.webm -t 15 -vf "scale=1280:-2,fps=24" -c:v libvpx-vp9 -crf 38 -b:v 0 -an out.webm` plus an H.264 MP4 fallback (`-c:v libx264 -crf 28 -movflags +faststart`).
   - Pre-blur the video at encode time (`-vf gblur=sigma=5`) and delete the CSS `filter: blur(5px)` so the GPU stops re-blurring every frame.
   - Add `poster="/img/bg-poster.avif"` and `preload="metadata"`.
   - Do not load the video on mobile, with `prefers-reduced-motion`, or with Save-Data. Serve the poster as a static background instead (a `<picture>`/media query, or start playback from JS after `load`).
2. **Re-encode images:**
   - Generate AVIF and WebP at 480/800/1200 px widths (`sharp` or `ffmpeg`), around 40–120 KB each.
   - Use `<img srcset sizes width height loading="lazy" decoding="async">`. The first card gets `fetchpriority="high"` and no lazy loading, since it is the likely LCP element.
   - Add `width`/`height` (or `aspect-ratio`) to prevent layout shift.
3. Remove the video from the Docker image (`.dockerignore`) or serve it from object storage/CDN, so images stop being 2.3 GB.

**Files touched:** `public/video/*`, `public/img/*`, [index.html](public/index.html), [style.css](public/css/style.css), the image fields in [server.js](../server/server.js), and the card template in [app.js](public/js/app.js).

**Expected effect:** page weight from ~590 MB to under 5 MB; LCP is no longer delayed by a video that shares bandwidth with the images.

---

## Optimization B – Network and server

**Goal:** fewer round trips, smaller responses, and no blocking I/O on the request path.

1. **Kill the N+1:** return full posts from `GET /api/posts` (or embed the data in the HTML) and delete the per-post fetches. This removes 5 sequential requests (about 5 × 100 ms of simulated latency, plus RTT).
2. **Compression:** add the `compression` middleware (or put nginx/Caddy with brotli in front). Text assets shrink ~70–80% (jQuery, Bootstrap and moment alone drop from 950 KB to about 270 KB).
3. **Caching:**
   - `express.static(..., { maxAge: '1y', immutable: true })` for fingerprinted assets (`app.[hash].js`, images, video).
   - `Cache-Control: no-cache` (ETag revalidation) for `index.html`.
   - `Cache-Control: public, max-age=60, stale-while-revalidate=600` for `/api/posts`.
4. **Non-blocking I/O:**
   - Replace `appendFileSync` in the access-log middleware with `morgan`, or an async `fs.createWriteStream` in append mode.
   - Batch/stream tracking events the same way.
   - Make the client use `navigator.sendBeacon('/api/track', …)` instead of a synchronous XHR.
5. **Delivery:** use `node:20-alpine`/slim, copy `package*.json` and run `npm ci --omit=dev` before `COPY .`, and add a `HEALTHCHECK`. Optionally add `<link rel="preconnect">`/HTTP/2 via the reverse proxy.

**Files touched:** [server.js](../server/server.js), [app.js](public/js/app.js) (fetch part only), [analytics.js](public/js/analytics.js) (`track()` only), Dockerfile.

**Expected effect:** TTFB and API time drop from ~600+ ms of serial calls to one call; repeat visits transfer almost nothing; the event loop no longer stalls on disk writes under load.

---

## Optimization C – Front-end payload and rendering

**Goal:** a small, non-blocking critical path and an idle main thread.

1. **Drop unused libraries:**
   - Remove moment.js and use `Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })` (−183 KB).
   - Remove jQuery and use `fetch`, `document.querySelector` and template literals (−285 KB).
   - Remove the Bootstrap JS bundle. Only the navbar toggler uses it, so write a few lines of JS or drop the collapse (−208 KB).
2. **Trim CSS:** replace the Bootstrap CSS with a custom stylesheet or a PurgeCSS/Lightning CSS build containing only navbar/card/grid rules (280 KB → ~10 KB). Replace Font Awesome (CSS + 4 fonts) with 3 inline SVG icons.
3. **Remove render blockers:**
   - Add `defer` to scripts and move them out of `<head>`.
   - Delete the 100 ms busy-wait in `analytics.js`, and load analytics after `load` or via `requestIdleCallback`.
   - Remove the `@import` in [style.css](public/css/style.css) by inlining `theme.css`.
   - Inline critical CSS and add `<meta name="viewport" content="width=device-width, initial-scale=1">` and a favicon (this also avoids a 404).
4. **Fix the animation:**
   - Replace the 30 ms `setInterval` + `.css()` with a CSS `@keyframes` animation on `background-position` or `filter: hue-rotate()` on a pseudo-element, or `@property` for the hue.
   - Pause it when off-screen (`IntersectionObserver`) or in hidden tabs, and honor `prefers-reduced-motion`.
   - Throttle `mousemove` with `requestAnimationFrame`, set a CSS variable instead of writing `text-shadow`, and cache `getBoundingClientRect()`.
5. **Safety while here:** post `title` and `body` are concatenated into HTML strings. Build nodes with `textContent` or escape them.
6. Minify and bundle the result with esbuild/Vite, with content-hashed filenames (this enables the immutable caching from B).

**Files touched:** [index.html](public/index.html), [style.css](public/css/style.css), [theme.css](public/css/theme.css), [app.js](public/js/app.js), [analytics.js](public/js/analytics.js), `public/vendor/*`.

**Expected effect:** JS from ~680 KB to under 10 KB, CSS+fonts from several hundred KB to ~10 KB, FCP no longer blocked, and CPU/GPU usage at idle falls to near zero.

---

## Test plan

### Environment

- Same machine, same build for every run. Start the server fresh (`npm start` in `../server`) and keep the simulated latency in place, since it is part of the scenario.
- Chrome with a clean profile and cache disabled for cold runs. Throttle with Lighthouse "Slow 4G, 4× CPU" (mobile) and also run unthrottled (desktop).
- 5 runs per configuration, then report the **median**.

### Configurations

Each variant is a separate git branch off `main` so changes do not leak between them.

| Run | Branch | Contains |
|---|---|---|
| 0 | `main` | Baseline |
| 1 | `opt-a-media` | A only |
| 2 | `opt-b-network` | B only |
| 3 | `opt-c-frontend` | C only |
| 4 | `opt-all` | A + B + C merged |

Run 4 shows whether the effects add up. Expect overlap: B's `immutable` caching only pays off once C produces hashed filenames, and A's smaller images make B's compression matter less for them.

### Metrics to record

| Metric | Tool |
|---|---|
| Total transferred bytes, request count | DevTools Network / HAR (`lighthouse --output json`) |
| TTFB, FCP, LCP, TBT, CLS, Speed Index | Lighthouse (CLI: `npx lighthouse http://localhost:3000 --preset=perf`) |
| Time until all 5 posts are rendered | `performance.mark` in `app.js`, or Performance panel |
| Main-thread busy time / frames at idle (10 s) | Chrome Performance panel, `chrome://tracing` |
| Warm-cache reload bytes | Second navigation with cache enabled |
| Server throughput and p95 latency | `autocannon -c 50 -d 20 http://localhost:3000/api/posts` |

### Result table (to fill in)

| Metric | Baseline | A | B | C | A+B+C |
|---|---|---|---|---|---|
| Transferred (MB) | | | | | |
| Requests | | | | | |
| FCP (s) | | | | | |
| LCP (s) | | | | | |
| TBT (ms) | | | | | |
| CLS | | | | | |
| Posts rendered (s) | | | | | |
| Repeat-visit transfer (KB) | | | | | |
| `/api/posts` p95 (ms) | | | | | |
| Lighthouse perf score | | | | | |

### Acceptance

- Each single optimization improves at least its main metrics (see the first table) with no regression elsewhere.
- Combined result beats every single variant on the Lighthouse score. Any metric where A+B+C is worse than the best single variant gets investigated.
- Functional check on every variant: five posts render in order with correct Polish dates, images load, the navbar collapses on mobile, the footer glow animates, and `/api/track` still receives `page_load`.
