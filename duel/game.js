// Дуэль магов: сложение и вычитание дробей с разными знаменателями
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let W, H, DPR, groundY;

const gcd = (a, b) => b ? gcd(b, a % b) : a;
const lcm = (a, b) => a / gcd(a, b) * b;
const simp = ([n, d]) => { const g = gcd(n, d); return [n / g, d / g]; };
const add = (a, b) => simp([a[0] * b[1] + b[0] * a[1], a[1] * b[1]]);
const eq = (a, b) => a[0] * b[1] === b[0] * a[1];
const lt = (a, b) => a[0] * b[1] < b[0] * a[1];
const frHTML = f => `<span class="fr"><i>${f[0]}</i><i>${f[1]}</i></span>`;
const fs = f => f[0] + '/' + f[1];
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const POOL = [];
for (const d of [2, 3, 4, 5, 6, 8, 10, 12]) for (let n = 1; n < d; n++) if (gcd(n, d) === 1) POOL.push([n, d]);
const GLYPHS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

const ROUNDS = 10;
// раунды 1–6: две руны дают щит; 7–10: одна руна уже ударила, найди вторую
function level(r) {
  if (r < 2) return { sub: false, max: 12, nested: true };
  if (r < 4) return { sub: false, max: 12, nested: false };
  if (r < 6) return { sub: false, max: 24, nested: false };
  if (r < 8) return { sub: true, max: 12, nested: false };
  return { sub: true, max: 24, nested: false };
}

function makeRound(r) {
  const L = level(r);
  for (let tries = 0; tries < 5000; tries++) {
    const A = rnd(POOL), B = rnd(POOL);
    if (eq(A, B) || A[1] === B[1]) continue;
    const l = lcm(A[1], B[1]);
    if (l > L.max) continue;
    if (L.nested && !(A[1] % B[1] === 0 || B[1] % A[1] === 0)) continue;
    if (!L.nested && r >= 2 && (A[1] % B[1] === 0 || B[1] % A[1] === 0) && Math.random() < .7) continue;
    const T = add(A, B);
    if (!lt(T, [1, 1])) continue;
    const near = POOL.filter(f => !eq(f, A) && !eq(f, B) && !eq(f, T) && lcm(f[1], T[1]) <= 24);
    if (!L.sub) {
      const hand = [A, B];
      // ловушка: складывают числители и знаменатели отдельно
      const trap = [];
      for (const x of near) for (const y of near) if (!eq(x, y) && eq(simp([x[0] + y[0], x[1] + y[1]]), T) && !eq(add(x, y), T)) trap.push([x, y]);
      if (trap.length && Math.random() < .8) hand.push(...rnd(trap));
      while (hand.length < 5) { const f = rnd(near); if (!hand.some(h => eq(h, f))) hand.push(f); }
      let ok = 0;
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (eq(add(hand[i], hand[j]), T)) ok++;
      if (ok !== 1) continue;
      return { sub: false, T, A, B, hand: shuffle(hand) };
    } else {
      const hand = [B];
      const td = [T[0] * A[1] - A[0] * T[1], T[1] - A[1]];
      if (td[0] > 0 && td[1] > 0 && td[0] < td[1]) { const t = simp(td); if (!eq(t, B) && POOL.some(p => eq(p, t))) hand.push(t); }
      while (hand.length < 4) { const f = rnd(near); if (!hand.some(h => eq(h, f))) hand.push(f); }
      if (hand.filter(h => eq(add(A, h), T)).length !== 1) continue;
      return { sub: true, T, A, B, hand: shuffle(hand) };
    }
  }
  throw new Error('round gen');
}

// ---------- состояние ----------
let round = 0, lives = 3, enemyHP = ROUNDS, cur = null, sel = [], busy = false, solved = false;
let shieldBreak = 0, shake = 0, t0 = performance.now();
const parts = [], beams = [];

function lives$() { $('lives').textContent = '❤'.repeat(lives) + '♡'.repeat(3 - lives); }
function hud() {
  lives$();
  $('round').innerHTML = `ЩИТ ${Math.min(round + 1, ROUNDS)} / ${ROUNDS}<b>${cur && cur.sub ? 'Добей щит' : round < 4 ? 'Ученик' : 'Мастер'}</b>`;
  $('ehp').firstElementChild.style.width = (enemyHP / ROUNDS * 100) + '%';
}

