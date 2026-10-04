/* animace-nohy.js - cviky na nohy pro FitAnim (jen FitAnim.register, bez modulu).
   Klice: legpress (leg press 45 st.), legcurl (leze), legext (predkopavani), abduction (odtahovani, predni pohled),
          calf (vypony na schodu).
   Pouziva jen verejne API: FitAnim.BODY, FLOOR, COL, ik2, register, gear.shadow/pad/stack; rozmery vsech koncetin se berou z BODY,
   chodidla / ruce jsou pevne na podlaze / schodu / sanich / madlech (IK), koncetiny se nikdy neprotahuji. */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  var F = G.FitAnim;
  if (!F || typeof F.register !== 'function') { if (typeof console !== 'undefined') console.warn('animace-nohy.js: FitAnim nenalezen'); return; }

  var B = F.BODY, FLOOR = F.FLOOR, W = F.W, C = F.COL, RAD = Math.PI / 180;
  var L = B.thigh + B.shin, K = L / 100;                    // K = meritko vybaveni (1 pri thigh+shin = 100)
  var AH = B.ankleH, FD = Math.sqrt(B.foot * B.foot - AH * AH);   // vyska kotniku, vodorovny dosah kotnik->spicka u ploche nohy

  /* ============================== pomocne funkce ============================== */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sq(x) { return x * x; }
  function dir(a) { a *= RAD; return [Math.cos(a), Math.sin(a)]; }
  function mad(p, d, s) { return [p[0] + d[0] * s, p[1] + d[1] * s]; }              // p + d*s
  function unit(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }
  /* spicka chodidla, kdyz sole lezi na plose se smerem spicky u a normalou n (ven z plochy k telu); |kotnik->spicka| = BODY.foot */
  function toeOn(A, u, n) { return [A[0] + u[0] * FD - n[0] * AH, A[1] + u[1] * FD - n[1] * AH]; }
  /* IK, u ktere si stranu kloubu volime sami: stred lezi na strane, kam miri hint (nezavisle na konvenci znamenka bend) */
  function ikSide(P, T, l1, l2, hint) {
    var a = F.ik2(P, T, l1, l2, 1), b = F.ik2(P, T, l1, l2, -1), mx = (P[0] + T[0]) / 2, my = (P[1] + T[1]) / 2;
    var da = (a.mid[0] - mx) * hint[0] + (a.mid[1] - my) * hint[1], db = (b.mid[0] - mx) * hint[0] + (b.mid[1] - my) * hint[1];
    return da >= db ? a : b;
  }

  /* ---- kresleni (styl jadra: tvarove stinovani, zaoblene tvary, barvy z FitAnim.COL) ---- */
  function capP(ctx, p0, p1, r0, r1, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    var x0 = p0[0] + ox, y0 = p0[1] + oy, x1 = p1[0] + ox, y1 = p1[1] + oy;
    var dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1e-6, a = Math.atan2(dy, dx), k = Math.acos(clamp((r0 - r1) / d, -1, 1));
    ctx.moveTo(x0 + r0 * Math.cos(a + k), y0 + r0 * Math.sin(a + k));
    ctx.arc(x0, y0, r0, a + k, a - k + Math.PI * 2);
    ctx.arc(x1, y1, r1, a - k, a + k);
    ctx.closePath();
  }
  function rrP(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function circP(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
  function shaded(ctx, fn, base, shade) {                      // tmavy podklad + svetla vypln posunuta ke svetlu
    ctx.save();
    ctx.beginPath(); fn(0, 0); ctx.clip();
    ctx.beginPath(); fn(0, 0); ctx.fillStyle = shade; ctx.fill();
    ctx.beginPath(); fn(1, -1.25); ctx.clip();
    ctx.beginPath(); fn(0, 0); ctx.fillStyle = base; ctx.fill();
    ctx.restore();
  }
  function bar(ctx, a, b, w, base, shade) {
    shaded(ctx, function (ox, oy) { capP(ctx, a, b, w / 2, w / 2, ox, oy); }, base || C.frame, shade || C.frameD);
  }
  function shRR(ctx, x, y, w, h, r, base, shade) {
    shaded(ctx, function (ox, oy) { rrP(ctx, x + ox, y + oy, w, h, r); }, base, shade);
  }
  function padRR(ctx, x, y, w, h, r) {                         // potah (lavice, opěrka) s horním odleskem
    shRR(ctx, x, y, w, h, r, C.pad, C.padD);
    ctx.fillStyle = C.padTop; ctx.fillRect(x + r * 0.6, y + 0.7, Math.max(0, w - r * 1.2), 1.2);
  }
  function padBar(ctx, a, b, w) {                              // sikmy potah (kapsle) s odleskem na svetle strane
    bar(ctx, a, b, w, C.pad, C.padD);
    var d = unit(a, b), n = [d[1], -d[0]];
    if (n[0] * 0.5 - n[1] * 1 < 0) n = [-n[0], -n[1]];         // svetlo zprava shora
    var o = w / 2 - 2.2, l = Math.hypot(b[0] - a[0], b[1] - a[1]), tr = Math.min(w * 0.4, l / 3);
    ctx.save(); ctx.strokeStyle = C.padTop; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0] + n[0] * o + d[0] * tr, a[1] + n[1] * o + d[1] * tr);
    ctx.lineTo(b[0] + n[0] * o - d[0] * tr, b[1] + n[1] * o - d[1] * tr); ctx.stroke(); ctx.restore();
  }
  function hub(ctx, p, r) {                                    // osa / kloub stroje
    ctx.fillStyle = C.rubber; ctx.beginPath(); circP(ctx, p[0], p[1], r); ctx.fill();
    ctx.fillStyle = C.metal; ctx.beginPath(); circP(ctx, p[0], p[1], r * 0.62); ctx.fill();
    ctx.fillStyle = C.rubber; ctx.beginPath(); circP(ctx, p[0], p[1], r * 0.22); ctx.fill();
  }
  function roller(ctx, p, r) { F.gear.pad(ctx, p[0], p[1], r); }
  function shadow(ctx, x, rx, a) { F.gear.shadow(ctx, x, FLOOR + 0.5, rx, a, 3.2); }

  /* automaticke vycentrovani sceny (kolem x = 200) a zoom, aby se vse vešlo; vraci zoom */
  function autoFit(g, solveRaw, eqBox, top) {
    function box() {
      var b = [1e9, -1e9, 1e9, -1e9], i, k, J, v, e, ts = [0, 0.25, 0.5, 0.75, 1];
      for (i = 0; i < ts.length; i++) {
        J = solveRaw(ts[i]);
        for (k in J) { v = J[k]; if (v && v.length === 2 && isFinite(v[0])) { b[0] = Math.min(b[0], v[0] - 13); b[1] = Math.max(b[1], v[0] + 13); b[2] = Math.min(b[2], v[1] - 13); b[3] = Math.max(b[3], v[1] + 13); } }
      }
      e = eqBox(); b[0] = Math.min(b[0], e[0]); b[1] = Math.max(b[1], e[1]); b[2] = Math.min(b[2], e[2]);
      return b;
    }
    var b = box(); g.x0 += 200 - (b[0] + b[1]) / 2; b = box();
    g.box = b;
    return clamp(Math.min((W - 28) / (b[1] - b[0]), (FLOOR - (top || 12)) / (FLOOR - b[2])), 0.8, 1.7);
  }

  /* =============================================================================
     1) LEG PRESS 45 st. (bocni pohled, doprava)
        Zada lezi na sikme opěrce (smer 225 st.), sane jezdi po koleji ve smeru 315 st. (nahoru doprava).
     ============================================================================= */
  (function () {
    var g = { x0: 200 };
    var r = dir(315), u = dir(225), dn = dir(45), nIn = [-r[0], -r[1]];
    var o = 0.12 * L;                                           // odsazeni dráhy kotníku od osy kyčle
    var s0 = Math.sqrt(sq(0.56 * L) - sq(o)), s1 = Math.sqrt(sq(0.98 * L) - sq(o));   // vzdálenost kotníku od kyčle: 0.56 L -> 0.98 L (neuzamčené)
    var thick = 7 * K, pHalf = 24 * K, pMid = 7 * K, pBot = pHalf - pMid, railOff = pBot + 8 * K;
    var hy = FLOOR - 40 * K, backOff = 16.5 * K, bt = 11 * K;
    var sa = (o + railOff - AH) - 37 * K / Math.SQRT1_2, sb = s1 + 18 * K;
    sa = Math.min(sa, s0 - 14 * K);
    function H() { return [g.x0, hy]; }
    function A(Hh, s) { return [Hh[0] + r[0] * s + dn[0] * o, Hh[1] + r[1] * s + dn[1] * o]; }     // kotnik na dráze
    function PP(Hh, s) { return mad(A(Hh, s), r, AH); }                                           // povrch desky pod chodidlem
    function RAIL(Hh, s) { return mad(PP(Hh, s), dn, railOff); }                                   // osa kolejnice
    function WT(Hh, s) { return mad(mad(PP(Hh, s), u, pMid), r, thick + 10 * K); }                // stred zavazi

    function solve(t) {
      t = clamp(t, 0, 1);
      var Hh = H(), s = lerp(s0, s1, t), a = A(Hh, s), af = mad(a, u, 5 * K), S = mad(Hh, u, B.torso);
      var kn = ikSide(Hh, a, B.thigh, B.shin, u), kf = ikSide(Hh, af, B.thigh, B.shin, u);
      var HP = mad(mad(Hh, u, 0.35 * B.torso), r, 5 * K), HPF = [HP[0] + 3, HP[1] + 1];
      var an = ikSide(S, HP, B.upperArm, B.forearm, [-0.55, 0.85]), afr = ikSide(S, HPF, B.upperArm, B.forearm, [-0.55, 0.85]);
      return { hip: Hh, shoulder: S, head: mad(S, dir(240), B.neck + B.headR), headRot: -6,
               elbowN: an.mid, wristN: an.end, kneeN: kn.mid, ankleN: kn.end, toeN: toeOn(kn.end, u, nIn),
               elbowF: afr.mid, wristF: afr.end, kneeF: kf.mid, ankleF: kf.end, toeF: toeOn(kf.end, u, nIn) };
    }
    function eqBox() {
      var Hh = [g.x0, hy], re = RAIL(Hh, sb), w1 = WT(Hh, s1), E = mad(mad(Hh, r, -backOff), u, B.torso + 20 * K), p1 = PP(Hh, s1);
      return [Math.min(E[0] - 9 * K, Hh[0] - 40 * K), Math.max(re[0] + 4, w1[0] + 16 * K), Math.min(w1[1] - 17 * K, re[1] - 4, mad(p1, u, pMid + pHalf)[1] - 4)];
    }

    function back(ctx, J, t) {
      var Hh = J.hip, s = lerp(s0, s1, clamp(t, 0, 1)), k = K, gy = FLOOR - 3.5 * k;
      var rs = RAIL(Hh, sa), re = RAIL(Hh, sb), rm = RAIL(Hh, (sa + sb) / 2), Pp = PP(Hh, s);
      shadow(ctx, (Hh[0] - 40 * k + re[0]) / 2, (re[0] - Hh[0] + 50 * k) / 2 + 6, 0.4);
      // zakladna a podpery kolejnice
      bar(ctx, [Hh[0] - 40 * k, gy], [re[0], gy], 6 * k);
      bar(ctx, re, [re[0], gy], 6 * k);
      bar(ctx, rm, [rm[0], gy], 5 * k);
      // opera opěrky zad a sedák
      var bc = mad(Hh, r, -backOff), b0 = mad(bc, dn, 6 * k), b1 = mad(bc, u, B.torso + 20 * k);
      bar(ctx, mad(bc, u, 0.45 * B.torso), [Hh[0] - 40 * k, gy], 5 * k);
      bar(ctx, [Hh[0] - 30 * k, Hh[1] + 22 * k], [Hh[0] - 30 * k, gy], 6 * k);
      bar(ctx, [Hh[0] + 7 * k, Hh[1] + 22 * k], [Hh[0] + 7 * k, gy], 6 * k);
      // kolejnice
      bar(ctx, rs, re, 5 * k, C.metal, '#6f6890');
      // sane: vozik na kolejnici, deska, zavazi
      ctx.save(); ctx.translate(Pp[0], Pp[1]); ctx.rotate(-Math.PI / 4);
      shRR(ctx, -20 * k, pBot - 3 * k, 20 * k + thick + 3 * k, railOff - pBot + 8 * k, 3 * k, C.frame, C.frameD);
      ctx.fillStyle = C.rubber; ctx.beginPath(); circP(ctx, -12 * k, railOff, 3.6 * k); circP(ctx, 5 * k, railOff, 3.6 * k); ctx.fill();
      ctx.fillStyle = C.metal; ctx.beginPath(); circP(ctx, -12 * k, railOff, 1.8 * k); circP(ctx, 5 * k, railOff, 1.8 * k); ctx.fill();
      shRR(ctx, 2 * k, -pMid - pHalf, thick, 2 * pHalf, 3 * k, C.metal, '#6f6890');
      shRR(ctx, -0.5, -pMid - pHalf + 2 * k, 3.4 * k, 2 * pHalf - 4 * k, 1.6 * k, C.pad, C.padD);
      ctx.restore();
      var w = WT(Hh, s);
      F.gear.plateEnd(ctx, w[0] + 2.4 * k, w[1] - 2.4 * k, 14 * k);
      F.gear.plateEnd(ctx, w[0], w[1], 15 * k);
      // opěrka zad (se zadním rámem) a hlavová opěrka, sedák
      bar(ctx, mad(b0, r, -8 * k), mad(b1, r, -8 * k), 5 * k);
      padBar(ctx, b0, b1, bt);
      padRR(ctx, Hh[0] - 34 * k, Hh[1] + 12 * k, 48 * k, 10 * k, 4 * k);
      // madlo, ktere ruka drzi
      var wr = J.wristN, g0 = mad(wr, unit(J.elbowN, wr), B.hand * 0.4);
      bar(ctx, [Hh[0] - 5 * k, Hh[1] + 15 * k], g0, 4.6 * k);
      ctx.fillStyle = C.rubber; ctx.beginPath(); circP(ctx, g0[0], g0[1], 3.8 * k); ctx.fill();
      ctx.fillStyle = C.metal; ctx.beginPath(); circP(ctx, g0[0], g0[1], 2.1 * k); ctx.fill();
    }

    var zoom = autoFit(g, solve, eqBox, 14);
    F.register('legpress', {
      title: 'Leg press', view: 'side', facing: 1, zoom: zoom,
      tempo: { up: 1.1, hold: 0.4, down: 1.8, pause: 0.4 },
      phases: { up: 'Vytlač nohama ⬆', hold: 'Kolena nezamykej', down: 'Pomalu zpět ⬇', pause: '' },
      solve: solve, back: back, front: function () {},
      highlight: function (t) { return { quads: 0.25 + 0.75 * t, glutes: 0.1 + 0.4 * t, hamstrings: 0.05 + 0.1 * t }; },
      _geo: { g: g, s0: s0, s1: s1, r: r, u: u, dn: dn, o: o, PP: PP, A: A, H: H, RAIL: RAIL, sa: sa, sb: sb }
    });
  })();

  /* =============================================================================
     2) LEG CURL leze (bocni pohled, hlava vlevo, facing = -1 => oblicej hledi dopředu = doleva)
        Roller za kotníky na páce, která se otáčí kolem osy kolene (hub).
     ============================================================================= */
  (function () {
    var g = { x0: 200 };
    var k = K, pad = 6.5 * k, dy = 1.5 * k;
    var hipY = FLOOR - 50 * k - 12, shY = hipY - dy, benchTop = hipY + 12;
    var curlMax = 110, rPad = 0.9;                              // maximalni flexe kolene, poloha rolleru na holeni
    function lever(J, t) {                                      // geometrie paky z J (otáčí se kolem kolene)
      var kn = J.kneeN, a = F.ang(kn, J.ankleN), nb = dir(a - 90), legR = lerp(6.9, 4.1, rPad);
      var P1 = mad(kn, nb, legR + pad - 0.5 + 3.5 * k), PC = mad(mad(kn, dir(a), rPad * B.shin), nb, legR + pad - 0.5);
      return { a: a, nb: nb, P1: P1, PC: PC };
    }
    function solve(t) {
      t = clamp(t, 0, 1);
      var S = [g.x0, shY], hip = [g.x0 + Math.sqrt(sq(B.torso) - sq(dy)), hipY];
      var kn = [hip[0] + B.thigh, hipY], a = -curlMax * t, an = F.pt(kn, a, B.shin), tn = F.pt(an, a + 70, B.foot);
      var tA = -3, kf = F.pt(hip, tA, B.thigh), aF = tA + a * 0.95, af = F.pt(kf, aF, B.shin), tf = F.pt(af, aF + 70, B.foot);
      var arm = B.upperArm + B.forearm, HP = [S[0] - 0.7 * arm, shY + 4], HPF = [HP[0] + 3, HP[1] + 0.5];
      var an1 = ikSide(S, HP, B.upperArm, B.forearm, [0, 1]), an2 = ikSide(S, HPF, B.upperArm, B.forearm, [0, 1]);
      return { hip: hip, shoulder: S, head: F.pt(S, 200, B.neck + B.headR),
               elbowN: an1.mid, wristN: an1.end, kneeN: kn, ankleN: an, toeN: tn,
               elbowF: an2.mid, wristF: an2.end, kneeF: kf, ankleF: af, toeF: tf };
    }
    function eqBox() {
      var S = [g.x0, shY], arm = B.upperArm + B.forearm, kx = g.x0 + Math.sqrt(sq(B.torso) - sq(dy)) + B.thigh;
      return [S[0] - 0.7 * arm - 9 * k, kx + B.shin + pad * 2 + 6 * k, hipY - 100];
    }
    function back(ctx, J, t) {
      var S = J.shoulder, hip = J.hip, kn = J.kneeN, gy = FLOOR - 3.5 * k, lv = lever(J, t);
      shadow(ctx, (S[0] + kn[0]) / 2, (kn[0] - S[0]) / 2 + 24, 0.4);
      // rám lavice: podpěry, základna, stojan pod osou páky
      bar(ctx, [S[0] - 20 * k, gy], [kn[0] + 4 * k, gy], 6 * k);
      bar(ctx, [S[0] + 6 * k, benchTop + 8 * k], [S[0] + 6 * k, gy], 6 * k);
      bar(ctx, [hip[0] + 4 * k, benchTop + 8 * k], [hip[0] + 4 * k, gy], 6 * k);
      bar(ctx, [kn[0], kn[1]], [kn[0], gy], 6.5 * k);
      // madlo na predku lavice (stojan + chvat v miste ruky)
      var wr = J.wristN, g0 = mad(wr, unit(J.elbowN, wr), B.hand * 0.4);
      bar(ctx, [g0[0], g0[1] + 2 * k], [g0[0], benchTop + 14 * k], 5 * k);
      ctx.fillStyle = C.rubber; ctx.beginPath(); circP(ctx, g0[0], g0[1], 3.8 * k); ctx.fill();
      ctx.fillStyle = C.metal; ctx.beginPath(); circP(ctx, g0[0], g0[1], 2.1 * k); ctx.fill();
      // lavice (dlouhy potah) - bližší k trupu, konec presne u kolene
      padRR(ctx, S[0] - 14 * k, benchTop, kn[0] - 6 * k - (S[0] - 14 * k), 9 * k, 4 * k);
      // paka s rolerem: stojan od osy, vodorovne rameno rovnobezne s holeni
      bar(ctx, kn, lv.P1, 4 * k, C.frame, C.frameD);
      bar(ctx, lv.P1, lv.PC, 4 * k, C.frame, C.frameD);
    }
    function front(ctx, J, t) {
      var lv = lever(J, t);
      roller(ctx, lv.PC, pad);
      hub(ctx, J.kneeN, 4.4 * k);
    }
    var zoom = autoFit(g, solve, eqBox, 12);
    F.register('legcurl', {
      title: 'Leg curl leže', view: 'side', facing: -1, zoom: zoom,
      tempo: { up: 1.0, hold: 0.4, down: 1.8, pause: 0.4 },
      phases: { up: 'Přitáhni paty ⬆', hold: 'Stiskni', down: 'Pomalu povol ⬇', pause: '' },
      solve: solve, back: back, front: front,
      highlight: function (t) { return { hamstrings: 0.2 + 0.8 * t, calves: 0.1 + 0.3 * t, glutes: 0.1 * t }; },
      _geo: { g: g, benchTop: benchTop, curlMax: curlMax }
    });
  })();

  /* =============================================================================
     3) LEG EXTENSION sede (bocni pohled, doprava)
     ============================================================================= */
  (function () {
    var g = { x0: 200 };
    var k = K, pad = 6.5 * k;
    var hipY = FLOOR - 8 * k - AH - B.shin, seatTop = hipY + 12, lean = -98, rPad = 0.88;
    function lever(J) {
      var kn = J.kneeN, a = F.ang(kn, J.ankleN), nf = dir(a - 90), legR = lerp(6.9, 4.1, rPad);
      var P1 = mad(kn, nf, legR + pad - 0.5 + 3.5 * k), PC = mad(mad(kn, dir(a), rPad * B.shin), nf, legR + pad - 0.5);
      return { a: a, nf: nf, P1: P1, PC: PC };
    }
    function solve(t) {
      t = clamp(t, 0, 1);
      var hip = [g.x0, hipY], S = F.pt(hip, lean, B.torso), kn = [hip[0] + B.thigh, hipY];
      var a = 90 * (1 - t), an = F.pt(kn, a, B.shin), tn = F.pt(an, a - 80, B.foot);
      var kf = F.pt(hip, -2.5, B.thigh), af = F.pt(kf, a, B.shin), tf = F.pt(af, a - 80, B.foot);
      var HP = [hip[0] + 0.28 * B.thigh, hipY - 0.3 * B.torso], HPF = [HP[0] + 3, HP[1] + 1];
      var an1 = ikSide(S, HP, B.upperArm, B.forearm, [-0.6, 0.8]), an2 = ikSide(S, HPF, B.upperArm, B.forearm, [-0.6, 0.8]);
      return { hip: hip, shoulder: S, head: F.pt(S, lean - 2, B.neck + B.headR),
               elbowN: an1.mid, wristN: an1.end, kneeN: kn, ankleN: an, toeN: tn,
               elbowF: an2.mid, wristF: an2.end, kneeF: kf, ankleF: af, toeF: tf };
    }
    function eqBox() { return [g.x0 - 36 * k, g.x0 + B.thigh + B.shin + 0.25 * B.foot + pad * 2 + 8 * k, hipY - 100]; }
    function back(ctx, J, t) {
      var hip = J.hip, kn = J.kneeN, S = J.shoulder, gy = FLOOR - 3.5 * k, td = dir(lean), nb = dir(lean - 90 - 8);
      shadow(ctx, (hip[0] + kn[0]) / 2 - 8 * k, (kn[0] - hip[0]) / 2 + 40 * k, 0.4);
      // zakladna, sloupek sedaku, opera opěrky
      bar(ctx, [hip[0] - 38 * k, gy], [kn[0] - 10 * k, gy], 6 * k);
      bar(ctx, [hip[0] + 0.25 * B.thigh, seatTop + 8 * k], [hip[0] + 0.25 * B.thigh, gy], 7 * k);
      var bc = mad(hip, [Math.cos((lean - 90) * RAD), Math.sin((lean - 90) * RAD)], 12 * k + 6 * k);       // stred opěrky (za zady)
      bar(ctx, mad(bc, td, 0.4 * B.torso), [hip[0] - 38 * k, gy], 5 * k);
      // drzak osy (konzola od predni hrany sedaku ke kolenní ose)
      bar(ctx, [kn[0] - 14 * k, seatTop + 6 * k], kn, 6 * k);
      // madlo u sedaku
      var wr = J.wristN, g0 = mad(wr, unit(J.elbowN, wr), B.hand * 0.4);
      bar(ctx, [g0[0], seatTop + 3 * k], [g0[0], g0[1] + 2 * k], 4.6 * k);
      ctx.fillStyle = C.rubber; ctx.beginPath(); circP(ctx, g0[0], g0[1], 3.8 * k); ctx.fill();
      ctx.fillStyle = C.metal; ctx.beginPath(); circP(ctx, g0[0], g0[1], 2.1 * k); ctx.fill();
      // opěrka a sedak
      padBar(ctx, mad(bc, td, -2 * k), mad(bc, td, B.torso + 3 * k), 11 * k);
      padRR(ctx, hip[0] - 24 * k, seatTop, (kn[0] - 9 * k) - (hip[0] - 24 * k), 9 * k, 4 * k);
      // paka s rolerem
      var lv = lever(J);
      bar(ctx, kn, lv.P1, 4 * k, C.frame, C.frameD);
      bar(ctx, lv.P1, lv.PC, 4 * k, C.frame, C.frameD);
    }
    function front(ctx, J) { roller(ctx, lever(J).PC, pad); hub(ctx, J.kneeN, 4.4 * k); }
    var zoom = autoFit(g, solve, eqBox, 12);
    F.register('legext', {
      title: 'Předkopávání (leg extension)', view: 'side', facing: 1, zoom: zoom,
      tempo: { up: 1.0, hold: 0.4, down: 1.8, pause: 0.4 },
      phases: { up: 'Propni nohy ⬆', hold: 'Zatni stehna', down: 'Pomalu dolů ⬇', pause: '' },
      solve: solve, back: back, front: front,
      highlight: function (t) { return { quads: 0.2 + 0.8 * t, calves: 0.05 + 0.05 * t }; },
      _geo: { g: g, seatTop: seatTop }
    });
  })();

  /* =============================================================================
     4) ABDUKCE sede (PREDNI pohled, opts.view = 'front')
        Pohled mirne shora (e = 32 st.): stehno miri k divakovi (zkrácene), holen svisle dolu.
     ============================================================================= */
  (function () {
    var g = { x0: 200 };
    var k = K, e = 32 * RAD, se = Math.sin(e), ce = Math.cos(e), lean = 6 * RAD;
    var hw = 9.5, sw = B.shoulderHalf, phi0 = -3, phi1 = 36, psi0 = 3, psi1 = 11;
    var spd = 14;                                               // vychylka spicky chodidla ven (st.)
    var footDz = FD * Math.cos(spd * RAD) * se, platDrop = AH * ce + footDz + 5;    // kotnik -> horni plocha stupatka
    var ank0 = B.thigh * Math.cos(phi0 * RAD) * se + B.shin * Math.cos(psi0 * RAD) * ce;
    var hipY = FLOOR - 8 * k - (ank0 + platDrop + 5 * k), shY = hipY - B.torso * Math.cos(e - lean);
    var kr = 7.3, pw = 6.5 * k, ph = 24 * k, hx = sw + 2.5, hy = hipY - 8;
    function leg(s, t) {                                        // s = -1 (vlevo na obrazovce) / +1
      var phi = lerp(phi0, phi1, t) * RAD, psi = lerp(psi0, psi1, t) * RAD, hp = [200 + s * hw, hipY];
      var kn = [hp[0] + s * B.thigh * Math.sin(phi), hipY + B.thigh * Math.cos(phi) * se];
      var an = [kn[0] + s * B.shin * Math.sin(psi), kn[1] + B.shin * Math.cos(psi) * ce];
      var to = [an[0] + s * FD * Math.sin(spd * RAD), an[1] + AH * ce + footDz];
      return { hip: hp, knee: kn, ankle: an, toe: to };
    }
    function solve(t) {
      t = clamp(t, 0, 1);
      var l = leg(-1, t), r = leg(1, t), sc = [200, shY], J;
      var aL = ikSide([200 - sw, shY], [200 - hx, hy], B.upperArm, B.forearm, [-1, 0.2]);
      var aR = ikSide([200 + sw, shY], [200 + hx, hy], B.upperArm, B.forearm, [1, 0.2]);
      J = { hip: [200, hipY], shoulder: sc, hipL: l.hip, hipR: r.hip, shoulderL: [200 - sw, shY], shoulderR: [200 + sw, shY],
            head: [200, shY - (B.neck + B.headR) * Math.cos(e - lean)],
            elbowL: aL.mid, wristL: aL.end, elbowR: aR.mid, wristR: aR.end,
            kneeL: l.knee, ankleL: l.ankle, toeL: l.toe, kneeR: r.knee, ankleR: r.ankle, toeR: r.toe };
      return J;
    }
    function eqBox() { return [200 - 78 * k, 200 + 78 * k, shY - 8 * k - (B.neck + B.headR) - 6]; }
    function padPos(J, s) {                                     // stred polstru na vnejsi strane kolene
      var kn = s < 0 ? J.kneeL : J.kneeR;
      return [kn[0] + s * (kr + pw / 2 - 1), kn[1] - 3 * k];
    }
    function back(ctx, J, t) {
      var gy = FLOOR - 3.5 * k, i, s, an, pc, sx = 200, seatF = hipY + B.thigh * Math.cos(phi0 * RAD) * se + 4 * k;
      shadow(ctx, sx, 80 * k, 0.4);
      // rám: základna, sloupek sedaku, zadni stojan
      bar(ctx, [sx - 74 * k, gy], [sx + 74 * k, gy], 7 * k);
      bar(ctx, [sx, seatF + 6 * k], [sx, gy], 16 * k);
      // opěrka zad (širší nez ramena) a sedák
      var bt = J.shoulder[1] - 6 * k, bw = 2 * (sw + 3.5 * k);
      bar(ctx, [sx, hipY], [sx, gy], 9 * k);
      padRR(ctx, sx - bw / 2, bt, bw, hipY + 3 * k - bt, 7 * k);
      padRR(ctx, sx - (hw + 12.7), hipY - 4 * k, 2 * (hw + 12.7), seatF - hipY + 10 * k, 5 * k);
      for (i = 0; i < 2; i++) {
        s = i ? 1 : -1; an = i ? J.ankleR : J.ankleL; pc = padPos(J, s);
        var pv = [sx + s * (hw + 1.6 * B.headR), hipY + 6 * k];
        // madlo u boku (postojka od sedaku k ruce)
        var wr = i ? J.wristR : J.wristL;
        bar(ctx, [wr[0], hipY + 12 * k], [wr[0], wr[1]], 4.6 * k);
        ctx.fillStyle = C.rubber; ctx.beginPath(); circP(ctx, wr[0], wr[1], 3.6 * k); ctx.fill();
        // paka od osy k polstru + stupatko na paka
        bar(ctx, pv, pc, 6 * k, C.metal, '#6f6890');
        // stupatko (horni plocha + celo) a ramínko od polstru
        var pwid = 0.62 * B.foot, px = an[0] + s * 0.15 * B.foot, py0 = an[1] + AH * ce - 2 * k, py1 = an[1] + platDrop;
        bar(ctx, [pc[0], pc[1] + ph / 2 - 2 * k], [px + s * pwid / 2, py1], 5 * k);
        shRR(ctx, px - pwid, py0, 2 * pwid, py1 - py0, 4 * k, C.pad, C.padD);
        shRR(ctx, px - pwid, py1 - 1 * k, 2 * pwid, 5 * k, 2 * k, C.frame, C.frameD);
        ctx.fillStyle = C.padTop; ctx.fillRect(px - pwid + 3 * k, py0 + 0.8, 2 * pwid - 6 * k, 1.2);
        hub(ctx, pv, 4.4 * k);
      }
    }
    function front(ctx, J) {
      for (var i = 0; i < 2; i++) {
        var s = i ? 1 : -1, pc = padPos(J, s);
        padRR(ctx, pc[0] - pw / 2, pc[1] - ph / 2, pw, ph, 3 * k);
      }
    }
    var zoom = autoFit(g, solve, eqBox, 12);
    F.register('abduction', {
      title: 'Abdukce kolen na stroji', view: 'front', facing: 1, zoom: zoom,
      tempo: { up: 1.2, hold: 0.5, down: 1.8, pause: 0.4 },
      phases: { up: 'Roztlač kolena ↔', hold: 'Výdrž', down: 'Pomalu k sobě', pause: '' },
      solve: solve, back: back, front: front,
      highlight: function (t) { return { abductors: 0.2 + 0.8 * t, glutes: 0.1 + 0.4 * t }; },
      _geo: { g: g, e: e, se: se, ce: ce, lean: lean, hw: hw, sw: sw, spd: spd, phi0: phi0, phi1: phi1, psi0: psi0, psi1: psi1, platDrop: platDrop, hipY: hipY }
    });
  })();

  /* =============================================================================
     5) VYPONY NA LYTKA (schod, bocni pohled, doprava, cinky v rukou)
        Spicky chodidel (kontakt "spicka") zustavaji na hrane schodu, pata klesa pod / stoupa nad uroven schodu.
     ============================================================================= */
  (function () {
    var g = { x0: 200 };
    var k = K, b0 = -8, b1 = 36, stepH = Math.round(13 * k), stepTop = FLOOR - stepH, Lleg = 0.985 * L;
    var stepW = 52 * k, edge = 9;                               // schod: levy okraj je 9 j. pred spickou
    function ankle(Pb, beta) {                                  // kotnik pri kontaktu spicky Pb a uhlu chodidla beta (+ = pata nahoru)
      var u = dir(beta), n = [u[1], -u[0]];
      return [Pb[0] - u[0] * FD + n[0] * AH, Pb[1] - u[1] * FD + n[1] * AH];
    }
    function solve(t) {
      t = clamp(t, 0, 1);
      var beta = lerp(b0, b1, t), Pb = [g.x0, stepTop], PbF = [g.x0 + 4 * k, stepTop];
      var A = ankle(Pb, beta), Ar = ankle(Pb, b0), AF = ankle(PbF, beta);
      var hx = Ar[0] + 0.45 * (A[0] - Ar[0]) + 2 * k, hip = [hx, A[1] - Math.sqrt(sq(Lleg) - sq(hx - A[0]))];
      var kn = ikSide(hip, A, B.thigh, B.shin, [1, 0]), kf = ikSide(hip, AF, B.thigh, B.shin, [1, 0]);
      var S = F.pt(hip, -88, B.torso), arm = B.upperArm + B.forearm;
      var wN = mad(S, dir(92), 0.97 * arm), wF = [wN[0] + 5 * k, wN[1] - 1];
      var an = ikSide(S, wN, B.upperArm, B.forearm, [-1, 0]), af = ikSide(S, wF, B.upperArm, B.forearm, [-1, 0]);
      return { hip: hip, shoulder: S, head: F.pt(S, -86, B.neck + B.headR),
               elbowN: an.mid, wristN: an.end, kneeN: kn.mid, ankleN: kn.end, toeN: Pb,
               elbowF: af.mid, wristF: af.end, kneeF: kf.mid, ankleF: kf.end, toeF: PbF };
    }
    function eqBox() { return [g.x0 - edge - 4, g.x0 - edge + stepW + 4, stepTop - 2]; }
    function back(ctx, J) {
      var x0 = g.x0 - edge;
      F.gear.step(ctx, x0, stepTop, stepW, stepH);
      F.gear.dumbbell(ctx, J.wristF[0], J.wristF[1], 0);        // vzdalenejsi cinka (za telem)
    }
    function front(ctx, J) { F.gear.dumbbell(ctx, J.wristN[0], J.wristN[1], 0); }
    var zoom = autoFit(g, solve, eqBox, 10);
    F.register('calf', {
      title: 'Výpony na lýtka', view: 'side', facing: 1, zoom: zoom,
      tempo: { up: 0.6, hold: 0.3, down: 1.0, pause: 0.3 },
      phases: { up: 'Na špičky ⬆', hold: 'Výdrž nahoře', down: 'Paty pod schod ⬇', pause: '' },
      solve: solve, back: back, front: front,
      highlight: function (t) { return { calves: 0.15 + 0.85 * t }; },
      _geo: { g: g, stepTop: stepTop, stepH: stepH, Lleg: Lleg, ankle: ankle, b0: b0, b1: b1 }
    });
  })();
})();
