/* =====================================================================
   animace-horni.js - cviky na horni cast tela pro FitAnim (animace.js)
   Klice: latpulldown, chestpress, row, shoulderpress, biceps.
   Jen FitAnim.register(...). Delky koncetin berou z FitAnim.BODY, podlahu z FitAnim.FLOOR,
   ruce/nohy vedou pres FitAnim.ik2 (nic se nenatahuje, ruce zustavaji na madlech / tyci).
   ===================================================================== */
(function (root) {
'use strict';
var F = root.FitAnim;
if (!F || typeof F.register !== 'function') throw new Error('animace-horni.js: nejdriv nacti animace.js (FitAnim)');

var PI = Math.PI, D2R = PI / 180;
var COL = { line: '#332d4d', card2: '#2a2540', muted: '#9b94b8', accent: '#a78bfa', accent2: '#7c3aed',
            frame: '#4b4574', frameD: '#38335a', pad: '#3f3a6c', padD: '#2f2a55', padTop: '#53498f',
            rubber: '#1a162b', metal: '#8f88ad', metalL: '#d6d1ea' };

/* ------------------------------ pomocne funkce ------------------------------ */
function B() { return F.BODY; }
function U() { return F.U || B().torso / 76; }               // meritko konstant v pixelech
function AH() { return B().ankleH != null ? B().ankleH : B().shin * 0.13; }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerp2(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
function add(a, x, y) { return [a[0] + x, a[1] + y]; }
function toeFlat(A) { return F.toeFloor ? F.toeFloor(A, 1) : [A[0] + B().foot, F.FLOOR]; }

/* IK s vyberem strany kloubu podle smeru dir (nezavisle na znamenku bend v enginu):
   zvoli reseni, jehoz stredni kloub lezi vice ve smeru dir od primky base->target. */
function ik(base, target, l1, l2, dir) {
  var a = F.ik2(base, target, l1, l2, 1), b = F.ik2(base, target, l1, l2, -1);
  var mx = (base[0] + target[0]) / 2, my = (base[1] + target[1]) / 2;
  var sa = (a.mid[0] - mx) * dir[0] + (a.mid[1] - my) * dir[1];
  var sb = (b.mid[0] - mx) * dir[0] + (b.mid[1] - my) * dir[1];
  return sa >= sb ? a : b;
}

/* ------------------------------ kresleni (plain ctx) ------------------------------ */
function bx(c, x, y, w, h, r, col, hi) {                     // zaoblena krabice s odleskem
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  c.fillStyle = col; c.fill();
  if (hi) { c.fillStyle = hi; c.fillRect(x + r * 0.6, y + 0.7, Math.max(0, w - r * 1.2), 1.1); }
}
function wheel(c, x, y, r) {                                  // kladka (jako gear.pulley)
  c.fillStyle = COL.rubber; c.beginPath(); c.arc(x, y, r, 0, PI * 2); c.fill();
  c.strokeStyle = COL.accent2; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, r - 1.4, 0, PI * 2); c.stroke();
  c.fillStyle = COL.metal; c.beginPath(); c.arc(x, y, r * 0.3, 0, PI * 2); c.fill();
}
function poly(c, pts) {                                       // lano (lomena cara) pres gear.cable
  for (var i = 0; i + 1 < pts.length; i++) F.gear.cable(c, pts[i], pts[i + 1]);
}
function grip(c, p, r) {                                      // madlo videne z konce (kruh) - ruka ho prekryje
  c.fillStyle = COL.rubber; c.beginPath(); c.arc(p[0], p[1], r, 0, PI * 2); c.fill();
  c.strokeStyle = COL.metal; c.lineWidth = 1.3; c.beginPath(); c.arc(p[0], p[1], r - 0.7, 0, PI * 2); c.stroke();
}
function stroke(c, a, b, w, col) {
  c.lineCap = 'round'; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
}
var STACK_Y = function () { return F.FLOOR - 61; };           // horni hrana zavazi v klidu (gear.stack: 8 desek -> spodek u podlahy)
function stackLift(c, X, lift) {                              // vykresli zavazi, vrati y, kde se lano pripojuje
  F.gear.stack(c, X, STACK_Y(), lift);
  return STACK_Y() - lift - 1;
}

/* nohy vsedeti: kycel pevny, kotnik na podlaze (nebo definovany), kolena pres IK */
function seatedLegs(hip, ankN, ankF, kdir) {
  var b = B();
  return {
    kneeN: ik(hip, ankN, b.thigh, b.shin, kdir).mid, kneeF: ik(hip, ankF, b.thigh, b.shin, kdir).mid
  };
}

/* ============================================================================
   1) LAT PULLDOWN
   ============================================================================ */
function latG() {
  var b = B(), u = U(), FL = F.FLOOR, ah = AH(), g = { b: b, u: u, FL: FL };
  g.hip = [190, FL - ah - b.shin * 0.97];
  g.ankN = [g.hip[0] + b.thigh * 0.93, FL - ah];
  g.ankF = [g.ankN[0] - 6 * u, FL - ah];
  var k = seatedLegs(g.hip, g.ankN, g.ankF, [0.4, -1]);
  g.kneeN = k.kneeN; g.kneeF = k.kneeF;
  g.toeN = toeFlat(g.ankN); g.toeF = toeFlat(g.ankF);
  g.seatTop = g.hip[1] + 0.2 * b.thigh;
  g.L = b.upperArm + b.forearm;
  g.G0 = F.pt(latSh(g, 0), -74, 0.965 * g.L);
  g.P = [g.G0[0] + 6 * u, Math.max(32, g.G0[1] - 24 * u)];     // horni kladka (pod listou)
  g.sx = g.hip[0] - 96;                                         // osa zavazi
  g.colX = g.hip[0] - 50;
  g.post = g.kneeN[0] + 32;
  return g;
}
function latSh(g, t) {
  var l = lerp(3, 13, t) * D2R;                                 // zaklon trupu
  return [g.hip[0] - g.b.torso * Math.sin(l), g.hip[1] - g.b.torso * Math.cos(l)];
}
function latGrip(g, t) {                                        // poloha tyce (= zapesti obou rukou)
  var sh1 = latSh(g, 1), G1 = [sh1[0] + 0.21 * g.b.torso, sh1[1] + 0.15 * g.b.torso];
  var p = lerp2(g.G0, G1, t); p[0] += 0.17 * g.b.torso * Math.sin(PI * t);   // oblouk pred obliceji
  return p;
}
function latSolve(t) {
  var g = latG(), b = g.b, u = g.u, sh = latSh(g, t), lean = lerp(3, 13, t);
  var G = latGrip(g, t), GF = [G[0] - 4 * u, G[1] - 1.5 * u];
  var rn = ik(sh, G, b.upperArm, b.forearm, [-0.6, 1]), rf = ik(sh, GF, b.upperArm, b.forearm, [-0.6, 1]);
  return {
    hip: g.hip.slice(), shoulder: sh, head: F.headAt(sh, -90 - lean * 0.35 + 7),
    elbowN: rn.mid, wristN: rn.end, elbowF: rf.mid, wristF: rf.end,
    kneeN: g.kneeN, ankleN: g.ankN, toeN: g.toeN, kneeF: g.kneeF, ankleF: g.ankF, toeF: g.toeF
  };
}
function latBack(c, J, t) {
  var g = latG(), u = g.u, FL = g.FL, G = latGrip(g, t), P = g.P, G0 = g.G0, gr = F.gear;
  var topY = P[1] - 16 + 1.5;
  gr.shadow(c, g.hip[0] + 40, FL + 0.5, 90, 0.25, 3);
  gr.frame(c, [[g.sx - 22, FL - 3], [g.post + 14, FL - 3]]);                         // zakladna
  gr.frame(c, [[g.colX, FL - 3], [g.colX, topY], [P[0] + 4, topY]]);                 // sloup + vodorovna lista
  gr.rail(c, g.sx - 11, STACK_Y() - 12, g.sx - 11, topY);
  gr.rail(c, g.sx + 11, STACK_Y() - 12, g.sx + 11, topY);
  gr.frame(c, [[g.sx - 13, topY], [g.colX, topY]]);
  var lift = clamp((dist(G, P) - dist(G0, P)) * 0.32, 0, 32);
  var top = stackLift(c, g.sx, lift);
  gr.seat(c, g.hip[0] - 20, g.seatTop, 42);
  gr.pulley(c, g.sx, P[1]); gr.pulley(c, P[0], P[1]);
  var dx = G[0] - P[0], dy = G[1] - P[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
  var apex = [G[0] - ux * 13, G[1] - uy * 13], bw = 10 * u + 2;
  poly(c, [[g.sx, top], [g.sx, P[1]], [P[0], P[1]], apex]);
  stroke(c, apex, [G[0] - bw, G[1] - 2], 1.3, '#b9b4d2'); stroke(c, apex, [G[0] + bw, G[1] - 2], 1.3, '#b9b4d2');
  gr.bar(c, G[0] - bw - 2, G[1] - 2, G[0] + bw + 2, G[1] - 2);                       // kratka sirsi tyc
}
function latFront(c, J, t) {                                    // kolenni valecky (pres stehna) + drzak
  var g = latG(), b = g.b, h = g.hip, k = g.kneeN, gr = F.gear;
  var dl = dist(h, k), dx = (k[0] - h[0]) / dl, dy = (k[1] - h[1]) / dl;
  var C = [h[0] + dx * b.thigh * 0.78 + dy * 12, h[1] + dy * b.thigh * 0.78 - dx * 12];
  var armY = C[1] - 13;
  gr.frame(c, [[C[0], C[1] - 6], [C[0], armY], [g.post, armY], [g.post, g.FL - 3]]);
  gr.pad(c, C[0], C[1], 6.5);
}

/* ============================================================================
   2) CHEST PRESS (stroj)
   ============================================================================ */
function cpG() {
  var b = B(), u = U(), FL = F.FLOOR, ah = AH(), g = { b: b, u: u, FL: FL };
  g.hip = [232, FL - ah - b.shin * 0.97];
  g.ankN = [g.hip[0] + b.thigh * 0.93, FL - ah];
  g.ankF = [g.ankN[0] - 6 * u, FL - ah];
  var k = seatedLegs(g.hip, g.ankN, g.ankF, [0.4, -1]);
  g.kneeN = k.kneeN; g.kneeF = k.kneeF; g.toeN = toeFlat(g.ankN); g.toeF = toeFlat(g.ankF);
  g.seatTop = g.hip[1] + 0.2 * b.thigh;
  var lean = 6 * D2R; g.lean = lean;
  g.uu = [-Math.sin(lean), -Math.cos(lean)];                     // smer kycel -> rameno
  g.nb = [-Math.cos(lean), Math.sin(lean)];                      // normala dozadu (k opernemu)
  g.sh = [g.hip[0] + g.uu[0] * b.torso, g.hip[1] + g.uu[1] * b.torso];
  g.L = b.upperArm + b.forearm;
  g.dy = 0.19 * b.torso; g.hy = g.sh[1] + g.dy;                  // vyska madel (hrud)
  g.x0 = 13 * u;
  var R = 0.965 * g.L; g.x1 = Math.sqrt(R * R - g.dy * g.dy);    // predpazeni (ne zamcene)
  g.rearX = g.sh[0] - 22 * u;
  g.Lh = g.sh[0] + g.x1 - g.rearX;                               // delka paky
  g.block0 = g.sh[0] + g.x0 - g.Lh;
  g.sx = g.block0 - 34 * u;                                      // osa zavazi / kladky
  return g;
}
function cpBar(g, t) { return [g.sh[0] + lerp(g.x0, g.x1, t), g.hy]; }
function cpSolve(t) {
  var g = cpG(), b = g.b, u = g.u, sh = g.sh, G = cpBar(g, t), GF = [G[0] - 3 * u, G[1] - 3.5 * u];
  var rn = ik(sh, G, b.upperArm, b.forearm, [-1, 0.5]), rf = ik(sh, GF, b.upperArm, b.forearm, [-1, 0.5]);
  return {
    hip: g.hip.slice(), shoulder: sh.slice(), head: F.headAt(sh, -90 - g.lean / D2R + 3),
    elbowN: rn.mid, wristN: rn.end, elbowF: rf.mid, wristF: rf.end,
    kneeN: g.kneeN, ankleN: g.ankN, toeN: g.toeN, kneeF: g.kneeF, ankleF: g.ankF, toeF: g.toeF
  };
}
function cpBack(c, J, t) {
  var g = cpG(), b = g.b, u = g.u, FL = g.FL, gr = F.gear, G = cpBar(g, t), G0 = cpBar(g, 0), hy = g.hy;
  var blockX = G[0] - g.Lh, lift = clamp((blockX - g.block0) * 0.32, 0, 30);
  gr.shadow(c, g.hip[0] - 10, FL + 0.5, 105, 0.25, 3);
  gr.frame(c, [[g.sx - 20, FL - 3], [g.rearX - 2, FL - 3]]);                           // zakladna
  gr.frame(c, [[g.rearX - 8, FL - 3], [g.rearX - 8, hy - 8]]);                         // sloup
  gr.rail(c, g.sx - 11, STACK_Y() - 12, g.sx - 11, hy - 14);
  gr.rail(c, g.sx + 11, STACK_Y() - 12, g.sx + 11, hy - 14);
  var top = stackLift(c, g.sx, lift);
  gr.rail(c, g.sx + 10, hy - 7, g.rearX - 8, hy - 7);                                  // vodici lista
  gr.pulley(c, g.sx, hy);
  poly(c, [[g.sx, top], [g.sx, hy], [blockX - 6, hy]]);                                // lano zavazi -> vozik
  bx(c, blockX - 6, hy - 10, 12, 13, 2.5, COL.frame, COL.padTop);                      // vozik
  var GFp = [G[0] - 3 * u, G[1] - 3.5 * u];                                            // vzdalenejsi paka
  stroke(c, [blockX - 3 * u, hy - 3.5 * u], GFp, 4.2, COL.frameD);
  stroke(c, [blockX, hy], G, 5, COL.frame); stroke(c, [blockX, hy - 1.2], [G[0], G[1] - 1.2], 1.3, COL.padTop);
  grip(c, GFp, 5); grip(c, G, 5.6);
  // opěradlo (sklon 6 stupnu) + sedak
  var p0 = [g.hip[0] + g.nb[0] * 17 - g.uu[0] * 6, g.hip[1] + g.nb[1] * 17 - g.uu[1] * 6];
  var p1 = [g.sh[0] + g.nb[0] * 13 + g.uu[0] * 22, g.sh[1] + g.nb[1] * 13 + g.uu[1] * 22];
  gr.seat(c, g.hip[0] - 22, g.seatTop, 46, { back: { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1] } });
}

/* ============================================================================
   3) SEATED CABLE ROW
   ============================================================================ */
function rowG() {
  var b = B(), u = U(), FL = F.FLOOR, g = { b: b, u: u, FL: FL };
  g.seatTop = FL - 14;
  g.hip = [112, g.seatTop - 0.21 * b.thigh];
  var ay = FL - 22, dd = 0.985 * (b.thigh + b.shin);
  g.ankN = [g.hip[0] + Math.sqrt(dd * dd - (ay - g.hip[1]) * (ay - g.hip[1])), ay];
  g.ankF = [g.ankN[0] - 3, ay];
  var k = seatedLegs(g.hip, g.ankN, g.ankF, [0.3, -1]);
  g.kneeN = k.kneeN; g.kneeF = k.kneeF;
  var soleDir = -84, a2 = soleDir * D2R;                         // chodidlo opreno o desku (spicky nahoru)
  g.toeN = F.pt(g.ankN, soleDir + 21.3, b.foot); g.toeF = F.pt(g.ankF, soleDir + 21.3, b.foot);
  g.soleOff = [-8 * Math.sin(a2), 8 * Math.cos(a2)];             // kotnik -> podesev (ve smeru ven z nohy)
  g.L = b.upperArm + b.forearm;
  g.plateTop = [g.ankN[0] + g.soleOff[0] + 2.5 + 30 * Math.cos(a2), g.ankN[1] + g.soleOff[1] + 30 * Math.sin(a2)];
  var sb = (g.ankN[1] + g.soleOff[1] - (FL - 3)) / Math.sin(-a2);      // spodni konec desky (y = FL-3)
  g.plateBot = [g.ankN[0] + g.soleOff[0] + 2.5 - sb * Math.cos(a2), FL - 3];
  g.P = [g.plateBot[0] + 17 * u, FL - 22 * u];                   // spodni kladka
  g.sx = g.P[0] + 56 * u;                                        // zavazi vpravo
  g.lift0 = 0;
  return g;
}
function rowLean(t) { return lerp(26, -4, t) * D2R; }           // + = predklon
function rowSh(g, t) { var l = rowLean(t); return [g.hip[0] + g.b.torso * Math.sin(l), g.hip[1] - g.b.torso * Math.cos(l)]; }
function rowGrip(g, t) {
  var sh0 = rowSh(g, 0), W0 = F.pt(sh0, 14, 0.965 * g.L);       // paze natazene dopredu
  var W1 = [g.hip[0] + 0.1 * g.b.torso + 8 * g.u, g.hip[1] - 0.27 * g.b.torso];   // madlo u brisa
  return lerp2(W0, W1, t);
}
function rowSolve(t) {
  var g = rowG(), b = g.b, u = g.u, sh = rowSh(g, t), G = rowGrip(g, t), GF = [G[0] - 3 * u, G[1] - 1.5 * u];
  var rn = ik(sh, G, b.upperArm, b.forearm, [-0.4, 1]), rf = ik(sh, GF, b.upperArm, b.forearm, [-0.4, 1]);
  var l = rowLean(t) / D2R;
  return {
    hip: g.hip.slice(), shoulder: sh, head: F.headAt(sh, -90 + l * 0.5 + 6),
    elbowN: rn.mid, wristN: rn.end, elbowF: rf.mid, wristF: rf.end,
    kneeN: g.kneeN, ankleN: g.ankN, toeN: g.toeN, kneeF: g.kneeF, ankleF: g.ankF, toeF: g.toeF
  };
}
function rowBack(c, J, t) {
  var g = rowG(), u = g.u, FL = g.FL, gr = F.gear, G = rowGrip(g, t), G0 = rowGrip(g, 0), P = g.P, sx = g.sx;
  var lift = clamp((dist(G, P) - dist(G0, P)) * 0.4, 0, 30), topP = STACK_Y() - 36;
  gr.shadow(c, 190, FL + 0.5, 140, 0.22, 3);
  gr.frame(c, [[g.hip[0] - 34, FL - 3], [sx + 20, FL - 3]]);                                // dlouha zakladna
  gr.frame(c, [[g.plateBot[0], g.plateBot[1]], [g.plateTop[0], g.plateTop[1]]]);           // opěrná deska nohou
  gr.frame(c, [[P[0], FL - 3], [P[0], P[1]]]);                                              // sloupek kladky
  gr.rail(c, sx - 11, STACK_Y() - 12, sx - 11, topP - 2);
  gr.rail(c, sx + 11, STACK_Y() - 12, sx + 11, topP - 2);
  var top = stackLift(c, sx, lift);
  gr.step(c, g.hip[0] - 30, g.seatTop, 62, FL - g.seatTop);                                 // nizka lavice / plosina
  wheel(c, P[0], P[1], 6.4);
  wheel(c, sx - 24, P[1], 4.4);
  gr.pulley(c, sx - 24, topP); gr.pulley(c, sx, topP);
  poly(c, [[P[0], P[1]], [sx - 24, P[1]], [sx - 24, topP], [sx, topP], [sx, top]]);        // lano k zavazi (za nohama)
  grip(c, [G[0] - 3 * u, G[1] - 1.5 * u], 4.6); grip(c, G, 5);
}
function rowFront(c, J, t) {                                    // lano madlo -> kladka vede pres nohy (mezi koleny)
  var g = rowG(), P = g.P, G = rowGrip(g, t), dx = G[0] - P[0], dy = G[1] - P[1], dl = Math.hypot(dx, dy) || 1;
  var link = [G[0] + dx / dl * 14, G[1] + dy / dl * 14];
  stroke(c, [G[0] + dx / dl * 5, G[1] + dy / dl * 5], link, 2.6, COL.metal);               // V-madlo -> lano
  F.gear.cable(c, link, P);
}

/* ============================================================================
   4) SHOULDER PRESS s jednorucnimi (predni pohled)
   ============================================================================ */
function spG() {
  var b = B(), u = U(), FL = F.FLOOR, ah = AH(), g = { b: b, u: u, FL: FL };
  g.cx = 200; g.sw = b.shoulderHalf != null ? b.shoulderHalf : 0.2 * b.torso; g.hh = b.hipHalf != null ? b.hipHalf : 0.14 * b.torso;
  var kneeY = FL - ah - b.shin;
  g.hipY = kneeY - 3; g.shY = g.hipY - b.torso;
  g.kx = 14;                                                      // kolena (zepredu) -> nohy lehce od sebe
  g.L = b.upperArm + b.forearm;
  g.xc = 19;                                                      // stred cinky nahore (cinky se nedotykaji)
  return g;
}
function spSide(g, s, t) {                                        // s = -1 vlevo, +1 vpravo
  var b = g.b, sx = g.cx + s * g.sw, sy = g.shY, sh = [sx, sy];
  var wy0 = sy - 18, ey0 = wy0 + b.forearm;                       // predlokti svisle, zapesti u ucha
  var ex0 = sx + s * Math.sqrt(b.upperArm * b.upperArm - (ey0 - sy) * (ey0 - sy));
  var C0 = [ex0, wy0];
  var R = 0.965 * g.L, xx = g.cx + s * g.xc, dx = xx - sx;
  var C1 = [xx, sy - Math.sqrt(R * R - dx * dx)];
  var C = lerp2(C0, C1, t);
  var r = ik(sh, C, b.upperArm, b.forearm, [s * 0.6, 1]);
  return { sh: sh, elbow: r.mid, wrist: r.end };
}
function spSolve(t) {
  var g = spG(), b = g.b, FL = g.FL, L = spSide(g, -1, t), R = spSide(g, 1, t), ah = AH();
  var hip = [g.cx, g.hipY], hL = [g.cx - g.hh, g.hipY], hR = [g.cx + g.hh, g.hipY], kneeY = FL - ah - b.shin;
  return {
    hip: hip, shoulder: [g.cx, g.shY], hipL: hL, hipR: hR, shoulderL: L.sh, shoulderR: R.sh,
    head: [g.cx, g.shY - b.neck - b.headR],
    elbowL: L.elbow, wristL: L.wrist, elbowR: R.elbow, wristR: R.wrist,
    kneeL: [g.cx - g.kx, kneeY], ankleL: [g.cx - g.kx, FL - ah], kneeR: [g.cx + g.kx, kneeY], ankleR: [g.cx + g.kx, FL - ah]
  };
}
function spBack(c, J, t) {
  var g = spG(), b = g.b, FL = g.FL, gr = F.gear, cx = g.cx, L = spSide(g, -1, t), R = spSide(g, 1, t);
  gr.shadow(c, cx, FL + 0.5, 40, 0.3, 3);
  gr.frame(c, [[cx - 30, FL - 3], [cx + 30, FL - 3]]);                                      // zakladna lavice
  gr.frame(c, [[cx, g.hipY + 20], [cx, FL - 3]]);                                           // stred. noha
  bx(c, cx - 27, g.hipY + 11, 54, 9, 4, COL.pad, COL.padTop);                               // sedak
  var top = g.shY - b.neck - b.headR * 0.5 - 6;
  bx(c, cx - g.sw - 5, top, 2 * g.sw + 10, g.hipY + 14 - top, 6, COL.pad, COL.padTop);      // opěradlo
  gr.dumbbell(c, L.wrist[0], L.wrist[1], 0); gr.dumbbell(c, R.wrist[0], R.wrist[1], 0);
}

/* ============================================================================
   5) BICEPS CURL (stoj, cinky)
   ============================================================================ */
function bcG() {
  var b = B(), u = U(), FL = F.FLOOR, ah = AH(), g = { b: b, u: u, FL: FL };
  g.ankN = [196, FL - ah]; g.ankF = [190, FL - ah];
  g.hip = [g.ankN[0] - 2, g.ankN[1] - 0.992 * (b.thigh + b.shin)];     // mekka kolena
  g.sh = [g.hip[0] - b.torso * Math.sin(2 * D2R), g.hip[1] - b.torso * Math.cos(2 * D2R)];
  g.kneeN = ik(g.hip, g.ankN, b.thigh, b.shin, [1, -0.2]).mid;
  g.kneeF = ik(g.hip, g.ankF, b.thigh, b.shin, [1, -0.2]).mid;
  g.toeN = toeFlat(g.ankN); g.toeF = toeFlat(g.ankF);
  return g;
}
function bcArm(g, t, far) {
  var b = g.b, up = lerp(93, 84, t) + (far ? 4 : 0), fa = lerp(82, -66, t) + (far ? 7 : 0);   // loket pripnuty, predlokti se zvedá
  var E = F.pt(g.sh, up, b.upperArm), W = F.pt(E, fa, b.forearm);
  return { elbow: E, wrist: W };
}
function bcSolve(t) {
  var g = bcG(), n = bcArm(g, t, false), f = bcArm(g, t, true);
  return {
    hip: g.hip.slice(), shoulder: g.sh.slice(), head: F.headAt(g.sh, -90 + 3),
    elbowN: n.elbow, wristN: n.wrist, elbowF: f.elbow, wristF: f.wrist,
    kneeN: g.kneeN, ankleN: g.ankN, toeN: g.toeN, kneeF: g.kneeF, ankleF: g.ankF, toeF: g.toeF
  };
}
function bcBack(c, J, t) {                                       // vzdalenejsi cinka (kruh, pohled na konec)
  var g = bcG(), f = bcArm(g, t, true);
  F.gear.shadow(c, 193, g.FL + 0.5, 46, 0.25, 3);
  F.gear.dumbbell(c, f.wrist[0] - 2, f.wrist[1] - 1, 0, { end: true });
}
function bcFront(c, J, t) {
  var g = bcG(), n = bcArm(g, t, false);
  F.gear.dumbbell(c, n.wrist[0], n.wrist[1], 0, { end: true });
}

/* ============================== registrace ============================== */
F.register('latpulldown', {
  title: 'Přitahování kladky k hrudi (lat pulldown)', view: 'side', facing: 1,
  tempo: { up: 1.1, hold: 0.4, down: 1.8, pause: 0.4 },
  phases: { up: 'Přitáhni k hrudi ⬇', hold: 'Stáhni lopatky', down: 'Pomalu nahoru ⬆', pause: '' },
  solve: latSolve, back: latBack, front: latFront,
  highlight: function (t) { return { lats: 0.25 + 0.75 * t, back: 0.12 + 0.3 * t, biceps: 0.08 + 0.25 * t }; }
});
F.register('chestpress', {
  title: 'Tlaky na hrudník na stroji (chest press)', view: 'side', facing: 1,
  tempo: { up: 1.0, hold: 0.4, down: 1.7, pause: 0.4 },
  phases: { up: 'Vytlač vpřed ➡', hold: 'Výdrž', down: 'Pomalu zpět', pause: '' },
  solve: cpSolve, back: cpBack,
  highlight: function (t) { return { chest: 0.25 + 0.75 * t, triceps: 0.1 + 0.3 * t, shoulders: 0.1 + 0.3 * t }; }
});
F.register('row', {
  title: 'Veslování na kladce v sedu (seated row)', view: 'side', facing: 1,
  tempo: { up: 1.1, hold: 0.4, down: 1.8, pause: 0.4 },
  phases: { up: 'Přitáhni k břichu ⬅', hold: 'Stiskni lopatky', down: 'Pomalu povol ➡', pause: '' },
  solve: rowSolve, back: rowBack, front: rowFront,
  highlight: function (t) { return { back: 0.25 + 0.75 * t, lats: 0.25 + 0.75 * t, biceps: 0.1 + 0.3 * t }; }
});
F.register('shoulderpress', {
  title: 'Tlaky s jednoručkami v sedu (shoulder press)', view: 'front', facing: 1, zoom: 1.15,
  tempo: { up: 1.1, hold: 0.4, down: 1.8, pause: 0.4 },
  phases: { up: 'Vytlač nad hlavu ⬆', hold: 'Výdrž', down: 'Pomalu dolů ⬇', pause: '' },
  solve: spSolve, back: spBack,
  highlight: function (t) { return { shoulders: 0.25 + 0.75 * t, triceps: 0.1 + 0.3 * t }; }
});
F.register('biceps', {
  title: 'Zdvihy s jednoručkami na biceps (biceps curl)', view: 'side', facing: 1, zoom: 1.1,
  tempo: { up: 0.8, hold: 0.3, down: 1.4, pause: 0.3 },
  phases: { up: 'Zvedni ⬆', hold: 'Zatni biceps', down: 'Pomalu dolů ⬇', pause: '' },
  solve: bcSolve, back: bcBack, front: bcFront,
  highlight: function (t) { return { biceps: 0.2 + 0.8 * Math.pow(t, 1.2) }; }
});
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
