/* animace-hipthrust.js - Hip thrust s cinkou (bocni pohled). REFERENCNI PRIKLAD cviku pro FitAnim.
   Pouziva jen verejne API: FitAnim.BODY, ik2, toeFloor, register, gear.*  (zadne interni funkce). */
(function () {
  var F = window.FitAnim; if (!F) return;
  var B = F.BODY, FLOOR = F.FLOOR, clamp = F.clamp;

  /* ---- pevna geometrie sceny (logicke jednotky 400x250; scena vycentrovana kolem x = 200, zoom 1.6) ---- */
  var KNEE_BACK = 5;                                  // nahore je kotnik o 5 j. za kolenem
  var ANK = [172 + B.torso + B.thigh - KNEE_BACK, FLOOR - B.ankleH];          // pevne chodidlo (bliz noha)
  var ANK_F = [ANK[0] + 7, ANK[1]];                                           // vzdalenejsi noha mirne vedle
  var SH = [172, ANK[1] - Math.sqrt(B.shin * B.shin - KNEE_BACK * KNEE_BACK)]; // rameno pevne na hrane lavice
  var TH0 = 43 * Math.PI / 180;                       // sklon trupu v dolni poloze
  var BENCH = { x: 107, y: SH[1] + 7.2, w: 68, h: 8.5 };
  var PLATE_R = 21;
  var TOE = F.toeFloor(ANK, 1), TOE_F = F.toeFloor(ANK_F, 1);

  function solve(t) {
    var th = TH0 * (1 - t), u = [Math.cos(th), Math.sin(th)], n = [u[1], -u[0]];   // u: rameno->kycel, n: normala k hrudi (nahoru)
    var hip = [SH[0] + u[0] * B.torso, SH[1] + u[1] * B.torso];
    var kN = F.ik2(hip, ANK, B.thigh, B.shin, -1).mid;
    var kF = F.ik2(hip, ANK_F, B.thigh, B.shin, -1).mid;
    var bar = [hip[0] + n[0] * 5.5 - u[0] * 3, hip[1] + n[1] * 5.5 - u[1] * 3];     // cinka v zahybu boku
    var arm = F.ik2(SH, bar, B.upperArm, B.forearm, -1);
    var vx = -u[0] * 0.2 - 0.8, vy = -u[1] * 0.2 - 0.14, vl = Math.hypot(vx, vy);   // hlava u lavice, brada pritazena
    var head = [SH[0] + vx / vl * (B.neck + B.headR), SH[1] + vy / vl * (B.neck + B.headR)];
    return { hip: hip, shoulder: SH, head: head, headRot: -32,
             elbowN: arm.mid, wristN: arm.end, kneeN: kN, ankleN: ANK, toeN: TOE,
             elbowF: arm.mid, wristF: arm.end, kneeF: kF, ankleF: ANK_F, toeF: TOE_F,
             bar: arm.end };
  }

  F.register('hipthrust', {
    title: 'Hip thrust s činkou',
    view: 'side', facing: 1, zoom: 1.6, glowTop: true,         // glowTop: zare "presvita" pres kotouc
    tempo: { up: 0.9, hold: 0.4, down: 1.5, pause: 0.5 },
    phases: { up: 'Zvedni boky ⬆', hold: 'Stiskni hýždě', down: 'Pomalu dolů ⬇', pause: '' },
    solve: solve,
    back: function (ctx, J) {
      var gap = FLOOR - (J.bar[1] + PLATE_R);
      F.gear.shadow(ctx, J.bar[0] + 2, FLOOR + 0.5, 24, clamp(0.45 * (1 - gap / 65), 0, 0.45), 3.4);
      F.gear.bench(ctx, BENCH.x, BENCH.y, BENCH.w, BENCH.h, { legs: true });
    },
    front: function (ctx, J) { F.gear.plateEnd(ctx, J.bar[0], J.bar[1], PLATE_R); },
    highlight: function (t, info) {
      var act = clamp(Math.pow(t, 1.7) * 0.9 + (info ? info.squeeze : 0) * 0.1, 0, 1);
      return { glutes: act, hamstrings: act * 0.6 };
    }
  });
})();
