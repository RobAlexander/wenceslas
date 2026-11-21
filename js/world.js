// Game logic for a single night. No drawing, no DOM.

import { W, H, HUD_H, CFG, nightParams } from './config.js';
import { FOOD_KINDS } from './sprites.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
const onScreen = (e, m = 0) => e.x > -m && e.x < W + m && e.y > HUD_H - m && e.y < H + m;

// Distance from point to obstacle surface, plus the outward normal.
function obsQuery(o, x, y) {
  if (o.kind === 'wall') {
    const hx = o.w / 2, hy = o.h / 2;
    const cx = clamp(x, o.x - hx, o.x + hx);
    const cy = clamp(y, o.y - hy, o.y + hy);
    const dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d === 0) {
      const px = hx - Math.abs(x - o.x), py = hy - Math.abs(y - o.y);
      if (px < py) return { d: -px, nx: Math.sign(x - o.x) || 1, ny: 0 };
      return { d: -py, nx: 0, ny: Math.sign(y - o.y) || 1 };
    }
    return { d, nx: dx / d, ny: dy / d };
  }
  const dx = x - o.x, dy = y - o.y;
  const l = Math.hypot(dx, dy) || 0.001;
  return { d: l - o.r, nx: dx / l, ny: dy / l };
}

let nextId = 1;

export class World {
  // events: array that receives event names (for sound and tests)
  constructor({ night, hard, rng, events, kingHp }) {
    this.night = night;
    this.hard = hard;
    this.rng = rng;
    this.events = events;
    this.p = nightParams(night);
    this.speedMul = hard ? CFG.hardSpeedMul : 1;

    this.time = 0;
    this.delivered = 0;
    this.kills = 0;
    this.done = false;
    this.dead = false;

    this.obstacles = [];
    this.pages = [];   // every page, wandering or following
    this.line = [];    // following pages, front first
    this.robbers = [];
    this.foods = [];
    this.particles = [];
    this.texts = [];

    this.king = {
      id: nextId++, x: W / 2, y: H / 2 + 30, r: 4, hp: kingHp ?? CFG.kingMaxHp,
      aim: 0, swingT: 0, swingAngle: 0, cd: 0, inv: 0, walkT: 0, moving: false,
      kbx: 0, kby: 0, face: 1, hit: new Set(),
    };
    this.trail = [{ x: this.king.x, y: this.king.y }];

    this.placeLevel();

    this.pageTimer = 1.5;
    this.foodTimer = 1;
    this.robberTimer = this.p.firstRobber;
    this.deliverTimer = 0;

    for (let i = 0; i < 2; i++) this.spawnFood();
    this.spawnPage(true);
  }

  emit(name) { this.events.push(name); }

  // ---------- level layout ----------

  placeLevel() {
    const { rng, king } = this;
    // The old man: somewhere well away from the starting spot.
    for (let i = 0; i < 200; i++) {
      const x = rng.range(40, W - 40), y = rng.range(HUD_H + 30, H - 24);
      if (Math.hypot(x - king.x, y - king.y) > 170 || i === 199) {
        this.oldMan = { x, y, r: 5, bob: 0 };
        break;
      }
    }
    const want = [];
    const nT = rng.int(3, 5), nR = rng.int(2, 3), nW = rng.int(1, 2);
    for (let i = 0; i < nT; i++) want.push('tree');
    for (let i = 0; i < nR; i++) want.push('rock');
    for (let i = 0; i < nW; i++) want.push('wall');
    for (const kind of want) {
      for (let tries = 0; tries < 60; tries++) {
        const o = { kind, x: rng.range(30, W - 30), y: rng.range(HUD_H + 34, H - 18) };
        if (kind === 'tree') { o.r = 5; o.size = 12; o.variant = rng.int(0, 1); }
        else if (kind === 'rock') { o.r = 7; o.size = 9; }
        else {
          const horiz = rng() < 0.6;
          o.w = horiz ? rng.int(4, 7) * 8 : 8;
          o.h = horiz ? 6 : rng.int(4, 6) * 8;
          o.size = Math.max(o.w, o.h) / 2;
        }
        if (this.layoutFree(o)) { this.obstacles.push(o); break; }
      }
    }
  }

  layoutFree(o) {
    if (Math.hypot(o.x - this.king.x, o.y - this.king.y) < o.size + 40) return false;
    if (Math.hypot(o.x - this.oldMan.x, o.y - this.oldMan.y) < o.size + 34) return false;
    for (const p of this.obstacles) {
      if (Math.hypot(o.x - p.x, o.y - p.y) < o.size + p.size + 26) return false;
    }
    return true;
  }

