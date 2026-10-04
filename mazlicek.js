/* mazlicek.js - animovany virtualni mazlicek (Canvas 2D, bez knihoven, obrazku a fontu)
 * Globalni objekt: window.PetAnim
 *   SPECIES, MOODS, W, H, mount(canvas,state), update(canvas,state), feed(canvas,icon),
 *   poke(canvas), start(), unmount(canvas)
 * Architektura: (1) konfigurace druhu (SP) -> (2) interpolovane parametry nalady (cur)
 *   -> (3) pose() spocita pozu ("rig") -> (4) draw*() jen kresli podle pozy.
 */
(function (global) {
  'use strict';

  var PI = Math.PI, TAU = Math.PI * 2;
  var W = 360, H = 220, GROUND = 196, CX = 180;
  var SPECIES = ['cat', 'dog', 'rabbit', 'panda', 'hamster', 'fox', 'unicorn', 'koala', 'pig', 'penguin'];
  var MOODS = ['ecstatic', 'happy', 'ok', 'hungry', 'sad', 'sick'];
  var EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  var EYE = '#2a2238', MOUTH = '#4a1d3a', TONGUE = '#ff7a9c';
  var ACCENT = '#a78bfa', GOLD = '#fbbf24', GREEN = '#34d399';

  // stupne: scale, head ratio, body ratio, eye ratio
  var STAGE = [
    { s: 0.74, hk: 1.16, bk: 0.86, ek: 1.12 },
    { s: 0.88, hk: 1.07, bk: 0.94, ek: 1.05 },
    { s: 1.0, hk: 1.0, bk: 1.0, ek: 1.0 },
    { s: 1.08, hk: 0.98, bk: 1.02, ek: 1.0 }
  ];

  // ---------- parametry nalad (interpolovane v case) ----------
  var MP = ['bounce', 'sway', 'speed', 'open', 'happy', 'plead', 'brow', 'smile', 'mouth', 'narrow', 'droop', 'sat',
    'green', 'glow', 'hearts', 'blush', 'thought', 'tear', 'sweat', 'thermo', 'cloud', 'wobble', 'look'];
  var ACCK = ['bowl', 'bowlFull', 'dumbbell', 'bow', 'sparkles', 'bubbles', 'books', 'crown'];
  var ALLK = MP.concat(ACCK);
  function mk(a) { var o = {}, i; for (i = 0; i < MP.length; i++) o[MP[i]] = a[i]; return o; }
  //            bounce sway speed open happy plead brow smile mouth narrow droop sat green glow hearts blush thought tear sweat thermo cloud wobble look
  var MOOD = {
    ecstatic: mk([1, 0.3, 1.3, 1, 1, 0, 0, 1, 0.85, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]),
    happy: mk([0, 0.8, 1.05, 1, 0, 0, 0, 0.85, 0.1, 0, 0, 1, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0]),
    ok: mk([0, 0.35, 0.8, 1, 0, 0, 0, 0.35, 0, 0, 0, 0.95, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0]),
    hungry: mk([0, 0.3, 0.9, 1, 0, 1, 0, -0.05, 0.45, 0.45, 0.2, 0.9, 0, 0, 0, 0.4, 1, 0, 0, 0, 0, 0.8, 1]),
    sad: mk([0, 0.15, 0.55, 0.85, 0, 0.3, 1, -0.8, 0, 0.35, 0.85, 0.7, 0, 0, 0, 0.3, 0, 1, 0, 0, 0, 0, 0]),
    sick: mk([0, 0.1, 0.45, 0.55, 0, 0, 0.7, -0.45, 0, 0.35, 1, 0.2, 1, 0, 0, 0.1, 0, 0, 1, 1, 1, 0.6, 0])
  };

  // ---------- pomocne funkce ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rnd(pet) { // xorshift32 -> 0..1
    var x = pet.seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; pet.seed = x >>> 0 || 1;
    return (pet.seed % 100000) / 100000;
  }
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.max(rx, 0.01), Math.max(ry, 0.01), rot || 0, 0, TAU); }
  function fs(g, fill, line, lw) {
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (line) { g.strokeStyle = line; g.lineWidth = lw || 2.2; g.stroke(); }
  }
  function rr(g, x, y, w, h, r) { // zaoblený obdélník (bez roundRect kvuli starsim prohlizecum)
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function heart(g, x, y, s) {
    g.beginPath(); g.moveTo(x, y + s * 0.9);
    g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.35);
    g.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); g.closePath();
  }
  function star(g, x, y, r, rot) { // ctyrcipa hvezdicka
    var i, a, tx, ty, pa = rot - PI / 2;
    g.beginPath(); g.moveTo(x + Math.cos(pa) * r, y + Math.sin(pa) * r);
    for (i = 1; i <= 4; i++) {
      a = rot - PI / 2 + i * PI / 2; tx = x + Math.cos(a) * r; ty = y + Math.sin(a) * r;
      g.quadraticCurveTo(x, y, tx, ty);
    }
    g.closePath();
  }
  function droplet(g, x, y, r) {
    g.beginPath(); g.moveTo(x, y - r * 1.8);
    g.bezierCurveTo(x + r * 0.2, y - r * 0.9, x + r, y - r * 0.5, x + r, y + r * 0.2);
    g.arc(x, y + r * 0.2, r, 0, PI, false);
    g.bezierCurveTo(x - r, y - r * 0.5, x - r * 0.2, y - r * 0.9, x, y - r * 1.8); g.closePath();
  }

  // R = aktualni render kontext (jednovlaknovy singleton, aby hooky druhu nemusely mit argumenty)
  var R = { g: null, p: null, P: null, S: null, st: null, pet: null };

  // ---------- usi ----------
  function earPoint(x, y, w, h, rot, fill, inner) {
    var g = R.g, p = R.p;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath(); g.moveTo(-w / 2, 0); g.quadraticCurveTo(-w * 0.55, -h * 0.75, 0, -h);
    g.quadraticCurveTo(w * 0.55, -h * 0.75, w / 2, 0); g.closePath(); fs(g, fill, p.line);
    if (inner) {
      g.beginPath(); g.moveTo(-w * 0.27, -1); g.quadraticCurveTo(-w * 0.3, -h * 0.55, 0, -h * 0.7);
      g.quadraticCurveTo(w * 0.3, -h * 0.55, w * 0.27, -1); g.closePath(); fs(g, inner);
    }
    g.restore();
  }
  function earLong(x, y, w, h, rot, fill, inner) {
    var g = R.g, p = R.p;
    g.save(); g.translate(x, y); g.rotate(rot);
    ell(g, 0, -h / 2, w / 2, h / 2); fs(g, fill, p.line);
    ell(g, 0, -h * 0.46, w * 0.27, h * 0.38); fs(g, inner);
    g.restore();
  }
  function earRound(x, y, r, rot, fill, inner, ir) { // rotace kolem stredu hlavy
    var g = R.g, p = R.p;
    g.save(); g.rotate(rot);
    ell(g, x, y, r, r); fs(g, fill, p.line);
    if (inner) { ell(g, x, y + r * 0.1, ir, ir); fs(g, inner); }
    g.restore();
  }
  function earSide(side, base) { return side * (base + (side < 0 ? R.P.earL : R.P.earR)); }

  // ---------- druhy (palety + proporce + hooky) ----------
  var SP = {};

  SP.cat = {
    pal: { fur: '#f2bf86', belly: '#fff0dc', shade: '#d58d54', inner: '#f7a1b5', nose: '#ef7f98', cheek: '#ff9eb5', line: '#b46f3a' },
    hx: 44, hy: 36, bx: 32, by: 27, ex: 17, ey: 3, er: 6.4, my: 18.5, mw: 7, ck: [28, 13], nose: 10.5,
    back: function () {
      var g = R.g, p = R.p;
      g.save(); g.translate(R.P.bx * 0.7, -14); g.rotate(-0.15 + R.P.tail);
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(20, -2, 28, -26, 13, -40);
      g.lineWidth = 11.5; g.strokeStyle = p.line; g.stroke();
      g.lineWidth = 7.6; g.strokeStyle = p.fur; g.stroke();
      g.restore();
    },
    earsBack: function () {
      var p = R.p;
      earPoint(-27, -24, 26, 28, earSide(-1, 0.18), p.fur, p.inner);
      earPoint(27, -24, 26, 28, earSide(1, 0.18), p.fur, p.inner);
    },
    faceBack: function () {
      var g = R.g, p = R.p, i;
      g.strokeStyle = p.shade; g.lineWidth = 3; // pruhy na cele
      for (i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 7, -33 + Math.abs(i) * 2); g.lineTo(i * 6.2, -24 + Math.abs(i) * 1.5); g.stroke(); }
      ell(g, 0, 15, 13, 8.5); fs(g, p.belly);
    },
    faceFront: function () {
      var g = R.g, p = R.p, i, t = R.pet.tt;
      ell(g, 0, 10.8, 3.8, 2.7); fs(g, p.nose);
      g.strokeStyle = 'rgba(42,34,56,0.7)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(0, 13); g.lineTo(0, 17); g.stroke();
      g.strokeStyle = 'rgba(255,248,235,0.85)'; g.lineWidth = 1.4;
      for (i = 0; i < 3; i++) {
        var tw = Math.sin(t * 1.3 + i) * 0.8;
        g.beginPath(); g.moveTo(-21, 12 + i * 3.4); g.lineTo(-41, 8 + i * 6 + tw); g.stroke();
        g.beginPath(); g.moveTo(21, 12 + i * 3.4); g.lineTo(41, 8 + i * 6 + tw); g.stroke();
      }
    },
    body: function () { // pruhy na tele
      var g = R.g, p = R.p, P = R.P, i;
      g.strokeStyle = p.shade; g.lineWidth = 3;
      for (i = 0; i < 3; i++) {
        g.beginPath(); g.moveTo(-P.bx * 0.92 + i * 1.5, P.bodyCy - 8 + i * 9); g.lineTo(-P.bx * 0.68 + i * 1.5, P.bodyCy - 6 + i * 9); g.stroke();
        g.beginPath(); g.moveTo(P.bx * 0.92 - i * 1.5, P.bodyCy - 8 + i * 9); g.lineTo(P.bx * 0.68 - i * 1.5, P.bodyCy - 6 + i * 9); g.stroke();
      }
    }
  };

  SP.dog = {
    pal: { fur: '#dba468', belly: '#f8e6cb', shade: '#a8703c', ear: '#8c5a36', nose: '#2b2336', cheek: '#ff9eb5', line: '#8a5a34' },
    hx: 45, hy: 36, bx: 33, by: 27, ex: 17, ey: 1, er: 6.2, my: 22, mw: 8, ck: [31, 14], nose: 9.5,
    back: function () {
      var g = R.g, p = R.p;
      g.save(); g.translate(R.P.bx * 0.72, -18); g.rotate(0.55 + R.P.tail * 2.2);
      ell(g, 0, -11, 5.5, 12.5); fs(g, p.fur, p.line);
      g.restore();
    },
    faceBack: function () {
      var g = R.g, p = R.p;
      ell(g, 16, 1, 12.5, 12, 0.35); fs(g, p.ear); // skvrna kolem oka
      ell(g, 0, 15, 18, 13.5); fs(g, p.belly);
    },
    faceFront: function () {
      var g = R.g, p = R.p;
      ell(g, 0, 8.5, 6, 4.3); fs(g, p.nose);
      ell(g, -1.8, 7.2, 1.7, 1); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
      g.strokeStyle = 'rgba(42,34,56,0.65)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 12); g.lineTo(0, 17.5); g.stroke();
    },
    earsFront: function () {
      var g = R.g, p = R.p, side, P = R.P;
      for (side = -1; side <= 1; side += 2) {
        g.save(); g.translate(side * 37, -22); g.rotate(side * (0.34 + (side < 0 ? P.earL : P.earR) * 0.9));
        ell(g, side * 2, 17, 11.5, 21); fs(g, p.ear, p.line);
        g.restore();
      }
    }
  };

  SP.rabbit = {
    pal: { fur: '#f4effd', belly: '#ffffff', shade: '#d9d0ee', inner: '#f9a8c9', nose: '#f77fa8', cheek: '#ffa3c4', line: '#a59cc6' },
    hx: 42, hy: 36, bx: 31, by: 28, ex: 15, ey: 4, er: 6.2, my: 18, mw: 7, ck: [27, 14], nose: 10.5,
    back: function () {
      var g = R.g, p = R.p;
      ell(g, R.P.bx * 0.72, -13, 9.5, 9.5); fs(g, p.belly, p.line);
    },
    earsBack: function () {
      var p = R.p;
      earLong(-15, -30, 17, 50, earSide(-1, 0.1), p.fur, p.inner);
      earLong(15, -30, 17, 50, earSide(1, 0.1), p.fur, p.inner);
    },
    faceFront: function () {
      var g = R.g, p = R.p, P = R.P;
      ell(g, 0, 10.5, 3.4, 2.5); fs(g, p.nose);
      g.strokeStyle = 'rgba(42,34,56,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 12.5); g.lineTo(0, 17); g.stroke();
      if (P.mo < 0.5) { rr(g, -3.4, 17.6 + P.smile * 2.4, 6.8, 6.6, 2); fs(g, '#ffffff', p.line, 1.5); g.strokeStyle = p.line; g.beginPath(); g.moveTo(0, 18 + P.smile * 2.4); g.lineTo(0, 24); g.stroke(); }
    }
  };

  SP.panda = {
    pal: { fur: '#f7f5fb', belly: '#ffffff', shade: '#e4dff0', black: '#34304a', nose: '#2b2336', cheek: '#ffa3c4', line: '#9a94b8', limb: '#34304a' },
    hx: 45, hy: 37, bx: 35, by: 29, ex: 17, ey: 5, er: 6.2, my: 19, mw: 7.5, ck: [31, 17], nose: 11.5, sclera: true, browCol: '#f4f1ff',
    earsBack: function () {
      var p = R.p;
      earRound(-31, -27, 11.5, -R.P.earL * 0.4, p.black);
      earRound(31, -27, 11.5, R.P.earR * 0.4, p.black);
    },
    faceBack: function () {
      var g = R.g, p = R.p;
      ell(g, -17, 5, 10.5, 12.8, 0.5); fs(g, p.black, p.line, 1.6);
      ell(g, 17, 5, 10.5, 12.8, -0.5); fs(g, p.black, p.line, 1.6);
    },
    faceFront: function () {
      var g = R.g, p = R.p;
      ell(g, 0, 11.5, 5.4, 3.7); fs(g, p.nose);
      ell(g, -1.6, 10.4, 1.6, 0.9); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fill();
    }
  };

  SP.hamster = {
    pal: { fur: '#efbd7d', belly: '#fff3e3', shade: '#c98a4b', inner: '#ffadc2', nose: '#ff8fae', cheek: '#ff9db8', line: '#b57a40' },
    hx: 48, hy: 36, bx: 34, by: 29, ex: 17, ey: 4, er: 6.2, my: 19.5, mw: 6.5, ck: [32, 14], nose: 10,
    earsBack: function () {
      var p = R.p;
      earRound(-34, -25, 10.5, -R.P.earL * 0.5, p.fur, p.inner, 6);
      earRound(34, -25, 10.5, R.P.earR * 0.5, p.fur, p.inner, 6);
    },
    faceBack: function () {
      var g = R.g, p = R.p;
      ell(g, 0, -23, 17, 9); g.fillStyle = p.shade; g.globalAlpha *= 0.55; g.fill(); g.globalAlpha /= 0.55;
      ell(g, -30, 12, 15, 13); fs(g, p.belly, p.line, 1.8); // lícní torby
      ell(g, 30, 12, 15, 13); fs(g, p.belly, p.line, 1.8);
      ell(g, 0, 14, 14, 10); fs(g, p.belly);
    },
    faceFront: function () {
      var g = R.g, p = R.p, P = R.P;
      ell(g, 0, 10, 3.2, 2.4); fs(g, p.nose);
      if (P.mo < 0.5) { rr(g, -3, 19.3 + P.smile * 2, 6, 5.6, 1.8); fs(g, '#ffffff', p.line, 1.4); }
    }
  };

  SP.fox = {
    pal: { fur: '#f58a3b', belly: '#fff6ec', shade: '#d4641c', inner: '#fff1e0', nose: '#2b2336', cheek: '#ffa68a', line: '#b4531a', limb: '#5a3524', tip: '#fff6ec' },
    hx: 44, hy: 34, bx: 30, by: 28, ex: 16, ey: 3, er: 6.2, my: 20, mw: 7, ck: [27, 14], nose: 12,
    back: function () {
      var g = R.g, p = R.p;
      g.save(); g.translate(R.P.bx * 0.55, -14); g.rotate(0.3 + R.P.tail * 1.3);
      ell(g, 0, -26, 13.5, 28); fs(g, p.fur, p.line);
      g.save(); g.clip(); g.fillStyle = p.tip; g.fillRect(-20, -64, 40, 22); g.restore();
      ell(g, 0, -26, 13.5, 28); g.strokeStyle = p.line; g.lineWidth = 2.2; g.stroke();
      g.restore();
    },
    earsBack: function () {
      var p = R.p;
      earPoint(-28, -25, 25, 36, earSide(-1, 0.2), p.fur, p.inner);
      earPoint(28, -25, 25, 36, earSide(1, 0.2), p.fur, p.inner);
    },
    faceBack: function () {
      var g = R.g, p = R.p, s;
      for (s = -1; s <= 1; s += 2) { // bile pramínky tváří
        g.beginPath(); g.moveTo(s * 37, 4); g.lineTo(s * 51, 17); g.lineTo(s * 33, 25); g.closePath(); fs(g, p.belly, p.line, 1.8);
      }
      ell(g, 0, 18, 24, 15); fs(g, p.belly);
    },
    faceFront: function () {
      var g = R.g, p = R.p;
      ell(g, 0, 12, 4.2, 3); fs(g, p.nose);
      g.strokeStyle = 'rgba(42,34,56,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 14.5); g.lineTo(0, 19); g.stroke();
    }
  };

  var MANE = ['#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa'];
  SP.unicorn = {
    pal: { fur: '#fdf2ff', belly: '#ffffff', shade: '#e8d5f7', inner: '#fbcfe8', nose: '#f9a8d4', cheek: '#f9a8d4', line: '#b79ad6', limb: '#f1e4fb' },
    hx: 44, hy: 36, bx: 32, by: 27, ex: 16, ey: 3, er: 6.4, my: 20, mw: 7, ck: [28, 14], nose: 12, crownX: -17, crownRot: -0.28,
    back: function () {
      var g = R.g, i, t = R.P.tail;
      g.save(); g.translate(R.P.bx * 0.6, -16); g.rotate(0.1 + t);
      for (i = 0; i < 4; i++) {
        g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(16 + i * 2, -4, 26 - i * 2, -22 - i * 3, 12 + i * 5, -40 - i * 2);
        g.lineWidth = 6.5; g.strokeStyle = MANE[(i * 2) % 5]; g.stroke();
      }
      g.restore();
    },
    earsBack: function () {
      var g = R.g, p = R.p, i, P = R.P, sw = Math.sin(R.pet.ph * 1.7);
      for (i = 0; i < 4; i++) { // boční hříva za hlavou
        ell(g, -40 - sw * 0.8, -6 + i * 12, 9, 12.5, 0.2); fs(g, MANE[i], null);
        ell(g, 40 + sw * 0.8, -6 + i * 12, 9, 12.5, -0.2); fs(g, MANE[(i + 2) % 5], null);
      }
      earPoint(-24, -29, 15, 19, earSide(-1, 0.3), p.fur, p.inner);
      earPoint(24, -29, 15, 19, earSide(1, 0.3), p.fur, p.inner);
    },
    faceFront: function () {
      var g = R.g, p = R.p;
      ell(g, -2.6, 11.4, 1.5, 1.1); fs(g, p.nose); ell(g, 2.6, 11.4, 1.5, 1.1); fs(g, p.nose);
    },
    top: function () {
      var g = R.g, p = R.p, i;
      for (i = 0; i < 4; i++) { // trojí ofina
        ell(g, -15 + i * 9, -30 + (i % 2) * 2, 7.5, 11, 0.5 - i * 0.28); fs(g, MANE[(i + 1) % 5], null);
      }
      g.save(); g.translate(6, -31); g.rotate(0.14); // roh
      g.beginPath(); g.moveTo(-6, 2); g.lineTo(0, -29); g.lineTo(6, 2); g.closePath(); fs(g, '#fde68a', '#d9a520', 1.8);
      g.strokeStyle = '#e0a82a'; g.lineWidth = 1.7;
      for (i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-5 + i * 0.6, -3 - i * 8); g.lineTo(5 - i * 0.6, -8 - i * 8); g.stroke(); }
      g.restore();
    }
  };

  SP.koala = {
    pal: { fur: '#adafc9', belly: '#e9e7f3', shade: '#8f91af', inner: '#f4f2fb', nose: '#3a3550', cheek: '#ffa3c4', line: '#6f7191' },
    hx: 44, hy: 36, bx: 33, by: 28, ex: 14.5, ey: 3, er: 5.4, my: 24, mw: 6.5, ck: [30, 14], nose: 11,
    earsBack: function () {
      var g = R.g, p = R.p, i, s, P = R.P;
      for (s = -1; s <= 1; s += 2) {
        g.save(); g.rotate(s * (s < 0 ? P.earL : P.earR) * 0.5);
        ell(g, s * 38, -21, 16.5, 16.5); fs(g, p.fur, p.line);
        ell(g, s * 38, -20, 10, 10); fs(g, p.inner);
        for (i = 0; i < 6; i++) { ell(g, s * 38 + Math.cos(i * 1.05) * 9.5, -20 + Math.sin(i * 1.05) * 9.5, 3, 3); fs(g, p.inner); }
        g.restore();
      }
    },
    faceFront: function () {
      var g = R.g, p = R.p;
      rr(g, -8.5, 4.5, 17, 15, 7.5); fs(g, p.nose);
      ell(g, -2.8, 8, 2.6, 1.5, -0.4); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
    }
  };

  SP.pig = {
    pal: { fur: '#ffb7cb', belly: '#ffd6e1', shade: '#ff9ab5', inner: '#ff8fae', nose: '#ff93b3', nostril: '#c93e69', cheek: '#ff7fa3', line: '#d8708f', limb: '#ffa3bc' },
    hx: 45, hy: 35, bx: 33, by: 28, ex: 18, ey: 1, er: 6, my: 25.5, mw: 5.5, ck: [32, 12], nose: 12,
    back: function () {
      var g = R.g, p = R.p, i, a, r;
      g.save(); g.translate(R.P.bx * 0.85, -26); g.rotate(R.P.tail * 1.5);
      g.beginPath();
      for (i = 0; i <= 26; i++) { a = i * 0.5; r = 1.2 + i * 0.3; if (i) g.lineTo(Math.cos(a) * r + 6, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r + 6, Math.sin(a) * r); }
      g.lineWidth = 5.8; g.strokeStyle = p.line; g.stroke(); g.lineWidth = 3.2; g.strokeStyle = p.fur; g.stroke();
      g.restore();
    },
    earsBack: function () {
      var p = R.p;
      earPoint(-30, -22, 22, 20, earSide(-1, 0.75), p.fur, p.inner);
      earPoint(30, -22, 22, 20, earSide(1, 0.75), p.fur, p.inner);
    },
    faceBack: function () {
      var g = R.g, p = R.p;
      ell(g, 0, 13, 14, 10.5); fs(g, p.nose, p.line, 1.8);
    },
    faceFront: function () {
      var g = R.g, p = R.p;
      ell(g, -4.8, 13, 2.1, 3.2); fs(g, p.nostril); ell(g, 4.8, 13, 2.1, 3.2); fs(g, p.nostril);
    }
  };

  SP.penguin = {
    pal: { fur: '#3a3760', belly: '#f6f3ff', shade: '#2b2848', beak: '#fbbf24', beakLine: '#c27a0a', cheek: '#f9a8d4', line: '#7a75a8', feet: '#fbbf24' },
    hx: 42, hy: 34, bx: 33, by: 30, ex: 14, ey: 6, er: 6, my: 16, mw: 6, ck: [29, 15], nose: 14, bellyRx: 0.74, bellyRy: 0.82, flipper: true, noMouth: true,
    faceBack: function () {
      var g = R.g, p = R.p;
      ell(g, -10.5, 8, 15, 17); g.fillStyle = p.belly; g.fill();
      ell(g, 10.5, 8, 15, 17); g.fill();
      ell(g, 0, 17, 21, 11); g.fill();
    },
    faceFront: function () {
      var g = R.g, p = R.p, P = R.P, mo = P.mo;
      if (mo > 0.08) { ell(g, 0, 15.8 + mo * 2.6, 5.4, mo * 4.2 + 0.1); fs(g, MOUTH); if (mo > 0.4) { ell(g, 0, 17.5 + mo * 4, 3.2, 1.8); fs(g, TONGUE); } }
      ell(g, 0, 17.4 + mo * 5.4, 5.8, 3.2); fs(g, p.beak, p.beakLine, 1.6); // spodni zob
      ell(g, 0, 13.4 - mo * 0.6, 7.4, 4.3); fs(g, p.beak, p.beakLine, 1.6); // horni zob
      ell(g, -2, 12.2 - mo * 0.6, 2.3, 1); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fill();
    }
  };

  // prevod palet na RGB (jednou)
  (function initSp() {
    var k, key, c;
    for (k in SP) {
      SP[k].name = k; SP[k].rgb = {};
      for (key in SP[k].pal) SP[k].rgb[key] = hexRgb(SP[k].pal[key]);
    }
  })();

  // paleta upravena podle nalady (desaturace + nazelenaly nadech)
  var SICK_T = [135, 172, 128];
  function buildPal(pet) {
    var rgb = pet.S.rgb, sat = pet.cur.sat, gr = pet.cur.green, out = pet.pal, k, c, l, r, g, b;
    for (k in rgb) {
      c = rgb[k]; l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      r = l + (c[0] - l) * sat; g = l + (c[1] - l) * sat; b = l + (c[2] - l) * sat;
      r = r * (1 - 0.26 * gr) + SICK_T[0] * 0.26 * gr; g = g * (1 - 0.26 * gr) + SICK_T[1] * 0.26 * gr; b = b * (1 - 0.26 * gr) + SICK_T[2] * 0.26 * gr;
      out[k] = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
    }
    if (!rgb.limb) out.limb = out.fur;
    pet.palSat = sat; pet.palGr = gr;
  }

  // ---------- stav / normalizace ----------
  function normState(s) {
    var o = { species: 'cat', mood: 'ok', stage: 0, acc: { bowl: null, dumbbell: false, bow: false, sparkles: false, bubbles: false, books: false, extras: [] } }, a, i, ex;
    s = s || {};
    if (SP[s.species]) o.species = s.species;
    if (MOOD[s.mood]) o.mood = s.mood;
    o.stage = clamp(Math.round(+s.stage || 0), 0, 3);
    a = s.acc || {};
    o.acc.bowl = a.bowl === 'full' ? 'full' : (a.bowl === 'empty' ? 'empty' : null);
    o.acc.dumbbell = !!a.dumbbell; o.acc.bow = !!a.bow; o.acc.sparkles = !!a.sparkles; o.acc.bubbles = !!a.bubbles; o.acc.books = !!a.books;
    if (a.extras && a.extras.length) for (i = 0; i < a.extras.length && o.acc.extras.length < 4; i++) { ex = a.extras[i]; if (typeof ex === 'string' && ex) o.acc.extras.push(ex); }
    return o;
  }

  function applyTargets(pet, snap) {
    var st = pet.state, m = MOOD[st.mood], a = st.acc, t = pet.tgt, i, ex = pet.ex;
    for (i = 0; i < MP.length; i++) t[MP[i]] = m[MP[i]];
    t.bowl = a.bowl ? 1 : 0; t.bowlFull = a.bowl === 'full' ? 1 : 0; t.dumbbell = a.dumbbell ? 1 : 0; t.bow = a.bow ? 1 : 0;
    t.sparkles = a.sparkles ? 1 : 0; t.bubbles = a.bubbles ? 1 : 0; t.books = a.books ? 1 : 0; t.crown = st.stage === 3 ? 1 : 0;
    pet.stT = STAGE[st.stage];
    for (i = 0; i < 4; i++) {
      if (a.extras[i]) { if (ex[i].s !== a.extras[i]) ex[i].s = a.extras[i]; ex[i].t = 1; } else ex[i].t = 0;
    }
    if (st.species !== pet.S.name && !pet.pendingSp) { pet.pendingSp = st.species; pet.popT = 0; }
    if (snap) {
      for (i = 0; i < ALLK.length; i++) pet.cur[ALLK[i]] = t[ALLK[i]];
      pet.stg.s = pet.stT.s; pet.stg.hk = pet.stT.hk; pet.stg.bk = pet.stT.bk; pet.stg.ek = pet.stT.ek;
      for (i = 0; i < 4; i++) ex[i].a = ex[i].t;
      if (pet.pendingSp) { pet.S = SP[pet.pendingSp]; pet.pendingSp = null; pet.popT = 1; }
      pet.pop = pet.popT = 1;
      buildPal(pet);
    }
  }

  function newPet(canvas, state) {
    var i, pet = {
      canvas: canvas, g: canvas.getContext('2d'), state: normState(state), S: null, cur: {}, tgt: {}, pal: {}, palSat: -1, palGr: -1,
      stg: { s: 1, hk: 1, bk: 1, ek: 1 }, stT: STAGE[2], P: {}, ex: [], parts: [], pop: 1, popT: 1, pendingSp: null,
      tt: 0, ph: 0, seed: (Math.random() * 1e9 | 0) + 12345, k: 1, ox: 0, oy: 0, sized: false, dirty: true, inView: true,
      nextBlink: 1.5, blinkT: -1, nextLook: 1, ltx: 0, lty: 0, lx: 0, ly: 0, glance: 0, nextGlance: 4, hopT: -1, nextHop: 3,
      flexT: -1, nextFlex: 4, nextHeart: 0.3, twT: -1, twSide: 1, nextTw: 2.5, poke: -1, feedS: null, glow: null, glowG: null, lastTs: 0
    };
    pet.S = SP[pet.state.species];
    for (i = 0; i < ALLK.length; i++) { pet.cur[ALLK[i]] = 0; pet.tgt[ALLK[i]] = 0; }
    for (i = 0; i < 4; i++) pet.ex.push({ s: '', a: 0, t: 0 });
    for (i = 0; i < 18; i++) pet.parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, max: 1, kind: 0, size: 6, col: '#f472b6' });
    applyTargets(pet, true);
    return pet;
  }

  // ---------- particles (srdicka, hvezdicky) ----------
  function spawn(pet, kind, x, y, vx, vy, max, size, col) {
    var i, q;
    for (i = 0; i < pet.parts.length; i++) {
      q = pet.parts[i];
      if (!q.on) { q.on = true; q.kind = kind; q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.age = 0; q.max = max; q.size = size; q.col = col; return; }
    }
  }
  var HEART_COLS = ['#f472b6', '#fb7185', '#f9a8d4', '#fbbf24'];
  function spawnHeart(pet, x, y, big) {
    var P = pet.P;
    spawn(pet, 0, x, y, (rnd(pet) - 0.5) * 16, -(22 + rnd(pet) * 14), 1.5 + rnd(pet) * 0.5, (big ? 7 : 4.6) + rnd(pet) * 2.4, HEART_COLS[(rnd(pet) * 4) | 0]);
    return P;
  }

  // ---------- krok simulace + poza ----------
  function approach(pet, dt, snap) {
    var c = pet.cur, t = pet.tgt, k = snap ? 1 : 1 - Math.exp(-dt * 3.4), k2 = snap ? 1 : 1 - Math.exp(-dt * 5.5), i, key, st = pet.stg, sT = pet.stT;
    for (i = 0; i < MP.length; i++) { key = MP[i]; c[key] += (t[key] - c[key]) * k; }
    for (i = 0; i < ACCK.length; i++) { key = ACCK[i]; c[key] += (t[key] - c[key]) * k2; }
    st.s += (sT.s - st.s) * k; st.hk += (sT.hk - st.hk) * k; st.bk += (sT.bk - st.bk) * k; st.ek += (sT.ek - st.ek) * k;
    for (i = 0; i < 4; i++) pet.ex[i].a += (pet.ex[i].t - pet.ex[i].a) * k2;
    // vymena druhu: zmensi -> prepne -> zvetsi
    if (pet.pendingSp) {
      pet.pop += (0 - pet.pop) * (1 - Math.exp(-dt * 14));
      if (pet.pop < 0.06) { pet.S = SP[pet.pendingSp]; pet.pendingSp = null; pet.palSat = -1; }
    } else pet.pop += (1 - pet.pop) * (1 - Math.exp(-dt * 9));
    if (Math.abs(pet.palSat - c.sat) > 0.004 || Math.abs(pet.palGr - c.green) > 0.004) buildPal(pet);
  }

  function step(pet, dt, still) {
    var c = pet.cur, st = pet.state, mood = st.mood, i, q, P = pet.P;
    approach(pet, dt, still);
    if (still) { pet.tt = 1; pet.ph = 0; } else { pet.tt += dt; pet.ph += dt * c.speed; }
    var tt = pet.tt;

    if (!still) {
      // mrkani
      if (pet.blinkT >= 0) { pet.blinkT += dt; if (pet.blinkT > 0.2) { pet.blinkT = -1; pet.nextBlink = tt + (rnd(pet) < 0.2 ? 0.2 : 2 + rnd(pet) * 3.2); } }
      else if (tt >= pet.nextBlink) pet.blinkT = 0;
      // rozhlizeni
      if (tt >= pet.nextLook) {
        pet.ltx = rnd(pet) < 0.3 ? 0 : (rnd(pet) * 2 - 1) * 0.9; pet.lty = (rnd(pet) * 2 - 1) * 0.5; pet.nextLook = tt + 1.4 + rnd(pet) * 2.6;
      }
      if (c.books > 0.5 && pet.glance <= 0 && tt >= pet.nextGlance) { pet.glance = 1.4; pet.nextGlance = tt + 6 + rnd(pet) * 5; }
      var gx = pet.ltx, gy = pet.lty;
      if (pet.glance > 0) { pet.glance -= dt; gx = 1; gy = 0.45; }
      gx += (-1 - gx) * c.look; gy += (0.7 - gy) * c.look;
      var lk = 1 - Math.exp(-dt * 7);
      pet.lx += (gx - pet.lx) * lk; pet.ly += (gy - pet.ly) * lk;
      // hop (stastna)
      if (pet.hopT >= 0) { pet.hopT += dt; if (pet.hopT > 0.55) pet.hopT = -1; }
      else if (mood === 'happy' && tt >= pet.nextHop) { pet.hopT = 0; pet.nextHop = tt + 3.5 + rnd(pet) * 3; }
      // flex s cinkou
      if (pet.flexT >= 0) { pet.flexT += dt; if (pet.flexT > 1.4) pet.flexT = -1; }
      else if (st.acc.dumbbell && (mood === 'ecstatic' || mood === 'happy') && tt >= pet.nextFlex) { pet.flexT = 0; pet.nextFlex = tt + 6 + rnd(pet) * 5; }
      // usi
      if (pet.twT >= 0) { pet.twT += dt; if (pet.twT > 0.28) pet.twT = -1; }
      else if (tt >= pet.nextTw) { pet.twT = 0; pet.twSide = rnd(pet) < 0.5 ? -1 : 1; pet.nextTw = tt + 3 + rnd(pet) * 4; }
      // poke / feed casovace
      if (pet.poke >= 0) { pet.poke += dt; if (pet.poke > 0.8) pet.poke = -1; }
      if (pet.feedS) { pet.feedS.t += dt; if (pet.feedS.t > 1.45) pet.feedS = null; }
    }
    pose(pet, dt, still);
    if (still) return;

    // srdicka (extaze)
    if (c.hearts > 0.4 && tt >= pet.nextHeart) { pet.nextHeart = tt + 0.5 + rnd(pet) * 0.4; spawnHeart(pet, CX + P.x + (rnd(pet) - 0.5) * 60, P.topY + 6, false); }
    // castice
    for (i = 0; i < pet.parts.length; i++) {
      q = pet.parts[i]; if (!q.on) continue;
      q.age += dt; if (q.age >= q.max) { q.on = false; continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.kind === 1 ? 30 : 0) * dt;
    }
  }

  function pose(pet, dt, still) {
    var c = pet.cur, P = pet.P, S = pet.S, st = pet.stg, ph = pet.ph, tt = pet.tt, f = pet.feedS, i;
    var ecs = c.bounce, bph = ph * 5.4, hopv = Math.abs(Math.sin(bph));
    var lift = hopv * 15 * ecs, sq = 0.018 * Math.sin(ph * 2.3) + ecs * (0.05 * hopv - 0.09 * Math.pow(1 - hopv, 6));
    var rot = 0, giggle = 0, feedOpen = 0, chew = 0, chewHappy = 0, u;

    if (pet.hopT >= 0) { u = pet.hopT / 0.55; lift += Math.sin(u * PI) * 9; sq += 0.04 * Math.sin(u * PI) - 0.06 * Math.pow(1 - sstep(0, 0.2, u), 2) * (1 - u); }
    if (pet.poke >= 0) {
      u = pet.poke / 0.8;
      lift += Math.sin(clamp(u * 1.9, 0, 1) * PI) * 13 * (1 - u * 0.5);
      sq += u < 0.12 ? -0.1 * (u / 0.12) : 0.03 * Math.sin(clamp(u * 1.9, 0, 1) * PI);
      rot += Math.sin(pet.poke * 38) * 0.04 * (1 - u);
      giggle = 1 - sstep(0.6, 0.95, u);
    }
    if (f) {
      u = f.t;
      feedOpen = sstep(0.15, 0.42, u) * (1 - sstep(0.46, 0.55, u));
      if (u > 0.5) {
        var cu = (u - 0.5) / 0.85;
        chew = Math.abs(Math.sin(cu * PI * 4)) * clamp(1 - cu, 0, 1);
        chewHappy = sstep(0.5, 0.6, u) * (1 - sstep(1.1, 1.4, u));
        sq += -0.03 * chew; lift += chew * 2.2;
        if (!f.burst) { f.burst = true; for (i = 0; i < 5; i++) spawn(pet, 1, P.mouthWX || CX, P.mouthWY || 100, (rnd(pet) - 0.5) * 70, -20 - rnd(pet) * 40, 0.8, 4 + rnd(pet) * 2.5, i % 2 ? GOLD : '#fff'); spawnHeart(pet, P.mouthWX || CX, (P.topY || 70) + 6, true); }
      }
    }
    var fl = 0;
    if (pet.flexT >= 0) fl = Math.pow(Math.sin(clamp(pet.flexT / 1.4, 0, 1) * PI), 0.6);
    P.flexV = fl;
    var gate = Math.pow(Math.max(0, Math.sin(tt * 1.9)), 4), wob = c.wobble * (0.4 + 0.6 * gate);
    rot += Math.sin(ph * 1.6) * 0.03 * c.sway + Math.sin(bph * 0.5) * 0.05 * ecs + Math.sin(tt * 30) * 0.018 * wob + fl * 0.04;
    sq -= 0.035 * c.droop;

    var sy = 1 + sq, sx = 1 - sq * 0.6, popS = 0.25 + 0.75 * clamp(pet.pop, 0, 1);
    P.s = st.s; P.sy = Math.max(0.05, st.s * sy * popS); P.sx = Math.max(0.05, st.s * sx * popS);
    P.lift = Math.max(0, lift) * st.s; P.rot = rot;
    P.x = Math.sin(ph * 1.6) * 1.8 * c.sway + Math.sin(bph * 0.5) * 3 * ecs;
    P.bx = S.bx * st.bk; P.by = S.by * st.bk;
    P.bodyCy = -4 - P.by; P.headCy = (P.bodyCy - P.by) + 12 - S.hy * st.hk;
    // hlava
    P.headDY = 3 * c.droop + Math.sin(ph * 2.3) * 0.6 - fl * 1;
    P.headDX = -3 * c.look + Math.sin(ph * 1.6) * 1.5 * c.sway;
    P.headRot = Math.sin(ph * 1.3) * 0.03 * c.sway + Math.sin(ph * 1.1) * 0.06 * c.plead + Math.sin(ph * 0.5 + 1) * 0.05 * c.droop - 0.07 * c.look + Math.sin(bph * 0.5) * 0.08 * ecs + (pet.poke >= 0 ? Math.sin(pet.poke * 40) * 0.05 * giggle : 0);
    // usi
    var flop = -Math.cos(bph) * 0.16 * ecs, tw = 0, twd = 0;
    if (pet.twT >= 0) tw = Math.sin(pet.twT / 0.28 * PI) * 0.28;
    P.earL = c.droop * 0.75 + Math.sin(ph * 1.9) * 0.05 + flop + (pet.twSide < 0 ? tw : 0);
    P.earR = c.droop * 0.75 + Math.sin(ph * 2.1 + 1.3) * 0.05 + flop + (pet.twSide > 0 ? tw : 0);
    // ocas
    var hp = Math.max(0, c.smile);
    P.tail = (0.12 + 0.25 * hp + 0.2 * ecs) * Math.sin(ph * (2.5 + 5 * hp + 3 * ecs)) - 0.45 * c.droop;
    // ruce
    var up = ecs * (0.9 + 0.7 * hopv);
    P.armL = 0.28 + 0.12 * Math.sin(ph * 2) - 0.18 * c.droop + up + fl * 2.1;
    P.armR = 0.28 + 0.12 * Math.sin(ph * 2 + 1) - 0.18 * c.droop + up + fl * 2.1;
    // oci + ustni
    P.open = c.open; P.blink = pet.blinkT >= 0 ? Math.sin(pet.blinkT / 0.2 * PI) : 0;
    P.happy = Math.max(c.happy, giggle, chewHappy); P.plead = c.plead * (1 - P.happy);
    P.brow = clamp(c.brow + c.plead * 0.45, 0, 1) * (1 - P.happy);
    P.lx = pet.lx; P.ly = pet.ly;
    P.smile = Math.max(c.smile, giggle * 0.9, feedOpen * 0.6, chewHappy * 0.8);
    P.mo = clamp(Math.max(c.mouth * (0.85 + 0.15 * Math.sin(bph)), giggle * 0.8, feedOpen * 0.95, chew > 0 ? 0.15 + chew * 0.6 : 0), 0, 1);
    P.narrow = c.narrow * (1 - Math.max(giggle, feedOpen, chew));
    P.blush = clamp(c.blush + giggle * 0.4 + chewHappy * 0.4, 0, 1);
    P.chew = chew;
    // svetove souradnice (pro letici jidlo, castice, mrak)
    P.topY = GROUND - P.lift + P.sy * (P.headCy + P.headDY - S.hy * st.hk);
    P.mouthWX = CX + P.x + P.headDX * P.sx;
    P.mouthWY = GROUND - P.lift + P.sy * (P.headCy + P.headDY + S.my * st.hk);
    if (!P.flexV) P.flexV = 0;
  }

  // ---------- kresleni postavy ----------
  function drawEye(side) {
    var g = R.g, S = R.S, P = R.P, p = R.p, st = R.st;
    var er = S.er * st.ek * (1 + 0.2 * P.plead), rx = er, ry = er * 1.22;
    var ex = side * S.ex + P.lx * 2.4, ey = S.ey + P.ly * 1.8;
    var openEff = P.open * (1 - P.blink), lid = clamp(-1 + 2 * (1 - openEff), -1, 1), a0;
    var open = 1 - P.happy;
    if (open > 0.02 && lid < 0.96) {
      g.globalAlpha *= open; a0 = Math.asin(lid);
      g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, a0, PI - a0); g.closePath();
      g.fillStyle = S.sclera ? '#f8f6ff' : EYE; g.fill();
      g.save(); g.clip();
      if (S.sclera) { ell(g, ex + P.lx * 1.4, ey + P.ly * 1.2, rx * 0.66, ry * 0.66); g.fillStyle = EYE; g.fill(); }
      if (P.plead > 0.02) { g.globalAlpha *= P.plead; ell(g, ex, ey + ry * 0.3, rx * 0.74, ry * 0.62); g.fillStyle = '#6a4c93'; g.fill(); g.globalAlpha /= P.plead; }
      g.fillStyle = '#ffffff';
      var sh = rx * (0.34 + 0.12 * P.plead);
      ell(g, ex + rx * 0.33, ey - ry * 0.34, sh, sh); g.fill();
      g.globalAlpha *= 0.75; ell(g, ex - rx * 0.36, ey + ry * 0.4, rx * 0.17, rx * 0.17); g.fill();
      g.restore();
      g.globalAlpha /= open;
    }
    if (P.happy > 0.02) { // ^^
      g.globalAlpha *= P.happy; g.strokeStyle = S.sclera ? '#f4f1ff' : EYE; g.lineWidth = 3.4;
      g.beginPath(); g.arc(ex, ey + 3.5, rx * 0.95, PI * 1.1, PI * 1.9); g.stroke();
      g.globalAlpha /= P.happy;
    }
    if (P.brow > 0.05) { // oboci (smutek / nemoc / prosba)
      g.globalAlpha *= P.brow * 0.85; g.strokeStyle = S.browCol || 'rgba(42,34,56,0.9)'; g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(ex - side * 7, ey - ry - 4.5 - P.brow * 3.2); g.lineTo(ex + side * 6.5, ey - ry - 3 + P.brow * 2.4); g.stroke();
      g.globalAlpha /= (P.brow * 0.85);
    }
  }

  function drawMouth() {
    var g = R.g, S = R.S, P = R.P, p = R.p;
    var y0 = S.my, w = S.mw * (1 - 0.4 * P.narrow), sm = P.smile, o = P.mo;
    var cy = y0 - sm * 1.2, uc = cy + sm * 8, lc = uc + o * 14;
    g.beginPath(); g.moveTo(-w, cy); g.quadraticCurveTo(0, uc, w, cy); g.quadraticCurveTo(0, lc, -w, cy); g.closePath();
    if (o > 0.06) {
      g.globalAlpha *= Math.min(1, o * 6); g.fillStyle = MOUTH; g.fill(); g.globalAlpha /= Math.min(1, o * 6);
      if (o > 0.3) { g.save(); g.clip(); ell(g, 0, cy + sm * 4 + o * 8.5, w * 0.6, 4.6); g.fillStyle = TONGUE; g.fill(); g.restore(); }
    }
    g.strokeStyle = EYE; g.lineWidth = 2.1; g.beginPath();
    g.moveTo(-w, cy); g.quadraticCurveTo(0, uc, w, cy); g.quadraticCurveTo(0, lc, -w, cy); g.stroke();
  }

  function drawBody() {
    var g = R.g, S = R.S, P = R.P, p = R.p, s;
    ell(g, 0, P.bodyCy, P.bx, P.by); fs(g, p.fur, p.line);
    ell(g, 0, P.bodyCy + P.by * 0.16, P.bx * (S.bellyRx || 0.62), P.by * (S.bellyRy || 0.72)); g.fillStyle = p.belly; g.fill();
    if (S.body) S.body();
    for (s = -1; s <= 1; s += 2) { // nohy
      if (S.flipper) { ell(g, s * P.bx * 0.5, -4, 13, 5.5); fs(g, p.feet, p.beakLine, 1.8); }
      else { ell(g, s * P.bx * 0.5, -5, 12.5 * (S.name === 'rabbit' ? 1.15 : 1), 6.6); fs(g, p.limb, p.line); }
    }
  }
  function drawArms() {
    var g = R.g, S = R.S, P = R.P, p = R.p, s, a;
    for (s = -1; s <= 1; s += 2) {
      a = s < 0 ? P.armL : P.armR;
      g.save(); g.translate(s * P.bx * 0.86, P.bodyCy - P.by * 0.3); g.rotate(-s * a);
      if (S.flipper) { ell(g, 0, 11, 6.4, 15); fs(g, p.fur, p.line); } else { ell(g, 0, 9, 7.4, 12.5); fs(g, p.limb, p.line); }
      g.restore();
    }
  }

  function drawBow(a) {
    var g = R.g, S = R.S;
    g.save(); g.translate(-S.hx * 0.5, -S.hy * 0.84); g.rotate(-0.4); g.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a); g.globalAlpha *= a;
    ell(g, -8, 0, 8.5, 6, -0.45); fs(g, '#f472b6', '#be2e7f', 1.6);
    ell(g, 8, 0, 8.5, 6, 0.45); fs(g, '#f472b6', '#be2e7f', 1.6);
    ell(g, -9, -1.5, 3.2, 1.6, -0.45); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill();
    ell(g, 7, -1.5, 3.2, 1.6, 0.45); g.fill();
    ell(g, 0, 0, 4, 4); fs(g, '#ec4899', '#be2e7f', 1.6);
    g.restore();
  }
  function drawCrown(a, tt) {
    var g = R.g, S = R.S, bx = S.crownX || 0;
    g.save(); g.translate(bx, -S.hy + 7); g.rotate(S.crownRot || 0); g.scale(0.5 + 0.5 * a, 0.5 + 0.5 * a); g.globalAlpha *= a;
    g.beginPath(); g.moveTo(-14, 0); g.lineTo(-15, -14); g.lineTo(-7, -7); g.lineTo(0, -17); g.lineTo(7, -7); g.lineTo(15, -14); g.lineTo(14, 0); g.closePath();
    fs(g, GOLD, '#b7791f', 1.8);
    rr(g, -14, -4, 28, 5, 2); fs(g, '#fde68a', '#b7791f', 1.2);
    ell(g, 0, -17.5, 2.2, 2.2); fs(g, '#f472b6'); ell(g, -15, -14.5, 2, 2); fs(g, GREEN); ell(g, 15, -14.5, 2, 2); fs(g, '#60a5fa');
    var tw = 0.5 + 0.5 * Math.sin(tt * 3);
    g.globalAlpha *= tw; g.fillStyle = '#fff'; star(g, 7, -10, 3 + tw * 2, tt); g.fill();
    g.restore();
  }
  function drawThermo(a) {
    var g = R.g, S = R.S;
    g.save(); g.translate(5, S.my + 1.5); g.rotate(1.38); g.globalAlpha *= a;
    g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -32); g.lineWidth = 7; g.strokeStyle = '#8b88a8'; g.stroke();
    g.lineWidth = 5; g.strokeStyle = '#e8eef7'; g.stroke();
    g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -17); g.lineWidth = 3; g.strokeStyle = '#ef4444'; g.stroke();
    g.strokeStyle = '#8b88a8'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-2, -22); g.lineTo(2, -22); g.moveTo(-2, -26); g.lineTo(2, -26); g.moveTo(-2, -30); g.lineTo(2, -30); g.stroke();
    g.restore();
  }

  function drawPet(pet) {
    var g = R.g, P = pet.P, S = pet.S, c = pet.cur, st = pet.stg, tt = pet.tt, s, ph = pet.ph;
    g.save(); g.translate(CX + P.x, GROUND - P.lift); g.rotate(P.rot); g.scale(P.sx, P.sy);
    if (S.back) S.back();
    drawBody();
    if (P.flexV <= 0.3) drawArms();
    // hlava
    g.save(); g.translate(P.headDX, P.headCy + P.headDY); g.rotate(P.headRot); g.scale(st.hk, st.hk);
    if (S.earsBack) S.earsBack();
    ell(g, 0, 0, S.hx, S.hy); fs(g, R.p.fur, R.p.line);
    if (S.faceBack) S.faceBack();
    // pipka
    g.globalAlpha = P.blush * 0.75;
    ell(g, -S.ck[0], S.ck[1], 7.5, 4.6); fs(g, R.p.cheek); ell(g, S.ck[0], S.ck[1], 7.5, 4.6); fs(g, R.p.cheek);
    g.globalAlpha = 1;
    drawEye(-1); drawEye(1);
    if (!S.noMouth) drawMouth();
    if (S.faceFront) S.faceFront();
    if (c.thermo > 0.02) drawThermo(c.thermo);
    if (S.earsFront) S.earsFront();
    if (S.top) S.top();
    if (c.bow > 0.02) drawBow(c.bow);
    if (c.crown > 0.02) drawCrown(c.crown, tt);
    // slza / pot
    if (c.tear > 0.02) {
      var u = (tt * 0.55) % 1, tx = S.ex + 3, ty = S.ey + S.er * 1.2 + 4;
      g.globalAlpha = c.tear; g.fillStyle = '#7dd3fc'; ell(g, tx, ty, 2.4, 3); g.fill();
      g.globalAlpha = c.tear * (1 - u * u * u); droplet(g, tx, ty + u * u * 22, 3.1); g.fill(); g.globalAlpha = 1;
    }
    if (c.sweat > 0.02) {
      var v = (tt * 0.5) % 1;
      g.globalAlpha = c.sweat * (1 - v * v); g.fillStyle = '#93c5fd'; droplet(g, S.hx * 0.78, -S.hy * 0.36 + v * 16, 3.3); g.fill(); g.globalAlpha = 1;
    }
    g.restore();
    if (P.flexV > 0.3) drawArms();
    g.restore();
  }

  // ---------- scena: prislusenstvi ----------
  function drawBowl(pet) {
    var g = R.g, c = pet.cur, a = c.bowl, bf = c.bowlFull, tt = pet.tt, i, u;
    if (a < 0.02) return;
    g.save(); g.translate(98, GROUND); g.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a); g.globalAlpha = a;
    g.beginPath(); g.moveTo(-26, -18); g.bezierCurveTo(-25, -3, -15, 1, 0, 1); g.bezierCurveTo(15, 1, 25, -3, 26, -18); g.closePath(); fs(g, ACCENT, '#6d4fd6', 2);
    g.beginPath(); g.moveTo(-21, -11); g.quadraticCurveTo(-17, -3, -9, -3); g.lineWidth = 3; g.strokeStyle = '#c4b5fd'; g.stroke();
    ell(g, 0, -18, 26, 6.5); fs(g, '#4b3a9c', '#c4b5fd', 2);
    if (bf > 0.02) {
      g.globalAlpha = a * bf;
      g.beginPath(); g.ellipse(0, -18.5, 21, Math.max(0.01, 13 * bf), 0, PI, TAU); g.closePath(); fs(g, '#f59e0b', '#b45309', 1.8);
      g.fillStyle = '#fcd34d'; ell(g, -9, -24 * bf - 1, 2.4, 2.4); g.fill(); ell(g, 6, -27 * bf, 2.4, 2.4); g.fill();
      g.fillStyle = '#b45309'; ell(g, 1, -21 * bf, 2.2, 2.2); g.fill(); ell(g, 11, -21 * bf, 2.2, 2.2); g.fill();
      g.fillStyle = GREEN; ell(g, -3, -29 * bf, 2.2, 2.2); g.fill();
      g.lineWidth = 2; g.lineCap = 'round';
      for (i = 0; i < 3; i++) {
        u = (tt * 0.6 + i * 0.33) % 1;
        g.strokeStyle = 'rgba(255,255,255,' + (0.55 * (1 - u)).toFixed(3) + ')';
        g.beginPath(); g.moveTo(-8 + i * 8, -33 - u * 16); g.bezierCurveTo(-4 + i * 8, -37 - u * 16, -12 + i * 8, -41 - u * 16, -8 + i * 8, -45 - u * 16); g.stroke();
      }
    }
    g.restore();
  }
  function drawDumbbell(pet) {
    var g = R.g, c = pet.cur, a = c.dumbbell, sh = pet.flexT >= 0 ? Math.sin(pet.tt * 34) * 0.05 : 0;
    if (a < 0.02) return;
    g.save(); g.translate(262, GROUND); g.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a); g.globalAlpha = a; g.rotate(sh);
    rr(g, -17, -16, 34, 5.5, 2.5); fs(g, '#d6d1ec', '#8d86b0', 1.6);
    rr(g, -28, -27, 10, 26, 4); fs(g, ACCENT, '#6d4fd6', 1.8); rr(g, 18, -27, 10, 26, 4); fs(g, ACCENT, '#6d4fd6', 1.8);
    rr(g, -18.5, -22, 5, 17, 2); fs(g, '#7c5ce0', '#6d4fd6', 1.4); rr(g, 13.5, -22, 5, 17, 2); fs(g, '#7c5ce0', '#6d4fd6', 1.4);
    g.fillStyle = 'rgba(255,255,255,0.35)'; rr(g, -26, -24, 2.6, 14, 1.3); g.fill(); rr(g, 20, -24, 2.6, 14, 1.3); g.fill();
    g.restore();
  }
  var BOOK_C = [GREEN, GOLD, ACCENT], BOOK_W = [40, 34, 37], BOOK_X = [0, 2, -2];
  function drawBooks(pet) {
    var g = R.g, c = pet.cur, a = c.books, i, y = 0, w, x;
    if (a < 0.02) return;
    g.save(); g.translate(318, GROUND); g.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a); g.globalAlpha = a;
    for (i = 0; i < 3; i++) {
      w = BOOK_W[i]; x = BOOK_X[i] - w / 2;
      rr(g, x, y - 10, w, 10, 2.5); fs(g, BOOK_C[i], 'rgba(0,0,0,0.35)', 1.5);
      g.fillStyle = '#fff7e6'; rr(g, x + w - 7, y - 8.2, 5.5, 6.4, 1); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; rr(g, x + 3, y - 8.4, w - 14, 1.8, 0.9); g.fill();
      y -= 10;
    }
    g.fillStyle = '#f472b6'; rr(g, 9, -31, 3.4, 9, 1); g.fill(); // zalozka
    g.restore();
  }

  function drawGlow(pet) {
    var g = R.g, a = pet.cur.glow;
    if (a < 0.02) return;
    if (!pet.glowG || pet.glowCtx !== g) {
      pet.glowG = g.createRadialGradient(0, 0, 8, 0, 0, 120); pet.glowCtx = g;
      pet.glowG.addColorStop(0, 'rgba(251,191,36,0.55)'); pet.glowG.addColorStop(0.55, 'rgba(251,191,36,0.2)'); pet.glowG.addColorStop(1, 'rgba(251,191,36,0)');
    }
    g.save(); g.translate(CX, GROUND - 80); g.globalAlpha = a * (0.8 + 0.2 * Math.sin(pet.tt * 2.2)); g.fillStyle = pet.glowG;
    g.fillRect(-125, -125, 250, 250); g.restore();
  }
  function drawShadow(pet) {
    var g = R.g, P = pet.P, k = clamp(1 - P.lift / 90, 0.5, 1), w = (R.S.bx * pet.stg.bk + 14) * pet.stg.s * k * pet.pop;
    ell(g, CX + P.x * 0.5, GROUND + 2, Math.max(w, 1), Math.max(w * 0.2, 0.5)); g.fillStyle = 'rgba(0,0,0,' + (0.32 * k).toFixed(3) + ')'; g.fill();
  }
  var SPK = [[-72, -142, 1], [80, -150, 0.8], [-108, -96, 0.7], [112, -100, 0.9], [-44, -176, 0.6], [50, -178, 0.7], [-128, -150, 0.55], [128, -140, 0.6]];
  var SPK_C = [GOLD, '#fff', ACCENT, '#fde68a'];
  function drawSparkles(pet) {
    var g = R.g, a = pet.cur.sparkles, tt = pet.tt, i, s, k, q;
    if (a < 0.02) return;
    for (i = 0; i < SPK.length; i++) {
      q = SPK[i]; s = 0.5 + 0.5 * Math.sin(tt * 2.6 + i * 1.7); k = (0.25 + 0.75 * s) * q[2];
      g.globalAlpha = a * (0.35 + 0.65 * s); g.fillStyle = SPK_C[i % 4];
      star(g, CX + q[0], GROUND + q[1] - Math.sin(tt * 0.8 + i) * 3, 8 * k + 1, tt * 0.5 + i); g.fill();
    }
    g.globalAlpha = 1;
  }
  var BUB_X = [-95, -62, 64, 98, -128, 130];
  function drawBubbles(pet) {
    var g = R.g, a = pet.cur.bubbles, tt = pet.tt, i, u, x, y, r;
    if (a < 0.02) return;
    g.lineWidth = 1.5;
    for (i = 0; i < BUB_X.length; i++) {
      u = ((tt + i * 1.3) / (5 + 0.7 * i)) % 1; x = CX + BUB_X[i] + Math.sin(u * 7 + i) * 8; y = GROUND - 22 - u * 150; r = (5 + (i % 3) * 2.4) * (0.65 + 0.35 * u);
      g.globalAlpha = a * Math.pow(Math.sin(u * PI), 0.6);
      ell(g, x, y, r, r); fs(g, 'rgba(186,230,253,0.14)', 'rgba(186,230,253,0.9)', 1.5);
      g.beginPath(); g.arc(x, y, r * 0.62, PI * 1.1, PI * 1.5); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.4; g.stroke();
    }
    g.globalAlpha = 1;
  }
  var EX_POS = [[34, 62], [326, 62], [30, 118], [330, 118]];
  function drawExtras(pet) {
    var g = R.g, i, e, y, sc;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (i = 0; i < 4; i++) {
      e = pet.ex[i]; if (e.a < 0.02 || !e.s) continue;
      y = EX_POS[i][1] + Math.sin(pet.tt * 1.7 + i * 1.9) * 4; sc = 0.5 + 0.5 * e.a;
      g.globalAlpha = e.a; ell(g, EX_POS[i][0], y, 19 * sc, 19 * sc); fs(g, 'rgba(255,255,255,0.09)', 'rgba(167,139,250,0.35)', 1.2);
      g.font = Math.round(22 * sc) + 'px ' + EMOJI_FONT; g.fillStyle = '#fff'; g.fillText(e.s, EX_POS[i][0], y + 1);
    }
    g.globalAlpha = 1;
  }
  function drawThought(pet) {
    var g = R.g, a = pet.cur.thought, y;
    if (a < 0.02) return;
    y = 58 + Math.sin(pet.tt * 2) * 2.5;
    g.save(); g.translate(CX + 78, y); g.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a); g.globalAlpha = a;
    ell(g, -20, 26, 3.2, 3.2); fs(g, 'rgba(255,255,255,0.92)', 'rgba(167,139,250,0.6)', 1.2);
    ell(g, -13, 17, 4.8, 4.8); fs(g, 'rgba(255,255,255,0.92)', 'rgba(167,139,250,0.6)', 1.2);
    ell(g, 0, 0, 23, 18); fs(g, 'rgba(255,255,255,0.94)', 'rgba(167,139,250,0.7)', 1.6);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '20px ' + EMOJI_FONT; g.fillStyle = '#000'; g.fillText('🍖', 0, 1);
    g.restore();
  }
  function drawCloud(pet) {
    var g = R.g, a = pet.cur.cloud, tt = pet.tt, cy, cx = CX + pet.P.x + Math.sin(tt * 0.7) * 5, i, u, dy;
    if (a < 0.02) return;
    cy = Math.max(26, pet.P.topY - 26) + Math.sin(tt * 1.1) * 2 - (1 - a) * 12;
    g.globalAlpha = a;
    ell(g, cx - 16, cy + 3, 15, 10); fs(g, '#8b97b3', '#5d6a88', 1.6); ell(g, cx + 16, cy + 3, 15, 10); fs(g, '#8b97b3', '#5d6a88', 1.6);
    ell(g, cx, cy - 3, 18, 13); fs(g, '#8b97b3', '#5d6a88', 1.6);
    ell(g, cx, cy + 5, 26, 8.5); fs(g, '#8b97b3', null); // zakryje obrysy uprostred
    g.fillStyle = '#9fabc6'; ell(g, cx - 4, cy - 6, 9, 5); g.fill();
    g.lineWidth = 2; g.strokeStyle = '#7dd3fc';
    for (i = 0; i < 3; i++) {
      u = (tt * 0.9 + i * 0.37) % 1; dy = u * 34;
      g.globalAlpha = a * (1 - u * u);
      g.beginPath(); g.moveTo(cx - 14 + i * 14, cy + 14 + dy); g.lineTo(cx - 15.5 + i * 14, cy + 19 + dy); g.stroke();
    }
    g.globalAlpha = 1;
  }
  function drawParts(pet) {
    var g = R.g, i, q, k, a;
    for (i = 0; i < pet.parts.length; i++) {
      q = pet.parts[i]; if (!q.on) continue;
      k = q.age / q.max; a = Math.min(1, q.age * 7) * (1 - k * k);
      g.globalAlpha = clamp(a, 0, 1); g.fillStyle = q.col;
      if (q.kind === 0) { heart(g, q.x, q.y, q.size * (0.8 + 0.4 * Math.sin(q.age * 5))); g.fill(); }
      else { star(g, q.x, q.y, q.size, q.age * 4); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  function drawFeed(pet) {
    var g = R.g, f = pet.feedS, P = pet.P, u, e, x0, y0, xc, yc, x, y, sc;
    if (!f || f.t > 0.58) return;
    u = clamp(f.t / 0.52, 0, 1); e = u * u * (3 - 2 * u);
    x0 = f.x0; y0 = H + 22; xc = (x0 + P.mouthWX) / 2 + f.bend; yc = P.mouthWY + 40;
    x = (1 - e) * (1 - e) * x0 + 2 * e * (1 - e) * xc + e * e * P.mouthWX;
    y = (1 - e) * (1 - e) * y0 + 2 * e * (1 - e) * yc + e * e * P.mouthWY;
    sc = 1.15 - 0.15 * e - 0.8 * sstep(0.47, 0.58, f.t);
    g.save(); g.translate(x, y); g.rotate(Math.sin(f.t * 14) * 0.22 * (1 - e)); g.globalAlpha = 1 - sstep(0.5, 0.58, f.t);
    ell(g, 0, 0, 20 * Math.max(sc, 0.1), 20 * Math.max(sc, 0.1)); fs(g, 'rgba(251,191,36,0.2)');
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = Math.max(2, Math.round(28 * sc)) + 'px ' + EMOJI_FONT; g.fillStyle = '#fff';
    g.fillText(f.icon, 0, 1);
    g.restore();
  }

  function render(pet) {
    var g = pet.g, cv = pet.canvas;
    R.g = g; R.p = pet.pal; R.P = pet.P; R.S = pet.S; R.st = pet.stg; R.pet = pet;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(pet.k, 0, 0, pet.k, pet.ox, pet.oy);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = 1;
    drawGlow(pet); drawShadow(pet);
    drawBowl(pet); drawBooks(pet); drawDumbbell(pet);
    drawPet(pet);
    drawSparkles(pet); drawBubbles(pet); drawParts(pet); drawExtras(pet); drawThought(pet); drawCloud(pet); drawFeed(pet);
    pet.dirty = false;
  }

  // ---------- smycka, velikost, API ----------
  var pets = [], started = false, raf = 0, last = 0, reduced = false, io = null, ro = null, mq = null;

  function measure(pet) {
    var cv = pet.canvas, r = cv.getBoundingClientRect(), cw = r.width, ch = r.height, dpr, pw, phh;
    if (!(cw > 2 && ch > 2)) { cw = cv.clientWidth; ch = cv.clientHeight; }
    if (!(cw > 2 && ch > 2)) { pet.sized = false; return; }
    dpr = Math.min(global.devicePixelRatio || 1, 3);
    pw = Math.round(cw * dpr); phh = Math.round(ch * dpr);
    if (cv.width !== pw) cv.width = pw;
    if (cv.height !== phh) cv.height = phh;
    pet.k = Math.min(cw / W, ch / H) * dpr; pet.ox = (pw - W * pet.k) / 2; pet.oy = (phh - H * pet.k) / 2;
    pet.sized = true; pet.dirty = true;
  }
  function find(canvas) { var i; for (i = 0; i < pets.length; i++) if (pets[i].canvas === canvas) return pets[i]; return null; }
  function needsWork() {
    var i, p;
    for (i = 0; i < pets.length; i++) { p = pets[i]; if (p.sized && p.inView && (!reduced || p.dirty)) return true; }
    return false;
  }
  function kick() {
    if (!started || raf) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    raf = global.requestAnimationFrame(loop);
  }
  function loop(ts) {
    var dt, i, p, any = false;
    raf = 0;
    if (!started) return;
    dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
    for (i = pets.length - 1; i >= 0; i--) {
      p = pets[i];
      if (p.canvas.isConnected === false) { removePet(i); continue; }
      if (!p.sized) { measure(p); if (!p.sized) continue; }
      if (!p.inView) continue;
      if (reduced) { if (p.dirty) { step(p, 0, true); render(p); } }
      else { step(p, dt, false); render(p); any = true; }
    }
    if (any && !(typeof document !== 'undefined' && document.hidden)) raf = global.requestAnimationFrame(loop);
    else last = 0;
  }
  function removePet(i) {
    var p = pets[i];
    if (io) io.unobserve(p.canvas); if (ro) ro.unobserve(p.canvas);
    p.canvas.__pet = null; pets.splice(i, 1);
  }

  function mount(canvas, state) {
    var pet = find(canvas);
    if (pet) { update(canvas, state); return pet; }
    pet = newPet(canvas, state); canvas.__pet = pet; pets.push(pet);
    if (!canvas.__petBound) { canvas.__petBound = true; canvas.addEventListener('pointerdown', function () { poke(canvas); }); }
    measure(pet);
    if (typeof IntersectionObserver !== 'undefined') {
      if (!io) io = new IntersectionObserver(function (es) {
        var i, p; for (i = 0; i < es.length; i++) { p = es[i].target.__pet; if (p) { p.inView = es[i].isIntersecting; if (p.inView) p.dirty = true; } }
        kick();
      }, { threshold: 0 });
      pet.inView = false; io.observe(canvas);
    }
    if (typeof ResizeObserver !== 'undefined') {
      if (!ro) ro = new ResizeObserver(function (es) { var i, p; for (i = 0; i < es.length; i++) { p = es[i].target.__pet; if (p) measure(p); } kick(); });
      ro.observe(canvas);
    }
    if (pet.sized) { step(pet, 0, true); render(pet); }
    kick();
    return pet;
  }
  function update(canvas, state) {
    var pet = find(canvas); if (!pet) return mount(canvas, state);
    pet.state = normState(state);
    applyTargets(pet, reduced);
    pet.dirty = true; kick();
    return pet;
  }
  function feed(canvas, icon) {
    var pet = find(canvas); if (!pet || reduced) return;
    pet.feedS = { t: 0, icon: String(icon || '🍽️'), x0: CX + (rnd(pet) - 0.5) * 140, bend: (rnd(pet) - 0.5) * 80, burst: false };
    kick();
  }
  function poke(canvas) {
    var pet = find(canvas); if (!pet || reduced) return;
    pet.poke = 0;
    spawnHeart(pet, CX + pet.P.x + (rnd(pet) - 0.5) * 24, (pet.P.topY || 70) + 6, true);
    kick();
  }
  function start() {
    if (started) { kick(); return; }
    started = true;
    if (global.matchMedia) {
      mq = global.matchMedia('(prefers-reduced-motion: reduce)'); reduced = !!mq.matches;
      var onq = function (e) { var i; reduced = !!e.matches; for (i = 0; i < pets.length; i++) { applyTargets(pets[i], reduced); pets[i].dirty = true; } kick(); };
      if (mq.addEventListener) mq.addEventListener('change', onq); else if (mq.addListener) mq.addListener(onq);
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', function () { last = 0; kick(); });
    if (typeof window !== 'undefined' && global.addEventListener) global.addEventListener('resize', function () { var i; for (i = 0; i < pets.length; i++) measure(pets[i]); kick(); });
    var i; for (i = 0; i < pets.length; i++) { if (reduced) applyTargets(pets[i], true); pets[i].dirty = true; }
    kick();
  }
  function unmount(canvas) { var i; for (i = 0; i < pets.length; i++) if (pets[i].canvas === canvas) { removePet(i); return; } }

  global.PetAnim = {
    SPECIES: SPECIES, MOODS: MOODS, W: W, H: H,
    mount: mount, update: update, feed: feed, poke: poke, start: start, unmount: unmount,
    _step: function (canvas, dt) { var p = find(canvas); if (p) { step(p, dt, false); render(p); } } // pro testy
  };
})(typeof window !== 'undefined' ? window : globalThis);