function startRound() {
  cur = makeRound(round); sel = []; solved = false; shieldBreak = 0;
  $('next').hidden = true; $('cast').hidden = false; $('hint').hidden = false;
  $('task').innerHTML = cur.sub
    ? `Твоя руна ${frHTML(cur.A)} уже ударила. Какая руна снимет остаток щита <b>${fs(cur.T)}</b>?`
    : `Выбери <b>две</b> руны, которые вместе дают ровно <b>${fs(cur.T)}</b>`;
  $('task').innerHTML = $('task').innerHTML.replace(/<span class="fr"><i>(\d+)<\/i><i>(\d+)<\/i><\/span>/, '<b>$1/$2</b>');
  $('eq').innerHTML = '';
  const box = $('cards'); box.innerHTML = '';
  cur.hand.forEach((f, i) => {
    const b = document.createElement('button');
    b.className = 'card'; b.type = 'button';
    b.innerHTML = `<span class="g">${GLYPHS[(f[0] * 7 + f[1] * 3) % GLYPHS.length]}</span>${frHTML(f)}`;
    b.onclick = () => pick(i);
    box.appendChild(b);
  });
  drawBar(); hud();
}

function need() { return cur.sub ? 1 : 2; }
function pick(i) {
  if (busy || solved) return;
  const k = sel.indexOf(i);
  if (k >= 0) sel.splice(k, 1); else { if (sel.length >= need()) sel.shift(); sel.push(i); }
  [...$('cards').children].forEach((c, j) => { c.classList.toggle('sel', sel.includes(j)); c.classList.toggle('s1', sel[0] === j); });
  $('cast').disabled = sel.length !== need();
  drawBar();
}

// полоска маны: все дроби режутся на одинаковые куски (общий знаменатель)
function parts$() { return cur.sub ? [cur.A, ...sel.map(i => cur.hand[i])] : sel.map(i => cur.hand[i]); }
function drawBar(showSlices) {
  const ps = parts$();
  let L = cur.T[1];
  ps.forEach(p => L = lcm(L, p[1]));
  if (L > 30) L = 30;
  const bar = $('bar');
  bar.querySelectorAll('.s').forEach(s => s.remove());
  const cls = cur.sub ? ['c', 'b'] : ['a', 'b'];
  const seg = []; ps.forEach((p, k) => { for (let j = 0; j < p[0] * L / p[1]; j++) seg.push(cls[k]); });
  for (let j = 0; j < L; j++) {
    const s = document.createElement('div'); s.className = 's' + (seg[j] ? ' ' + seg[j] : '');
    bar.insertBefore(s, $('mark'));
  }
  const tl = cur.T[0] / cur.T[1];
  $('mark').style.left = (tl * 100) + '%';
  $('mark').firstElementChild.textContent = 'щит ' + fs(cur.T);
  if (showSlices) $('eq').innerHTML = `Режем всё на <b>${L}</b> равных кусков: щит = <b>${cur.T[0] * L / cur.T[1]}/${L}</b>`;
}

function explain(ps, ok) {
  let L = cur.T[1]; ps.forEach(p => L = lcm(L, p[1]));
  const conv = ps.map(p => `${p[0] * L / p[1]}/${L}`);
  const s = ps.reduce((a, p) => a + p[0] * L / p[1], 0);
  const tl = cur.T[0] * L / cur.T[1];
  let txt = `${ps.map(fs).join(' + ')} = ${conv.join(' + ')} = <b>${s}/${L}</b>`;
  txt += ok ? ` = <b>${fs(cur.T)}</b> ✔` : `, а щит <b>${tl}/${L}</b> — ${s > tl ? 'перебор!' : 'недобор!'}`;
  return txt;
}

function wandTip(who) { return who === 'p' ? [W * .2 + 34, groundY - 118] : [W * .8 - 34, groundY - 118]; }
function shieldPos() { return [W * .66, groundY - Math.min(150, H * .17)]; }