  freeSpot(margin = 20, clearance = 10) {
    for (let i = 0; i < 80; i++) {
      const x = this.rng.range(margin, W - margin), y = this.rng.range(HUD_H + margin, H - margin);
      if (this.obstacles.every((o) => obsQuery(o, x, y).d > clearance)) return { x, y };
    }
    return { x: W / 2, y: H / 2 };
  }

  edgeSpawn() {
    const side = this.rng.int(0, 3), m = 12;
    if (side === 0) return { x: -m, y: this.rng.range(HUD_H + 20, H - 20) };
    if (side === 1) return { x: W + m, y: this.rng.range(HUD_H + 20, H - 20) };
    if (side === 2) return { x: this.rng.range(20, W - 20), y: HUD_H - m };
    return { x: this.rng.range(20, W - 20), y: H + m };
  }

  // ---------- spawning ----------

  spawnPage(nearby = false) {
    let pos;
    if (nearby) {
      const a = this.rng.range(0, TAU);
      pos = { x: this.king.x + Math.cos(a) * 60, y: clamp(this.king.y + Math.sin(a) * 40, HUD_H + 20, H - 20) };
    } else pos = this.edgeSpawn();
    const target = this.freeSpot(40);
    this.pages.push({
      id: nextId++, x: pos.x, y: pos.y, r: 4, hp: CFG.pageMaxHp, state: 'wander',
      target, wanderT: this.rng.range(2, 4), food: null, vx: 0, vy: 0, inv: 0, flash: 0,
      walkT: 0, face: 1, side: this.rng() < 0.5 ? 1 : -1, entered: nearby,
    });
  }

  spawnFood(at, kind, delay = 0) {
    const pos = at || this.freeSpot(24, 8);
    this.foods.push({
      id: nextId++, x: pos.x, y: pos.y, kind: kind || this.rng.pick(FOOD_KINDS),
      delay, pop: at ? 0 : 0.3, t: this.rng.range(0, TAU),
    });
  }

  spawnRobber() {
    let pos;
    for (let i = 0; i < 10; i++) {
      pos = this.edgeSpawn();
      if (dist(pos, this.king) > 140) break;
    }
    const hp = this.rng() < this.p.toughRobberChance ? 2 : 1;
    this.robbers.push({
      id: nextId++, x: pos.x, y: pos.y, r: 4, hp, maxHp: hp, target: null, retarget: 0,
      windup: 0, atkCd: 0.5, stun: 0, flash: 0, kbx: 0, kby: 0, walkT: 0, face: 1,
      side: this.rng() < 0.5 ? 1 : -1,
    });
  }

  // ---------- update ----------

  // inp: { mx, my } move vector (length <= 1), { ax, ay } aim point, swing (bool)
  update(dt, inp) {
    this.updateFx(dt);
    if (this.done || this.dead) return;
    this.time += dt;
    this.updateKing(dt, inp);
    this.updateTrail();
    this.updatePages(dt);
    this.updateRobbers(dt);
    this.updateFood(dt);
    this.updateDelivery(dt);
    this.updateSpawning(dt);
  }

  updateKing(dt, inp) {
    const k = this.king;
    const ml = Math.hypot(inp.mx, inp.my);
    const mx = ml > 1 ? inp.mx / ml : inp.mx, my = ml > 1 ? inp.my / ml : inp.my;
    k.x += (mx * CFG.kingSpeed + k.kbx) * dt;
    k.y += (my * CFG.kingSpeed + k.kby) * dt;
    const decay = Math.exp(-12 * dt);
    k.kbx *= decay; k.kby *= decay;
    k.moving = ml > 0.1;
    if (k.moving) k.walkT += dt;
    k.x = clamp(k.x, 6, W - 6);
    k.y = clamp(k.y, HUD_H + 14, H - 3);
    this.collide(k);

    if (inp.aimAngle != null) k.aim = inp.aimAngle;
    else if (inp.ax != null) k.aim = Math.atan2(inp.ay - (k.y - 8), inp.ax - k.x);
    k.face = Math.cos(k.aim) < 0 ? -1 : 1;

    k.cd -= dt;
    k.inv -= dt;
    if (inp.swing && k.cd <= 0) {
      if (inp.autoAim) this.snapAim();
      k.swingT = CFG.swingDuration;
      k.cd = CFG.swingCooldown;
      k.swingAngle = k.aim;
      k.hit = new Set();
      this.emit('swing');
    }
    if (k.swingT > 0) {
      k.swingT -= dt;
      this.swordHits();
    }
  }

