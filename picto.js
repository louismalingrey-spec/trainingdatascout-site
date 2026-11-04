// Small animated pixel pictograms for the two cards. Same pixel language as
// dither.js: square cells, seeded hashed noise + interleaved gradient noise +
// smooth value noise. Shapes are analytic (rects, ellipses) sampled per cell,
// outlined by one cell and filled with an ordered (Bayer) halftone stipple.
// company: archive boxes on shelves that erode into rising grain and re-form.
// expert:  head-and-shoulders, stippled, with a slowly drifting threshold.
// Optional ?t=SECONDS (or window.__pictoTime) freezes time on one static frame.
(function () {
  var nodes = document.querySelectorAll("canvas.picto");
  if (!nodes.length || !nodes[0].getContext) return;
  var CELL = 2.5, CELL_SMALL = 2, FPS = 13, LOOP = 9, SEED = 0x2b91c7;
  var INK = 0xff121110; // #101112, little-endian ABGR

  function hash(x, y, s) {
    var h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(s, 0x9e3779b1)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var fx = smooth(x - xi), fy = smooth(y - yi);
    var a = hash(xi, yi, s), b = hash(xi + 1, yi, s);
    var c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    var top = a + (b - a) * fx;
    return top + ((c + (d - c) * fx) - top) * fy;
  }
  function fbm(x, y, s) {
    return 0.5 * vnoise(x, y, s) + 0.3 * vnoise(x * 2, y * 2, s + 7) + 0.2 * vnoise(x * 4, y * 4, s + 13);
  }

  // 4x4 Bayer matrix, 0..1: ordered halftone for the stippled interiors
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }

  // ---- shapes: ink density 0..1 at a point of the unit square ----
  // Company: three shelves of archive boxes, drawn on a 35-unit grid.
  // Box types: 0 label window, 1 handle slot, 2 label window with a text line.
  var ROWS = [
    [[2, 16.5, 0], [17.5, 33, 1]],
    [[2, 12, 1], [13, 23.5, 2], [24.5, 33, 0]],
    [[2, 19, 2], [20, 33, 1]]
  ];
  var ROW0 = 1.8, PITCH = 10.8, BOXH = 7.4, SHELF = 8.4;
  var LASTSHELF = ROW0 + 2 * PITCH + SHELF;
  function companyDensity(u, v) {
    var x = u * 35, y = v * 35 - ROW0;
    var r = Math.floor((y + 0.0001) / PITCH), ry = y - r * PITCH;
    if (r < 0 || r > 2) return 0;
    if (ry >= SHELF && ry < SHELF + 1) return (x > 1.5 && x < 33.5) ? 1 : 0;
    if (ry < 0 || ry >= BOXH) return 0;
    var row = ROWS[r];
    for (var k = 0; k < row.length; k++) {
      var b = row[k], x0 = b[0], x1 = b[1];
      if (x < x0 || x >= x1) continue;
      if (ry < 1.8) return 0.62;                       // lid
      if (ry < 2.8) return 1;                          // lid edge
      var bx = (x - x0) / (x1 - x0), cx = (x0 + x1) / 2, ax = Math.abs(x - cx);
      if (b[2] === 1) {                                // handle slot, ends rounded off
        if (ry > 4.2 && ry < 5.6 && ax < 2.6 - (ax > 1.9 && (ry < 4.6 || ry > 5.2) ? 0.9 : 0)) return 1;
      } else if (ry > 3.9 && ry < 6.3 && ax < 3.4) {   // label window
        return (b[2] === 2 && ry > 4.7 && ry < 5.5 && ax < 2.2) ? 1 : 0;
      }
      return 0.30 + 0.22 * bx;                         // body, lighter on the lit left
    }
    return 0;
  }
  // Expert: head and shoulders, lit from the upper left, shoulders slightly uneven.
  function expertDensity(u, v) {
    var dx = (u - 0.49) / 0.175, dy = (v - 0.31) / 0.225;
    var hd = dx * dx + dy * dy;
    if (hd < 1) {
      var z = Math.sqrt(1 - hd);
      var lum = -0.5 * dx - 0.55 * dy + 0.5 * z;     // > 0 lit
      var d = clamp(0.5 - 0.5 * lum, 0.08, 0.92);
      if (dy < -0.2 + 0.35 * dx - 0.25 * z * z) d = 0.95; // hair, swept to the right
      return d;
    }
    var ax = Math.abs(u - 0.5);
    if (v >= 0.5 && v < 0.64 && ax < 0.085 + (v - 0.5) * 0.15) { // neck, in the shade of the chin
      return clamp(0.55 + 0.9 * (v - 0.5) + 0.5 * (u - 0.5), 0.5, 0.85);
    }
    var sx = (u - 0.52) / (u < 0.52 ? 0.46 : 0.455), sy = (v + 0.03 * (0.5 - u) - 1.04) / 0.43;
    if (sx * sx + sy * sy < 1 && v < 0.955) {
      if (v < 0.76 && v > 0.58 && ax < 0.03 + (v - 0.6) * 0.55) return 0.4 + 0.3 * (v - 0.6) / 0.16; // open collar
      return clamp(0.78 + 0.5 * (u - 0.5) + 0.2 * (v - 0.8), 0.6, 1);
    }
    return 0;
  }

  function build(st, cols) {
    var n = cols * cols, i, x, y, co = st.kind === "company";
    st.cols = cols;
    st.img = st.ctx.createImageData(cols, cols);
    st.px = new Uint32Array(st.img.data.buffer);
    st.dens = new Float32Array(n);
    st.rnd = new Float32Array(n);
    st.rnd2 = new Float32Array(n);
    st.fld = new Float32Array(n);
    st.edge = new Uint8Array(n);
    st.near = new Uint8Array(n);
    var seed = SEED + (co ? 0 : 55);
    var dfn = co ? companyDensity : expertDensity;
    for (y = 0; y < cols; y++) for (x = 0; x < cols; x++) {
      i = y * cols + x;
      var u = (x + 0.5) / cols, v = (y + 0.5) / cols;
      st.dens[i] = dfn(u, v);
      st.rnd[i] = 0.82 * bayer(x, y) + 0.18 * hash(x, y, seed);
      st.rnd2[i] = hash(x, y, seed + 9);
      var f = fbm(u * 3.2 + 5, v * 3.2 + 2, seed + 31);
      // company: erosion order. Top first, a little from the right, uneven; the last shelf stays.
      st.fld[i] = 0.62 * v + 0.2 * (1 - u) + (f - 0.5) * 0.5 - 0.1 + (v * 35 > LASTSHELF - 0.2 ? 0.8 : 0);
    }
    var R = Math.max(1, Math.round(cols / 9));
    for (y = 0; y < cols; y++) for (x = 0; x < cols; x++) {
      i = y * cols + x;
      if (st.dens[i] > 0) {
        // 1 = outline on the shaded side, 2 = outline on the lit side (left / top)
        var e = 0, L = x === 0 || st.dens[i - 1] === 0, T = y === 0 || st.dens[i - cols] === 0;
        if (L || T) e = 2;
        else if (x === cols - 1 || y === cols - 1 || st.dens[i + 1] === 0 || st.dens[i + cols] === 0) e = 1;
        st.edge[i] = e;
      } else {
        var nr = 0;
        for (var yy = Math.max(0, y - R); yy <= Math.min(cols - 1, y + R) && !nr; yy++)
          for (var xx = Math.max(0, x - R); xx <= Math.min(cols - 1, x + R); xx++)
            if (st.dens[yy * cols + xx] > 0) { nr = 1; break; }
        st.near[i] = nr;
      }
    }
    if (co) for (i = 0; i < n; i++) if (st.edge[i]) st.dens[i] = 1; // outlines are solid ink
  }

  function frame(st, t) {
    var cols = st.cols, px = st.px, dens = st.dens, rnd = st.rnd, rnd2 = st.rnd2;
    var step = Math.floor(t * 12), x, y, i, on, h, n = cols * cols;
    if (st.kind === "company") {
      var w = 0.5 - 0.5 * Math.cos(2 * Math.PI * t / LOOP);
      w = smooth(clamp((w - 0.12) / 0.76, 0, 1)); // rests whole for a moment
      var p = -0.25 + 0.95 * w, band = 0.16;
      for (i = 0; i < n; i++) px[i] = 0;
      for (y = 0; y < cols; y++) for (x = 0; x < cols; x++) {
        i = y * cols + x;
        if (dens[i] <= 0) continue;
        h = hash(x, y, step + 77);
        var d = st.fld[i], rel = (d - p) / band;
        if (dens[i] > rnd[i] * 0.999) {
          if (rel >= 1) on = 1;
          else if (rel > 0) on = (smooth(rel) * 1.1 > rnd2[i] * 0.8 + h * 0.25) ? 1 : 0;
          else on = h < 0.06 * Math.exp(rel * 2) ? 1 : 0;
          if (on) px[i] = INK;
        }
        // dissolved cells: a share of them turns into loose grain that rises and settles back
        if (rel < 0.5 && rnd2[i] < 0.5 && h > 0.2) {
          var gone = clamp(-rel / 1.6 + 0.15, 0, 1);
          if (gone > 0) {
            var k = smooth(gone), r2 = rnd2[i] * 2;
            var gx = x + Math.round(Math.sin(t * 0.9 + r2 * 40) * 1.6 * k);
            var gy = y - Math.round(k * (1.5 + 9 * r2) + Math.sin(t * 0.7 + r2 * 23) * 0.8 * k);
            if (gx >= 0 && gx < cols && gy >= 0 && gy < cols) px[gy * cols + gx] = INK;
          }
        }
      }
    } else {
      var a = t * 0.2, tt = t * 0.16;
      for (y = 0; y < cols; y++) for (x = 0; x < cols; x++) {
        i = y * cols + x; on = 0;
        var dn = dens[i];
        if (dn > 0) {
          if (st.edge[i] === 2 || dn >= 0.95) on = 1;
          else {
            var nz = vnoise(x * 0.25 + a, y * 0.25 - tt, SEED + 3);
            var thr = 0.88 * rnd[i] + 0.12 * nz;
            on = (dn + (st.edge[i] ? 0.35 : 0)) > thr ? 1 : 0;
          }
        } else if (st.near[i]) {
          h = hash(x, y, step + 5);
          var ph = Math.sin(t * 0.6 + rnd2[i] * 40);
          on = (rnd2[i] > 0.972 && ph > 0 && h > 0.15) ? 1 : 0;
        }
        px[i] = on ? INK : 0;
      }
    }
    st.ctx.putImageData(st.img, 0, 0);
  }

  var states = [], visible = [], i;
  for (i = 0; i < nodes.length; i++) {
    states.push({ c: nodes[i], ctx: nodes[i].getContext("2d"), kind: nodes[i].getAttribute("data-picto"), key: "", cols: 0 });
    visible.push(true);
  }

  var q = /[?&]t=([\d.]+)/.exec(location.search);
  var frozen = q ? parseFloat(q[1]) : (typeof window.__pictoTime === "number" ? window.__pictoTime : null);
  var mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  var running = false, last = 0, clock = 0;

  function still() { return frozen !== null || !!(mq && mq.matches); }
  function stillTime() { return frozen !== null ? frozen : 0; }
  function layout(st) {
    var dpr = window.devicePixelRatio || 1;
    var size = st.c.clientWidth || 88;
    var cell = size < 80 ? CELL_SMALL : CELL; // keeps ~33-35 cells across on mobile too
    var px = Math.max(1, Math.round(cell * dpr));
    var cols = Math.max(8, Math.round(size * dpr / px));
    var key = cols + ":" + px;
    if (key !== st.key) { st.key = key; st.c.width = cols; st.c.height = cols; build(st, cols); }
  }
  function drawAll(t) { for (var k = 0; k < states.length; k++) if (states[k].cols) frame(states[k], t); }
  function relayout() {
    for (var k = 0; k < states.length; k++) layout(states[k]);
    drawAll(still() ? stillTime() : clock);
  }
  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    if (last && now - last < 1000 / FPS) return;
    clock += last ? Math.min(0.25, (now - last) / 1000) : 0;
    last = now;
    for (var k = 0; k < states.length; k++) if (visible[k]) frame(states[k], clock);
  }
  function update() {
    var any = false;
    for (var k = 0; k < visible.length; k++) if (visible[k]) any = true;
    var want = any && !document.hidden && !still();
    if (want && !running) { running = true; last = 0; requestAnimationFrame(tick); }
    else if (!want) running = false;
  }

  for (i = 0; i < states.length; i++) layout(states[i]);
  drawAll(still() ? stillTime() : 0);

  if (window.ResizeObserver) {
    var ro = new ResizeObserver(relayout);
    for (i = 0; i < nodes.length; i++) ro.observe(nodes[i]);
  } else window.addEventListener("resize", relayout);
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (es) {
      for (var e = 0; e < es.length; e++) {
        for (var k = 0; k < states.length; k++) if (states[k].c === es[e].target) visible[k] = es[e].isIntersecting;
      }
      update();
    });
    for (i = 0; i < nodes.length; i++) io.observe(nodes[i]);
  }
  document.addEventListener("visibilitychange", update);
  if (mq) {
    var onmq = function () { relayout(); update(); };
    if (mq.addEventListener) mq.addEventListener("change", onmq); else if (mq.addListener) mq.addListener(onmq);
  }
  update();
})();
