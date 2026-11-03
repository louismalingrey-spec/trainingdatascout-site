// Grainy dissolve at the bottom edge of the photo. Per-cell random threshold
// (hashed white noise plus interleaved gradient noise, which is blue-ish) is
// shifted by smooth multi-octave value noise, so the edge erodes unevenly
// instead of following a grid. Seeded, static, no animation.
(function () {
  var canvas = document.getElementById("dither");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var PAPER = "#e7e8e6";
  var CELL = 2.5;        // CSS pixels per square
  var SEED = 0x7d5c3a1;

  // integer hash -> [0,1)
  function hash(x, y, s) {
    var h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(s, 0x9e3779b1)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var fx = smooth(x - xi), fy = smooth(y - yi);
    var a = hash(xi, yi, s), b = hash(xi + 1, yi, s);
    var c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  }
  // 4 octaves, roughly [0,1]
  function fbm(x, y) {
    var sum = 0, amp = 0.5, f = 1, norm = 0;
    for (var o = 0; o < 4; o++) {
      sum += amp * vnoise(x * f, y * f, SEED + o * 101);
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }
  // interleaved gradient noise (Jimenez), blue-ish distribution
  function ign(x, y) {
    var v = 52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1);
    return v - Math.floor(v);
  }

  function draw() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    var dpr = window.devicePixelRatio || 1;
    // whole device pixels per cell, so squares stay crisp
    var px = Math.max(1, Math.round(CELL * dpr));
    var cols = Math.ceil(w * dpr / px), rows = Math.ceil(h * dpr / px);
    canvas.width = cols; canvas.height = rows; // 1 canvas px = 1 square, scaled up by CSS
    ctx.clearRect(0, 0, cols, rows);
    ctx.fillStyle = PAPER;
    var scale = px / dpr;            // cell size in CSS px
    var lf = 1 / (90 / scale);       // base noise wavelength ~90 CSS px
    for (var y = 0; y < rows; y++) {
      var base = Math.pow((y + 0.5) / rows, 1.5); // keeps the top of the band clean
      for (var x = 0; x < cols; x++) {
        var n = fbm(x * lf * 0.6, y * lf * 1.4) - 0.5;      // low-frequency erosion
        var r = 0.55 * hash(x, y, SEED) + 0.45 * ign(x, y);  // grain
        var cover = base + n * 0.55 * Math.sin(Math.min(1, base * 1.6) * Math.PI * 0.5);
        if (cover > r || y >= rows - 1) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  draw();
  if (window.ResizeObserver) new ResizeObserver(draw).observe(canvas);
  else window.addEventListener("resize", draw);
})();