function cast() {
  if (busy || sel.length !== need()) return;
  busy = true;
  const ps = parts$();
  const sum = ps.reduce((a, p) => add(a, p), [0, 1]);
  const ok = eq(sum, cur.T);
  $('eq').innerHTML = explain(ps, ok);
  const [sx, sy] = shieldPos(), [px, py] = wandTip('p');
  beams.push({ x1: px, y1: py, x2: sx, y2: sy, t: 0, col: ok ? '#ffd76a' : '#9fb4ff' });
  setTimeout(() => {
    if (ok) {
      shieldBreak = 1; shake = 14; burst(sx, sy, 90, ['#ffd76a', '#fff3c0', '#b79cff']);
      enemyHP--; solved = true;
      [...$('cards').children].forEach(c => c.disabled = true);
      $('cast').hidden = true; $('hint').hidden = true;
      if (round + 1 >= ROUNDS) setTimeout(win, 1300); else $('next').hidden = false;
    } else {
      burst(sx, sy, 30, ['#9fb4ff', '#ffffff']);
      const [ex, ey] = wandTip('e'), [qx, qy] = [W * .2, groundY - 70];
      setTimeout(() => {
        beams.push({ x1: ex, y1: ey, x2: qx, y2: qy, t: 0, col: '#4dff88' });
        setTimeout(() => {
          burst(qx, qy, 50, ['#4dff88', '#c6ffd6']); shake = 10; lives--;
          lives$();
          if (lives <= 0) setTimeout(lose, 900);
          else { sel = []; [...$('cards').children].forEach(c => c.classList.remove('sel', 's1')); $('cast').disabled = true; busy = false; }
        }, 380);
      }, 450);
      hud();
      return;
    }
    hud(); busy = false;
  }, 420);
}

function burst(x, y, n, cols) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 6;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 1, col: rnd(cols), r: 1.5 + Math.random() * 3.5 });
  }
}

function overlay(h1, html, btn, fn) {
  $('ovb').innerHTML = `<h1>${h1}</h1>${html}<button id="ob" type="button">${btn}</button>`;
  $('ov').hidden = false; $('ob').onclick = () => { $('ov').hidden = true; fn(); };
}
function win() {
  const stars = '★'.repeat(lives) + '☆'.repeat(3 - lives);
  overlay('ПОБЕДА!', `<p style="font-size:40px;color:#ffd76a">${stars}</p><p>Тёмный маг повержен. Ты пробил все ${ROUNDS} щитов.</p><p>Главное заклинание: <b>сначала общий знаменатель</b>.</p>`, 'Новая дуэль', reset);
}
function lose() {
  overlay('ЩИТ УСТОЯЛ', `<p>Жизни кончились на щите ${round + 1}.</p><p>Подсказка: переведи все руны в одинаковые куски, потом складывай числители.</p>`, 'Ещё раз', reset);
}
function reset() { round = 0; lives = 3; enemyHP = ROUNDS; busy = false; $('panel').hidden = false; startRound(); }

$('cast').onclick = cast;
$('hint').onclick = () => drawBar(true);
$('next').onclick = () => { round++; startRound(); };
$('start').onclick = () => { $('ov').hidden = true; reset(); };

// ---------- сцена ----------
let stars = [], candles = [], castle = [], windows = [];
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const panelH = Math.min(300, H * .46);
  groundY = Math.max(H * .42, H - panelH - 20);
  stars = Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: Math.random() * groundY * .8, r: Math.random() * 1.4 + .3, p: Math.random() * 6 }));
  candles = Array.from({ length: 16 }, () => ({ x: Math.random() * W, y: 60 + Math.random() * (groundY * .45), p: Math.random() * 6, s: .7 + Math.random() * .5 }));
  // замок на горизонте
  castle = []; windows = [];
  const hz = groundY - 40;
  let x = -20;
  while (x < W + 20) {
    const w = 30 + Math.random() * 60, h = 40 + Math.random() * 130, tower = Math.random() < .45;
    castle.push({ x, w, h, tower, roof: tower ? 25 + Math.random() * 45 : 0 });
    for (let k = 0; k < 3; k++) if (Math.random() < .55) windows.push({ x: x + 6 + Math.random() * (w - 12), y: hz - h + 12 + Math.random() * (h - 24), p: Math.random() * 6 });
    x += w - 4;
  }
}
addEventListener('resize', resize); resize();

