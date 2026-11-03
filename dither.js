// Pixel dissolve at the bottom edge of the photo: an 8x8 Bayer matrix decides,
// cell by cell, where the page colour replaces the image. Static, no animation.
(function () {
  var canvas = document.getElementById("dither");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var PAPER = "#e7e8e6";
  var CELL = 6; // CSS pixels per square
  var B = [
     0, 32,  8, 40,  2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44,  4, 36, 14, 46,  6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
     3, 35, 11, 43,  1, 33,  9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47,  7, 39, 13, 45,  5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  ];

  function draw() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    var cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
    canvas.width = cols; canvas.height = rows; // 1 canvas px = 1 square, scaled up by CSS
    ctx.clearRect(0, 0, cols, rows);
    ctx.fillStyle = PAPER;
    for (var y = 0; y < rows; y++) {
      // coverage grows with a curve so the top of the band stays clean
      var t = Math.pow((y + 0.5) / rows, 1.6);
      for (var x = 0; x < cols; x++) {
        if (t * 64 > B[(y & 7) * 8 + (x & 7)] || y >= rows - 1) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  draw();
  if (window.ResizeObserver) new ResizeObserver(draw).observe(canvas);
  else window.addEventListener("resize", draw);
})();