  // Turn toward the nearest robber in range. Used by quick taps on touch screens;
  // with nothing in range the king swings the way he's already facing.
  snapAim() {
    const k = this.king;
    const py = k.y - 8;
    let best = null, bd = CFG.autoAimRange;
    for (const rob of this.robbers) {
      const d = Math.hypot(rob.x - k.x, rob.y - 6 - py);
      if (d < bd) { bd = d; best = rob; }
    }
    if (!best) return;
    k.aim = Math.atan2(best.y - 6 - py, best.x - k.x);
    k.face = Math.cos(k.aim) < 0 ? -1 : 1;
  }

  swordHits() {
    const k = this.king;
    const px = k.x, py = k.y - 8;
    for (const rob of this.robbers) {
      if (k.hit.has(rob.id)) continue;
      const dx = rob.x - px, dy = rob.y - 6 - py;
      const d = Math.hypot(dx, dy);
      if (d > CFG.swingRange + rob.r + 2) continue;
      const slack = d > 0 ? Math.atan2(rob.r + 2, d) : Math.PI;
      if (Math.abs(angDiff(Math.atan2(dy, dx), k.swingAngle)) > CFG.swingHalfArc + slack) continue;
      k.hit.add(rob.id);
      this.hitRobber(rob, dx / (d || 1), dy / (d || 1));
    }
  }

  hitRobber(rob, nx, ny) {
    rob.hp -= 1;
    rob.flash = 0.12;
    rob.stun = 0.3;
    rob.windup = 0;
    rob.kbx = nx * CFG.swingKnockback;
    rob.kby = ny * CFG.swingKnockback;
    this.emit('hit');
    if (rob.hp <= 0) {
      this.robbers.splice(this.robbers.indexOf(rob), 1);
      this.kills++;
      this.emit('kill');
      this.puff(rob.x, rob.y - 6, ['#5d275d', '#f4f4f4', '#333c57'], 14);
      this.floatText(rob.x, rob.y - 16, '+' + CFG.pointsKill * this.pointsMul(), '#f4f4f4');
    } else {
      this.puff(rob.x, rob.y - 6, ['#f4f4f4'], 4);
    }
  }

  pointsMul() { return this.hard ? CFG.hardPointsMul : 1; }

  updateTrail() {
    const k = this.king, t = this.trail;
    if (Math.hypot(k.x - t[0].x, k.y - t[0].y) >= 3) t.unshift({ x: k.x, y: k.y });
    const maxPts = Math.ceil(((this.line.length + 2) * CFG.pageSpacing) / 3) + 8;
    if (t.length > maxPts) t.length = maxPts;
  }

  // Point a given distance back along the king's path.
  trailPoint(d) {
    let px = this.king.x, py = this.king.y, acc = 0;
    for (const t of this.trail) {
      const dx = t.x - px, dy = t.y - py, l = Math.hypot(dx, dy);
      if (l > 0 && acc + l >= d) {
        const f = (d - acc) / l;
        return { x: px + dx * f, y: py + dy * f };
      }
      acc += l; px = t.x; py = t.y;
    }
    return { x: px, y: py };
  }

