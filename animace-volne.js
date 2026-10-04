/* =====================================================================
   animace-volne.js – cviky s volnou váhou / vlastním tělem
   Klíče: triceps, lunge, plank, generic (goblet dřep)
   Závisí na jádru animace.js (window.FitAnim). Žádné moduly, jen FitAnim.register().
   Všechny délky končetin se berou z FitAnim.BODY, podlaha z FitAnim.FLOOR.
   Nohy a ruce se řeší pomocí FK/IK tak, aby chodidla zůstala na místě a končetiny se netahaly.
   ===================================================================== */
(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  var FA = root.FitAnim;
  if (!FA || typeof FA.register !== 'function') {
    if (typeof console !== 'undefined') console.warn('animace-volne.js: jádro FitAnim není načteno (animace.js musí být před tímto souborem).');
    return;
  }

  var D2R = Math.PI / 180;
  var C = {
    line: '#332d4d', card2: '#2a2540', muted: '#9b94b8', accent: '#a78bfa', accent2: '#7c3aed',
    metalL: '#c9c5dd', metal: '#8b86a8', metalD: '#5d5880', frame: '#4b4574', frameD: '#38335a',
    skin: '#efc0a2', dark: '#1a162b', rope: '#d9d5ec', ropeD: '#a49dc4'
  };

  /* ------------------------------ pomocné funkce ------------------------------ */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function sq(v) { return v * v; }
  function d2(a, b) { return sq(a[0] - b[0]) + sq(a[1] - b[1]); }
  function P(base, angDeg, len) { return FA.pt(base, angDeg, len); }
  function add(p, dx, dy) { return [p[0] + dx, p[1] + dy]; }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

  // 2-kloubové IK, strana kloubu se vybírá podle nápovědy (hint) – nezávisí na znaménku „bend“ v jádře
  function ik(base, target, l1, l2, hint) {
    var a = FA.ik2(base, target, l1, l2, 1), b = FA.ik2(base, target, l1, l2, -1);
    return d2(a.mid, hint) <= d2(b.mid, hint) ? a : b;
  }
  // kloub „dopředu“ vůči spojnici base-target
  function ikFwd(base, target, l1, l2, fx, fy) {
    var m = mid(base, target);
    return ik(base, target, l1, l2, [m[0] + fx, m[1] + fy]);
  }

  function ankH() {
    var b = FA.BODY;
    return b.ankleH != null ? b.ankleH : Math.max(3, b.foot * 0.28);
  }
  // špička chodidla položeného naplocho: kotník ve výšce ankH nad povrchem fy
  function flatToe(ank, fy) {
    var b = FA.BODY, h = fy - ank[1];
    return [ank[0] + Math.sqrt(Math.max(0, sq(b.foot) - sq(h))), fy];
  }

  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }

  function softShadow(c, x, y, rx, alpha) {
    var ry = Math.max(2, rx * 0.14);
    c.save(); c.translate(x, y); c.scale(rx, ry);
    var g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(0,0,0,' + alpha + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(-1, -1, 2, 2); c.restore();
  }
  function shadow(c, x, y, rx, alpha) {
    var g = FA.gear;
    if (g && typeof g.shadow === 'function') { try { g.shadow(c, x, y, rx); return; } catch (e) { /* fallback níže */ } }
    softShadow(c, x, y, rx, alpha == null ? 0.45 : alpha);
  }

  // kotouč jednoručky zboku od konce (kruh) – vzhled shodný s hip-thrust ukázkou
  function plateEndOwn(c, x, y, r) {
    c.fillStyle = 'rgba(0,0,0,0.20)'; circle(c, x + r * 0.13, y + r * 0.17, r + 1); c.fill();
    c.fillStyle = C.dark; circle(c, x, y, r); c.fill();
    c.strokeStyle = C.accent2; c.lineWidth = Math.max(1.6, r * 0.1); circle(c, x, y, r - r * 0.05); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 1; circle(c, x, y, r * 0.7); c.stroke();
    c.fillStyle = C.metal; circle(c, x, y, r * 0.24); c.fill();
    c.fillStyle = C.dark; circle(c, x, y, r * 0.09); c.fill();
  }
  function plateEnd(c, x, y, r) {
    var g = FA.gear;
    if (g && typeof g.plateEnd === 'function') { try { g.plateEnd(c, x, y, r); return; } catch (e) { /* fallback */ } }
    plateEndOwn(c, x, y, r);
  }

  // svisle držená jednoručka (hlavice nahoře a dole), střed v (x,y)
  function dumbbellVertical(c, x, y) {
    var b = FA.BODY, hl = b.headR * 1.5, pw = b.headR * 1.7, ph = b.headR * 0.62;
    // rukojeť
    c.fillStyle = C.metalD; rr(c, x - 2.3, y - hl / 2, 4.6, hl, 2); c.fill();
    c.fillStyle = C.metalL; rr(c, x - 2.3, y - hl / 2, 2.6, hl, 1.3); c.fill();
    // hlavice
    for (var i = 0; i < 2; i++) {
      var cy = i === 0 ? y - hl / 2 - ph / 2 + 1 : y + hl / 2 + ph / 2 - 1;
      c.fillStyle = C.dark; rr(c, x - pw / 2, cy - ph / 2, pw, ph, 2.2); c.fill();
      c.strokeStyle = C.accent2; c.lineWidth = 1.6; rr(c, x - pw / 2 + 0.8, cy - ph / 2 + 0.8, pw - 1.6, ph - 1.6, 1.8); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x - pw / 2 + 3, cy - ph / 2 + 1.6, pw * 0.4, 1.2);
    }
  }
  function handBlob(c, p) {
    c.fillStyle = C.skin; circle(c, p[0], p[1], Math.max(3, FA.BODY.headR * 0.36)); c.fill();
  }

  /* ===================================================================
     1) TRICEPS – stažení lana na horní kladce (boční pohled, čelem vpravo)
     =================================================================== */
  var TRI_UP = 96, TRI_A0 = -18, TRI_A1 = 92;      // sklon paže (pevný), úhel předloktí t=0 / t=1

  function triRefGeom() {                           // pozice při t=0 – pro umístění kladky
    var b = FA.BODY, fl = FA.FLOOR, ah = ankH(), L = b.thigh + b.shin;
    var ax = FA.W * 0.44, ankY = fl - ah;
    var hip = [ax - 3, ankY - Math.sqrt(sq(0.972 * L) - 9)];
    var sh = P(hip, -90 + 11, b.torso);
    var el = P(sh, TRI_UP, b.upperArm), wr = P(el, TRI_A0, b.forearm);
    var head = P(sh, -90 + 5.5, b.neck + b.headR);
    return { hip: hip, sh: sh, el: el, wr: wr, head: head };
  }
  function triPulley() {
    var r = triRefGeom(), b = FA.BODY;
    var px = r.wr[0] + 6;
    var py = Math.max(22, r.head[1] - b.headR - 14);
    return [px, py];
  }

  function triSolve(t) {
    var b = FA.BODY, fl = FA.FLOOR, ah = ankH(), L = b.thigh + b.shin;
    var ax = FA.W * 0.44;
    var ankN = [ax, fl - ah], toeN = flatToe(ankN, fl);
    var ankF = [ax - b.foot * 0.4, fl - ah], toeF = flatToe(ankF, fl);
    var hip = [ax - 3, ankN[1] - Math.sqrt(sq(0.972 * L) - 9)];
    var lean = 11 + 2 * t;                           // lehký předklon, při propnutí o trochu víc
    var sh = P(hip, -90 + lean, b.torso);
    var head = P(sh, -90 + lean * 0.5, b.neck + b.headR);

    var kN = ikFwd(hip, ankN, b.thigh, b.shin, 50, 0);
    var kF = ikFwd(hip, ankF, b.thigh, b.shin, 50, 0);

    var elN = P(sh, TRI_UP, b.upperArm);             // loket přišpendlený k boku
    var wrN = P(elN, lerp(TRI_A0, TRI_A1, t), b.forearm);
    var aF = ik(sh, [wrN[0] - 3, wrN[1] - 1], b.upperArm, b.forearm, [elN[0] - 8, elN[1] + 3]);

    return {
      hip: hip, shoulder: sh, head: head,
      elbowN: elN, wristN: wrN, kneeN: kN.mid, ankleN: ankN, toeN: toeN,
      elbowF: aF.mid, wristF: aF.end, kneeF: kF.mid, ankleF: ankF, toeF: toeF
    };
  }

  function triBack(c, J, t, time) {
    var b = FA.BODY, fl = FA.FLOOR, pl = triPulley(), px = pl[0], py = pl[1];
    shadow(c, J.ankleN[0] + b.foot * 0.3, fl + 0.5, b.foot * 1.9, 0.5);
    shadow(c, J.ankleF[0] + b.foot * 0.3, fl + 0.5, b.foot * 1.7, 0.3);

    var xc = px + 12, cw = 26, top = py - 16;
    // sloup stroje
    c.fillStyle = C.frameD; rr(c, xc + 1.5, top + 1.5, cw, fl - top, 4); c.fill();
    c.fillStyle = C.frame; rr(c, xc, top, cw, fl - top, 4); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(xc + 2, top + 4, 2.4, fl - top - 8);
    // horní rameno s kladkou
    c.fillStyle = C.frameD; rr(c, px - 6, top, xc + cw - px + 6, 11, 4); c.fill();
    c.fillStyle = C.frame; rr(c, px - 6, top, xc + cw - px + 5, 9.5, 4); c.fill();
    // okno se závažím
    var wx = xc + 4, ww = cw - 8, wy = py + 16, wh = fl - wy - 6;
    if (wh > 20) {
      c.fillStyle = C.dark; rr(c, wx, wy, ww, wh, 3); c.fill();
      var n = Math.max(3, Math.min(9, Math.floor((wh - 6) / 8))), lift = t * Math.min(11, 8 + 1);
      for (var i = 0; i < n; i++) {
        var y = fl - 6 - 2 - (i + 1) * 8 + 1;
        if (i >= 2) y -= lift;
        c.fillStyle = (i === 2) ? C.accent2 : C.metalD; rr(c, wx + 2, y, ww - 4, 6, 1.6); c.fill();
        c.fillStyle = (i === 2) ? C.accent : C.metal; rr(c, wx + 2, y, ww - 4, 2.4, 1.2); c.fill();
      }
    }
    // kabel (od kladky k lanu)
    var A = [J.wristN[0] + 1, J.wristN[1] - 6];
    c.lineCap = 'round';
    c.strokeStyle = C.line; c.lineWidth = 4; c.beginPath(); c.moveTo(px, py); c.lineTo(A[0], A[1]); c.stroke();
    c.strokeStyle = C.metalL; c.lineWidth = 2; c.beginPath(); c.moveTo(px, py); c.lineTo(A[0], A[1]); c.stroke();
    // kladka
    c.fillStyle = C.line; circle(c, px, py, 9); c.fill();
    c.fillStyle = C.metalD; circle(c, px, py, 7.4); c.fill();
    c.strokeStyle = C.metalL; c.lineWidth = 1.4; circle(c, px, py, 5.2); c.stroke();
    c.fillStyle = C.accent; circle(c, px, py, 2); c.fill();
  }

  function triFront(c, J, t, time) {
    var w = J.wristN, s = lerp(1.5, 8, t);
    var A = [w[0] + 1, w[1] - 6];
    c.lineCap = 'round'; c.lineJoin = 'round';
    // očko, kde se kabel napojuje na lano
    c.strokeStyle = C.metalD; c.lineWidth = 2.2; circle(c, A[0], A[1] + 1, 2.6); c.stroke();
    // volné konce lana (rozevírají se při propnutí)
    var e1 = [w[0] - s, w[1] + FA.BODY.hand * 0.6 + 13], e2 = [w[0] + s, w[1] + FA.BODY.hand * 0.6 + 12];
    var from = [w[0], w[1] + 2];
    var ends = [[e1, C.ropeD], [e2, C.rope]];
    for (var i = 0; i < 2; i++) {
      c.strokeStyle = C.line; c.lineWidth = 5; c.beginPath(); c.moveTo(from[0], from[1]); c.lineTo(ends[i][0][0], ends[i][0][1]); c.stroke();
      c.strokeStyle = ends[i][1]; c.lineWidth = 3.2; c.beginPath(); c.moveTo(from[0], from[1]); c.lineTo(ends[i][0][0], ends[i][0][1]); c.stroke();
      c.fillStyle = C.line; circle(c, ends[i][0][0], ends[i][0][1], 3.3); c.fill();
      c.fillStyle = ends[i][1]; circle(c, ends[i][0][0], ends[i][0][1], 2.2); c.fill();
    }
  }

  FA.register('triceps', {
    title: 'Tricepsový stah na kladce (lano)', view: 'side', facing: 1,
    tempo: { up: 0.9, hold: 0.5, down: 1.8, pause: 0.3 },
    phases: { up: 'Propni ruce ⬇', hold: 'Zatni triceps', down: 'Pomalu nahoru ⬆', pause: '' },
    solve: triSolve, back: triBack, front: triFront,
    highlight: function (t) { return { triceps: clamp(0.18 + 0.82 * Math.pow(t, 1.2), 0, 1), shoulders: 0.12, core: 0.1 }; }
  });

  /* ===================================================================
     2) LUNGE – výpad s jednoručkami na místě (split squat)
     =================================================================== */
  function lungeGeom() {
    var b = FA.BODY, fl = FA.FLOOR, ah = ankH(), L = b.thigh + b.shin;
    var s8 = Math.sin(8 * D2R), c8 = Math.cos(8 * D2R);
    // lokální souřadnice: kyčel má x = 0
    var ankF = [b.thigh - b.shin * s8, fl - ah];            // přední kotník (koleno dole nad kotníkem)
    var kneeBot = [ankF[0] + b.shin * s8, ankF[1] - b.shin * c8];
    var hipBotY = kneeBot[1];                               // stehno rovnoběžně s podlahou
    var clear = Math.max(6, b.thigh * 0.15);
    var drop = Math.min(fl - clear - hipBotY, b.thigh * 0.96);
    var kneeB = [-Math.sqrt(sq(b.thigh) - sq(drop)), hipBotY + drop];   // zadní koleno těsně nad zemí
    var rise = 58 * D2R;                                    // zadní chodidlo na špičce
    var ankBy = fl - b.foot * Math.sin(rise);
    var dy = ankBy - kneeB[1];
    var ankB = [kneeB[0] - Math.sqrt(Math.max(0, sq(b.shin) - sq(dy))), ankBy];
    var toeB = [ankB[0] + b.foot * Math.cos(rise), fl];
    var toeF = flatToe(ankF, fl);
    // výška kyčle nahoře (obě nohy téměř propnuté)
    var R = 0.985 * L;
    var yB = ankB[1] - Math.sqrt(Math.max(0, sq(R) - sq(ankB[0])));
    var yF = ankF[1] - Math.sqrt(Math.max(0, sq(R) - sq(ankF[0])));
    var hipTop = Math.max(yB, yF);
    // vystředění na plátno
    var minX = ankB[0] - b.foot * 0.45, maxX = Math.max(toeF[0], ankF[0]) + b.headR * 1.6;
    var shift = FA.W / 2 - (minX + maxX) / 2;
    return { ankF: ankF, toeF: toeF, ankB: ankB, toeB: toeB, hipTop: hipTop, hipBot: hipBotY, shift: shift };
  }
  function sh2(p, s) { return [p[0] + s, p[1]]; }

  function lungeSolve(t) {
    var b = FA.BODY, g = lungeGeom(), s = g.shift;
    var hip = [s, lerp(g.hipTop, g.hipBot, t)];
    var ankF = sh2(g.ankF, s), toeF = sh2(g.toeF, s), ankB = sh2(g.ankB, s), toeB = sh2(g.toeB, s);
    var kF = ikFwd(hip, ankF, b.thigh, b.shin, 50, 0);
    var kB = ikFwd(hip, ankB, b.thigh, b.shin, 40, 40);
    var sh = P(hip, -90 + 4, b.torso);
    var head = P(sh, -90 + 3, b.neck + b.headR);
    // ruce svisí podél těla s jednoručkami
    var reach = 0.97 * (b.upperArm + b.forearm);
    var wN = [sh[0] + 1, sh[1] + reach], wF = [sh[0] - 3, sh[1] + reach];
    var aN = ik(sh, wN, b.upperArm, b.forearm, [sh[0] - 30, sh[1] + reach * 0.5]);
    var aF = ik(sh, wF, b.upperArm, b.forearm, [sh[0] - 30, sh[1] + reach * 0.5]);
    return {
      hip: hip, shoulder: sh, head: head,
      elbowN: aN.mid, wristN: aN.end, kneeN: kF.mid, ankleN: ankF, toeN: toeF,
      elbowF: aF.mid, wristF: aF.end, kneeF: kB.mid, ankleF: ankB, toeF: toeB
    };
  }
  function dbCenter(w) { return [w[0], w[1] + (FA.BODY.hand || 6) * 0.6 + FA.BODY.headR * 0.5]; }

  function lungeBack(c, J, t) {
    var b = FA.BODY, fl = FA.FLOOR;
    shadow(c, J.ankleN[0] + b.foot * 0.35, fl + 0.5, b.foot * 1.9, 0.5);
    shadow(c, J.toeF[0] - b.foot * 0.3, fl + 0.5, b.foot * 1.6, 0.3);
    shadow(c, J.hip[0] - b.foot * 0.2, fl + 0.5, b.thigh * 1.2, 0.18 + 0.12 * (1 - t));
    // vzdálenější jednoručka (za tělem)
    var d = dbCenter(J.wristF);
    c.globalAlpha = 0.8; plateEnd(c, d[0], d[1], b.headR * 0.8); c.globalAlpha = 1;
  }
  function lungeFront(c, J, t) {
    var b = FA.BODY, d = dbCenter(J.wristN);
    plateEnd(c, d[0], d[1], b.headR * 0.8);
    handBlob(c, J.wristN);
  }

  FA.register('lunge', {
    title: 'Výpad s jednoručkami', view: 'side', facing: 1,
    tempo: { up: 2.0, hold: 0.6, down: 1.0, pause: 0.4 },
    phases: { up: 'Pomalu dolů ⬇', hold: 'Dole výdrž', down: 'Odraz nahoru ⬆', pause: '' },
    solve: lungeSolve, back: lungeBack, front: lungeFront,
    highlight: function (t) {
      return { quads: clamp(0.2 + 0.8 * t, 0, 1), glutes: clamp(0.12 + 0.88 * Math.pow(t, 1.3), 0, 1), hamstrings: 0.15 * t };
    }
  });

  /* ===================================================================
     3) PLANK – výdrž na předloktích (bez opakování, jen dýchání)
     =================================================================== */
  var PL_SLACK = 0.06;                                      // drobná vůle, aby šlo tělem jemně „dýchat“

  function plankGeom() {
    var b = FA.BODY, fl = FA.FLOOR, matH = 5, sf = fl - matH;
    var r = clamp(b.forearm * 0.14, 3, 6.5);
    var raise = 62 * D2R;
    var S = b.torso + b.thigh + b.shin;
    var toe = [0, sf];
    var ank = [toe[0] - b.foot * Math.cos(raise), sf - b.foot * Math.sin(raise)];
    var eY = sf - r;
    var shY = eY - b.upperArm;
    var D = S - PL_SLACK;
    var shX = ank[0] + Math.sqrt(sq(D) - sq(ank[1] - shY));
    var sh = [shX, shY];
    var el = [shX, eY], wr = [shX + b.forearm, eY];
    var u = [(sh[0] - ank[0]) / D, (sh[1] - ank[1]) / D];     // jednotkový směr kotník -> rameno
    var headC = P(sh, FA.ang(ank, sh) + 12, b.neck + b.headR);
    var minX = ank[0] - b.foot * 0.35, maxX = Math.max(wr[0] + (b.hand || 6) + 4, headC[0] + b.headR);
    var shift = FA.W / 2 - (minX + maxX) / 2;
    return { b: b, fl: fl, sf: sf, ank: ank, toe: toe, sh: sh, el: el, wr: wr, u: u, D: D, shift: shift, minX: minX, maxX: maxX, r: r };
  }

  function plankSolve(t, time) {
    var g = plankGeom(), b = g.b, s = g.shift;
    time = time || 0;
    var ank = [g.ank[0] + s, g.ank[1]], toe = [g.toe[0] + s, g.toe[1]];
    var sh = [g.sh[0] + s, g.sh[1]], el = [g.el[0] + s, g.el[1]], wr = [g.wr[0] + s, g.wr[1]];
    // dýchání: trup se mikro-pootáčí kolem ramene (kyčel o <1 px nahoru/dolů)
    var psi = (0.7 * (2 * t - 1) + 0.1 * Math.sin(time * 1.3)) * D2R;
    var vx = -g.u[0], vy = -g.u[1];                           // rameno -> kyčel (rovně)
    var c = Math.cos(psi), sn = Math.sin(psi);
    var hip = [sh[0] + (vx * c - vy * sn) * b.torso, sh[1] + (vx * sn + vy * c) * b.torso];
    var knee = ikFwd(hip, ank, b.thigh, b.shin, 0, -60).mid;
    var bodyAng = FA.ang(hip, sh);
    var head = P(sh, bodyAng + 12 + 0.8 * (2 * t - 1), b.neck + b.headR);
    return {
      hip: hip, shoulder: sh, head: head,
      elbowN: el, wristN: wr, kneeN: knee, ankleN: ank, toeN: toe,
      elbowF: el.slice(), wristF: wr.slice(), kneeF: knee.slice(), ankleF: ank.slice(), toeF: toe.slice()
    };
  }

  function plankBack(c, J, t, time) {
    var g = plankGeom(), s = g.shift, fl = g.fl;
    var x1 = g.minX + s - 18, x2 = g.maxX + s + 16, h = 5;
    shadow(c, (x1 + x2) / 2, fl + 0.5, (x2 - x1) * 0.55, 0.35);
    // podložka
    c.fillStyle = C.frameD; rr(c, x1, fl - h, x2 - x1, h + 0.5, 2.4); c.fill();
    c.fillStyle = '#3f3a6c'; rr(c, x1, fl - h, x2 - x1, h - 1.2, 2.4); c.fill();
    c.fillStyle = C.accent2; c.fillRect(x1 + 5, fl - h + 0.6, x2 - x1 - 10, 1.2);
  }

  FA.register('plank', {
    title: 'Plank na předloktích', view: 'side', facing: 1,
    tempo: { up: 2, hold: 0, down: 2, pause: 0 },
    phases: { up: 'Drž! Zpevni střed', hold: 'Drž! Zpevni střed', down: 'Dýchej klidně', pause: 'Drž! Zpevni střed' },
    solve: plankSolve, back: plankBack,
    front: function () { },
    highlight: function (t, time) {
      var pulse = (time == null) ? t : 0.5 + 0.5 * Math.sin(time * 2.2);
      return { core: clamp(0.55 + 0.35 * pulse, 0, 1), glutes: 0.28, shoulders: 0.26, quads: 0.2, chest: 0.12 };
    }
  });

  /* ===================================================================
     4) GENERIC – goblet dřep (náhradní animace pro libovolný vlastní cvik)
     =================================================================== */
  function genSolve(t) {
    var b = FA.BODY, fl = FA.FLOOR, ah = ankH(), ax = FA.W * 0.46;
    var ankN = [ax, fl - ah], toeN = flatToe(ankN, fl);
    var ankF = [ax - b.foot * 0.3, fl - ah], toeF = flatToe(ankF, fl);
    var phi = lerp(4, 30, t);                                   // náklon bérce
    var kN = P(ankN, -90 + phi, b.shin);
    var hip = P(kN, lerp(-96, -186, t), b.thigh);               // stehno se sklápí až pod vodorovnu
    var kF = ikFwd(hip, ankF, b.thigh, b.shin, 40, 0);
    var lean = lerp(3, 30, t);
    var sh = P(hip, -90 + lean, b.torso);
    var head = P(sh, -90 + lean * 0.35, b.neck + b.headR);       // hrudník nahoře, pohled vpřed
    // ruce drží jednoručku svisle u hrudi
    var lr = lean * D2R;
    var up = [Math.sin(lr), -Math.cos(lr)], fw = [Math.cos(lr), Math.sin(lr)];
    var tN = [sh[0] - up[0] * b.torso * 0.2 + fw[0] * b.upperArm * 0.6, sh[1] - up[1] * b.torso * 0.2 + fw[1] * b.upperArm * 0.6];
    var tF = [tN[0] - 1.5, tN[1] + 0.5];
    var aN = ik(sh, tN, b.upperArm, b.forearm, [tN[0], tN[1] + 50]);
    var aF = ik(sh, tF, b.upperArm, b.forearm, [tF[0], tF[1] + 50]);
    return {
      hip: hip, shoulder: sh, head: head,
      elbowN: aN.mid, wristN: aN.end, kneeN: kN, ankleN: ankN, toeN: toeN,
      elbowF: aF.mid, wristF: aF.end, kneeF: kF.mid, ankleF: ankF, toeF: toeF
    };
  }
  function genBack(c, J, t) {
    var b = FA.BODY, fl = FA.FLOOR;
    shadow(c, J.ankleN[0] + b.foot * 0.3, fl + 0.5, b.foot * 1.9, 0.5);
    shadow(c, J.ankleF[0] + b.foot * 0.3, fl + 0.5, b.foot * 1.7, 0.3);
    shadow(c, J.hip[0], fl + 0.5, b.thigh * 0.9, 0.12 + 0.08 * (1 - t));
  }
  function genFront(c, J, t) {
    var w = J.wristN, b = FA.BODY;
    dumbbellVertical(c, w[0] + 2, w[1] - b.headR * 0.5);
    handBlob(c, w);
  }

  FA.register('generic', {
    title: 'Goblet dřep s jednoručkou', view: 'side', facing: 1,
    tempo: { up: 1.8, hold: 0.5, down: 1.2, pause: 0.3 },
    phases: { up: 'Dřep dolů ⬇', hold: 'Dole výdrž', down: 'Vstaň ⬆', pause: '' },
    solve: genSolve, back: genBack, front: genFront,
    highlight: function (t) {
      return { quads: clamp(0.2 + 0.8 * t, 0, 1), glutes: clamp(0.12 + 0.88 * Math.pow(t, 1.3), 0, 1), core: 0.2, hamstrings: 0.12 * t };
    }
  });
})();