function robe(x, y, main, trim, dir, t) {
  const sway = Math.sin(t * 1.6) * 3;
  ctx.save(); ctx.translate(x, y);
  // тень
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(0, 4, 46, 9, 0, 0, Math.PI * 2); ctx.fill();
  // мантия
  const g = ctx.createLinearGradient(0, -150, 0, 0); g.addColorStop(0, main[0]); g.addColorStop(1, main[1]);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-14, -120); ctx.quadraticCurveTo(-30, -60, -42 + sway, 0); ctx.lineTo(42 + sway, 0); ctx.quadraticCurveTo(30, -60, 14, -120); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = trim; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-42 + sway, 0); ctx.lineTo(42 + sway, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -118); ctx.lineTo(sway * .6, -2); ctx.stroke();
  // капюшон
  ctx.fillStyle = main[0];
  ctx.beginPath(); ctx.moveTo(-22, -112); ctx.quadraticCurveTo(-24, -160, 0, -170); ctx.quadraticCurveTo(24, -160, 22, -112); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#05030c'; ctx.beginPath(); ctx.ellipse(dir * 3, -138, 12, 16, 0, 0, Math.PI * 2); ctx.fill();
  // рука с палочкой
  ctx.strokeStyle = main[0]; ctx.lineWidth = 11; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(dir * 12, -100); ctx.lineTo(dir * 30, -110); ctx.stroke();
  ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(dir * 28, -110); ctx.lineTo(dir * 36, -120); ctx.stroke();
  ctx.restore();
}

function glow(x, y, r, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function frame(now) {
  const t = (now - t0) / 1000;
  ctx.save();
  if (shake > 0) { ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake *= .88; if (shake < .4) shake = 0; }
  // небо
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, '#06041a'); sky.addColorStop(.55, '#17104a'); sky.addColorStop(1, '#3a2266');
  ctx.fillStyle = sky; ctx.fillRect(-20, -20, W + 40, groundY + 20);
  for (const s of stars) { ctx.globalAlpha = .45 + .55 * Math.abs(Math.sin(t * 1.3 + s.p)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.r, s.r); }
  ctx.globalAlpha = 1;
  // луна
  const mx = W * .82, my = Math.max(70, groundY * .22);
  glow(mx, my, 150, 'rgba(190,200,255,A)', .28);
  ctx.fillStyle = '#eef0ff'; ctx.beginPath(); ctx.arc(mx, my, 38, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(160,165,210,.35)'; [[-12, -8, 8], [10, 6, 6], [-4, 14, 5]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(mx + a, my + b, r, 0, Math.PI * 2); ctx.fill(); });
  // замок
  const hz = groundY - 40;
  ctx.fillStyle = '#0b0720';
  for (const c of castle) {
    ctx.fillRect(c.x, hz - c.h, c.w, c.h + 41);
    if (c.tower) { ctx.beginPath(); ctx.moveTo(c.x - 4, hz - c.h); ctx.lineTo(c.x + c.w / 2, hz - c.h - c.roof); ctx.lineTo(c.x + c.w + 4, hz - c.h); ctx.fill(); }
    else for (let k = 0; k < c.w; k += 10) ctx.fillRect(c.x + k, hz - c.h - 7, 6, 7);
  }
  for (const w of windows) { ctx.fillStyle = `rgba(255,${190 + 30 * Math.sin(t * 3 + w.p) | 0},90,${.65 + .3 * Math.sin(t * 2 + w.p)})`; ctx.fillRect(w.x, w.y, 4, 7); }
  // туман
  for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(160,140,230,.07)'; ctx.beginPath(); ctx.ellipse((t * 18 * (i + 1) + i * 400) % (W + 600) - 300, hz + 10 - i * 8, 320, 30, 0, 0, Math.PI * 2); ctx.fill(); }
  // пол
  const fl = ctx.createLinearGradient(0, groundY - 40, 0, H);
  fl.addColorStop(0, '#2a2140'); fl.addColorStop(1, '#0d0a1c');
  ctx.fillStyle = fl; ctx.fillRect(-20, groundY - 40, W + 40, H);
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
  for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 40, groundY - 40); ctx.lineTo(W / 2 + i * 160, H); ctx.stroke(); }
  for (let k = 0; k < 8; k++) { const y = groundY - 40 + Math.pow(k / 8, 1.8) * (H - groundY + 40); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // свечи
  for (const c of candles) {
    const y = c.y + Math.sin(t * 1.2 + c.p) * 6;
    glow(c.x, y - 10 * c.s, 26 * c.s, 'rgba(255,200,110,A)', .35);
    ctx.fillStyle = '#efe4c8'; ctx.fillRect(c.x - 3 * c.s, y - 4 * c.s, 6 * c.s, 22 * c.s);
    ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.ellipse(c.x, y - 9 * c.s + Math.sin(t * 9 + c.p), 2.6 * c.s, 5.5 * c.s, 0, 0, Math.PI * 2); ctx.fill();
  }
  // маги
  robe(W * .2, groundY, ['#5a1220', '#2a0610'], '#d9b25a', 1, t);
  robe(W * .8, groundY, ['#10241a', '#04100a'], '#3ddc84', -1, t + 1.3);
  ctx.fillStyle = '#5dff9a'; [[-5], [5]].forEach(([d]) => { ctx.beginPath(); ctx.arc(W * .8 - 3 + d, groundY - 140, 2.2, 0, Math.PI * 2); ctx.fill(); });
  const [pxw, pyw] = wandTip('p'), [exw, eyw] = wandTip('e');
  glow(pxw, pyw, 16, 'rgba(255,220,130,A)', .9); glow(exw, eyw, 16, 'rgba(90,255,150,A)', .9);
  // щит
  if (cur) drawShield(t);
  // лучи
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i]; b.t += .07;
    const k = Math.min(1, b.t), x = b.x1 + (b.x2 - b.x1) * k, y = b.y1 + (b.y2 - b.y1) * k - Math.sin(k * Math.PI) * 40;
    ctx.strokeStyle = b.col; ctx.lineWidth = 4; ctx.shadowColor = b.col; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.quadraticCurveTo((b.x1 + x) / 2, Math.min(b.y1, y) - 30 * k, x, y); ctx.stroke();
    ctx.shadowBlur = 0;
    glow(x, y, 22, 'rgba(255,255,255,A)', .9);
    for (let j = 0; j < 2; j++) parts.push({ x, y, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2, life: .6, col: b.col, r: 2 });
    if (b.t > 1.4) beams.splice(i, 1);
  }
  // частицы
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += .08; p.life -= .018;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    ctx.globalAlpha = p.life; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  requestAnimationFrame(frame);
}