  updatePages(dt) {
    const k = this.king;
    for (const pg of this.pages) {
      pg.inv -= dt;
      pg.flash -= dt;
      let tx, ty, speed;
      if (pg.state === 'wander') {
        pg.wanderT -= dt;
        if (pg.wanderT <= 0 || dist(pg, pg.target) < 4) {
          pg.target = this.freeSpot(30);
          pg.wanderT = this.rng.range(2.5, 5);
        }
        tx = pg.target.x; ty = pg.target.y; speed = CFG.pageWanderSpeed;
        if (dist(pg, k) < CFG.recruitRadius + k.r) {
          pg.state = 'follow';
          this.line.push(pg);
          this.emit('recruit');
          this.puff(pg.x, pg.y - 8, ['#ffcd75', '#f4f4f4'], 6);
        }
      } else {
        const idx = this.line.indexOf(pg);
        const tp = this.trailPoint((idx + 1) * CFG.pageSpacing);
        tx = tp.x; ty = tp.y;
        const d = Math.hypot(tx - pg.x, ty - pg.y);
        speed = Math.min(CFG.pageFollowSpeed * (d > 40 ? 1.5 : 1), d * 7);
      }
      const dx = tx - pg.x, dy = ty - pg.y, d = Math.hypot(dx, dy);
      let vx = 0, vy = 0;
      if (d > 0.5) {
        const s = this.steer(pg, dx / d, dy / d);
        vx = s.x * speed; vy = s.y * speed;
      }
      // soft, slightly lagging motion: this is what makes the line less rigid than Snake
      const soft = 1 - Math.exp(-10 * dt);
      pg.vx += (vx - pg.vx) * soft;
      pg.vy += (vy - pg.vy) * soft;
      pg.x += pg.vx * dt;
      pg.y += pg.vy * dt;
      const sp = Math.hypot(pg.vx, pg.vy);
      if (sp > 4) { pg.walkT += dt; if (Math.abs(pg.vx) > 2) pg.face = pg.vx < 0 ? -1 : 1; }
      if (!pg.entered && onScreen(pg, -8)) pg.entered = true;
      if (pg.entered) {
        pg.x = clamp(pg.x, 5, W - 5);
        pg.y = clamp(pg.y, HUD_H + 12, H - 3);
      }
    }
    this.separate(this.pages, 6);
    for (const pg of this.pages) this.collide(pg);
  }

  updateRobbers(dt) {
    const k = this.king;
    const decay = Math.exp(-10 * dt);
    for (const rob of [...this.robbers]) {
      rob.flash -= dt;
      rob.stun -= dt;
      rob.atkCd -= dt;
      rob.retarget -= dt;
      rob.x += rob.kbx * dt; rob.y += rob.kby * dt;
      rob.kbx *= decay; rob.kby *= decay;

      if (rob.retarget <= 0 || !this.alive(rob.target)) {
        rob.target = this.chooseTarget(rob);
        rob.retarget = 0.25;
      }
      const tg = rob.target;
      if (rob.stun > 0) continue;
      const d = dist(rob, tg);
      const reach = rob.r + tg.r + 4;
      if (rob.windup > 0) {
        rob.windup -= dt;
        if (rob.windup <= 0) {
          rob.atkCd = CFG.robberAttackCooldown;
          if (d <= reach + 5) this.damage(tg, rob);
        }
        continue;
      }
      if (d <= reach) {
        if (rob.atkCd <= 0) rob.windup = CFG.robberWindup;
        rob.face = tg.x < rob.x ? -1 : 1;
        continue;
      }
      const s = this.steer(rob, (tg.x - rob.x) / d, (tg.y - rob.y) / d);
      const sp = CFG.robberSpeed * this.speedMul;
      rob.x += s.x * sp * dt;
      rob.y += s.y * sp * dt;
      rob.walkT += dt;
      if (Math.abs(s.x) > 0.1) rob.face = s.x < 0 ? -1 : 1;
    }
    this.separate(this.robbers, 7);
    for (const rob of this.robbers) this.collide(rob);
  }

  alive(e) {
    return e && (e === this.king || this.pages.includes(e));
  }

  chooseTarget(rob) {
    const k = this.king;
    if (dist(rob, k) < CFG.robberAggroRadius) return k;
    let best = null, bd = Infinity;
    for (const pg of this.pages) {
      const d = dist(rob, pg);
      if (d < bd) { bd = d; best = pg; }
    }
    return best || k;
  }

  damage(target, from) {
    const nx = target.x - from.x, ny = target.y - from.y, l = Math.hypot(nx, ny) || 1;
    if (target === this.king) {
      const k = this.king;
      if (k.inv > 0) return;
      k.hp -= CFG.robberDamage;
      k.inv = CFG.kingInvuln;
      k.kbx = (nx / l) * 120; k.kby = (ny / l) * 120;
      this.emit('hurt');
      this.puff(k.x, k.y - 8, ['#b13e53', '#f4f4f4'], 6);
      if (k.hp <= 0) {
        k.hp = 0;
        this.dead = true;
        this.emit('gameover');
      }
      return;
    }
    const pg = target;
    if (pg.inv > 0) return;
    pg.hp -= CFG.robberDamage;
    pg.inv = CFG.pageInvuln;
    pg.flash = 0.12;
    pg.vx += (nx / l) * 80; pg.vy += (ny / l) * 80;
    if (pg.hp <= 0) this.killPage(pg);
    else this.emit('pageHurt');
  }