function drawShield(t) {
  const [x, y] = shieldPos();
  const R = Math.min(78, H * .1, W * .11);
  if (shieldBreak < 0) return;
  if (shieldBreak > 0) { shieldBreak -= .02; if (shieldBreak <= 0) { shieldBreak = -1; return; } ctx.globalAlpha = shieldBreak; }
  const sc = shieldBreak > 0 ? 1 + (1 - shieldBreak) * .6 : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  glow(0, 0, R * 1.9, 'rgba(140,110,255,A)', .35);
  const n = cur.T[1], f = cur.T[0];
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i / n * Math.PI * 2, a1 = a0 + Math.PI * 2 / n;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a1); ctx.closePath();
    ctx.fillStyle = i < f ? `rgba(150,120,255,${.55 + .15 * Math.sin(t * 3 + i)})` : 'rgba(40,30,90,.35)';
    ctx.fill(); ctx.strokeStyle = 'rgba(220,210,255,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.rotate(t * .4);
  ctx.strokeStyle = 'rgba(230,220,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, R + 10, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e6dcff'; ctx.font = '700 14px Cinzel, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.save(); ctx.rotate(a); ctx.fillText(GLYPHS[(i * 5) % GLYPHS.length], 0, -R - 22); ctx.restore(); }
  ctx.restore();
  // сила щита
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = '#8f6bff'; ctx.shadowBlur = 12;
  ctx.font = '900 30px Cinzel, serif';
  ctx.fillText(cur.T[0], x, y - 18); ctx.fillRect(x - 20, y - 1.5, 40, 3); ctx.fillText(cur.T[1], x, y + 20);
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}

hud(); requestAnimationFrame(frame);