  killPage(pg) {
    this.pages.splice(this.pages.indexOf(pg), 1);
    const li = this.line.indexOf(pg);
    if (li >= 0) this.line.splice(li, 1);
    this.emit('pageDie');
    this.puff(pg.x, pg.y - 6, ['#38b764', '#f4f4f4', '#257179'], 12);
    if (pg.food) {
      this.spawnFood({ x: clamp(pg.x, 8, W - 8), y: clamp(pg.y, HUD_H + 10, H - 6) }, pg.food, CFG.dropPickupDelay);
      this.emit('foodDrop');
    }
  }

  updateFood(dt) {
    for (const f of [...this.foods]) {
      f.delay -= dt;
      f.pop -= dt;
      f.t += dt;
      if (f.delay > 0) continue;
      const empty = this.line.find((p) => !p.food);
      if (!empty) break;
      const near = [this.king, ...this.line].some((e) => dist(e, f) < CFG.pickupRadius);
      if (!near) continue;
      empty.food = f.kind;
      this.foods.splice(this.foods.indexOf(f), 1);
      this.emit('pickup');
      this.puff(f.x, f.y - 2, ['#ffcd75', '#f4f4f4'], 5);
    }
  }

  updateDelivery(dt) {
    const om = this.oldMan;
    om.bob += dt;
    if (dist(this.king, om) > CFG.deliverRadius) { this.deliverTimer = 0; return; }
    this.deliverTimer -= dt;
    if (this.deliverTimer > 0) return;
    const carrier = this.line.find((p) => p.food);
    if (!carrier) return;
    carrier.food = null;
    this.delivered++;
    this.deliverTimer = CFG.deliverInterval;
    this.emit('deliver');
    this.floatText(om.x, om.y - 22, '+' + CFG.pointsFood * this.pointsMul(), '#ffcd75');
    this.puff(om.x, om.y - 10, ['#ffcd75', '#f4f4f4'], 6);
    if (this.delivered >= this.p.foodTarget) {
      this.done = true;
      this.emit('nightComplete');
    }
  }

  updateSpawning(dt) {
    const p = this.p;
    this.pageTimer -= dt;
    const wandering = this.pages.filter((x) => x.state === 'wander').length;
    if (this.pageTimer <= 0) {
      if (wandering < p.maxWanderingPages) this.spawnPage();
      // spawn faster when you have nobody, so the player is never stuck
      this.pageTimer = (this.pages.length === 0 ? 1.2 : p.pageInterval) * this.rng.range(0.7, 1.3);
    }
    this.foodTimer -= dt;
    if (this.foodTimer <= 0) {
      if (this.foods.length < p.maxFood) this.spawnFood();
      this.foodTimer = p.foodInterval * this.rng.range(0.7, 1.3);
    }
    this.robberTimer -= dt;
    if (this.robberTimer <= 0) {
      if (this.robbers.length < p.maxRobbers) this.spawnRobber();
      this.robberTimer = p.robberInterval * this.rng.range(0.7, 1.3);
    }
  }

  // ---------- movement helpers ----------

  // Bend a desired direction around nearby obstacles.
  steer(e, dx, dy) {
    let ax = dx, ay = dy;
    for (const o of this.obstacles) {
      const q = obsQuery(o, e.x, e.y);
      const range = e.r + 16;
      if (q.d > range) continue;
      if (dx * -q.nx + dy * -q.ny <= 0) continue; // moving away from it
      const w = (1 - Math.max(0, q.d) / range) * 1.6;
      const tx = -q.ny, ty = q.nx;
      let s = tx * dx + ty * dy;
      s = Math.abs(s) < 0.05 ? e.side || 1 : Math.sign(s);
      ax += q.nx * w * 0.4 + tx * s * w;
      ay += q.ny * w * 0.4 + ty * s * w;
    }
    const l = Math.hypot(ax, ay) || 1;
    return { x: ax / l, y: ay / l };
  }

  collide(e) {
    for (const o of this.obstacles) {
      const q = obsQuery(o, e.x, e.y);
      if (q.d < e.r) {
        const push = e.r - q.d;
        e.x += q.nx * push;
        e.y += q.ny * push;
      }
    }
  }

  separate(list, minD) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d > 0 && d < minD) {
          const push = (minD - d) / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        }
      }
    }
  }

  // ---------- effects ----------

  puff(x, y, colors, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, TAU), s = this.rng.range(15, 60);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
        life: this.rng.range(0.3, 0.6), color: this.rng.pick(colors),
      });
    }
  }

  floatText(x, y, text, color) {
    this.texts.push({ x, y, text, color, life: 1 });
  }

  updateFx(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 60 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 14 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }
}
