// Native SLUS_204.86 owner callbacks. Addresses and gaps: analysis/SPECIAL_RECOVERY.md.
const f = Math.fround;
const signed = v => (v << 24) >> 24;
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const SPECIALS = freeze({
  ryu: {
    hadouken: { state: 0, callback: '001EAEB0', descriptor: '0044F260', words: [3,4096,0,0,4096,6144,2048,768], groundOnly: true },
    shoryuken: { state: 1, callback: '001EB130', descriptor: '0044F270', words: [3,4096,1,0,2048,4096,6144,768], groundOnly: true },
    tatsu: { state: 2, callback: '001EB4C0', descriptor: '0044F280', words: [3,4096,2,0,4096,5120,1024,96], groundOnly: true },
    airTatsu: { state: 3, callback: '001EB880', descriptor: '0044F290', words: [3,8192,3,0,4096,5120,1024,96], airOnly: true },
    airHadouken: { state: 4, callback: '001EBC40', descriptor: '0044F2A0', words: [3,8192,4,0,4096,6144,2048,768], airOnly: true },
  },
  cyclops: {
    opticBlast: { state: 0, callback: '00212390', descriptor: '00450A60', words: [3,0,0,0,4096,6144,2048,768] },
    geneSplice: { state: 3, callback: '00213330', descriptor: '00450A90', words: [3,4096,3,0,2048,4096,6144,768], groundOnly: true },
    cycloneKick: { state: 7, callback: '00213A50', descriptor: '00450A80', words: [3,4096,7,0,4096,5120,1024,96], groundOnly: true },
  },
});
export function createSpecial(fighter, key, strength = 0, { air = false } = {}) {
  const profile = SPECIALS[fighter]?.[key];
  if (!profile) throw new RangeError(`Unsupported special: ${fighter}/${key}`);
  if (strength !== 0 && strength !== 1) throw new RangeError('Native strength must be 0 or 1');
  if (air && profile.groundOnly) throw new RangeError('Air callback is not this ground callback');
  if (!air && profile.airOnly) throw new RangeError('Air callback requires airborne actor');
  return { fighter, key, strength, air, phase: 0, timer: 0, done: false, profile, control: { direction: 0, target: 0, active: 0, quota: 0 } };
}
const effect = (io, address, ...args) => io.effect?.(address, args);
const airFlag = (io, value) => io.airborne?.(value);
const select = (io, variant, group = 21) => io.select(group, variant);
const attack = (io, value) => io.setAttack(value);
const stop = m => { m.vx = m.vy = m.ax = m.ay = 0; };
const integrateX = m => { m.x = f(m.x + m.vx); m.vx = f(m.vx + m.ax); };
const integrateY = m => { m.y = f(m.y + m.vy); m.vy = f(m.vy + m.ay); };
const integrate = m => { integrateX(m); integrateY(m); };
const brake = m => { if (m.ax && f(m.ax * m.vx) > 0) m.ax = m.vx = 0; };
function finish(s, io, mode = 'ground') { s.done = true; s.control.active = 0; io.finish(mode); }
function land(io) { io.motion.y = io.motion.ground; airFlag(io, false); effect(io, '00183D50'); }
function setup(io, amount) { effect(io, '00185490'); effect(io, '00183D10'); effect(io, '0018C4B0', amount); return io.motion.face < 0 ? -1 : 1; }
function verticalDP(m) { const old = m.vy; integrateY(m); if (old > 0 && m.vy < 0) m.ay = f(-1.607142806); }
function dpCommand(s, io) {
  if (s.quota0 > 0 && s.quota1 > 0 && signed(io.get(0)) !== 0) {
    const id = io.consume(0), flags = io.hitFlags?.() ?? 0;
    if (flags) { const key = flags & 1 ? 'quota1' : 'quota0'; if (--s[key] === 0) return; }
    attack(io, id);
  }
}
function tatsuCommand(s, io) { if (signed(io.get(1)) > 0) { io.consume(1); attack(io, 57 + s.strength); } }
function updateAirHadouken(s, io) {
  const m = io.motion, n = s.strength, face = m.face < 0 ? -1 : 1;
  m.x = f(m.x - 10); m.y = f(m.y - 50);
  try {
    if (s.phase === 0) {
      effect(io, '00185490'); effect(io, '0018C4B0', 2); attack(io, 63 + n);
      m.vx = f(m.vx / 16); m.vy = f(m.vy / 8); m.ay = f(m.ay / 64); m.ax = 0; select(io, 14 + n); s.phase = 1;
    } else {
      integrate(m); if (m.y <= m.ground) m.y = m.ground;
      const wrapped = io.advance().jumped;
      if (s.phase === 1 && signed(io.get(1)) !== 0) {
        io.consume(1); s.phase = 2;
        io.spawn({ kind: 'hadouken', callback: '003458A0', sourceLaunch: '004B8314', nativeKind: 1,
          group: 21, variant: 16, impactVariant: 13, attackId: 63,
          x: f(m.x + face * 91), y: f(m.y + 141), vx: face * (n ? 7 : 5), vy: 0, ax: 0, ay: 0,
          face, marginX: 36, marginY: 36, expires: 'native-projected-bounds-or-hit' });
      } else if (s.phase === 2 && wrapped) { m.vy = m.ay = 0; finish(s, io, 'air'); }
    }
  } finally { m.x = f(m.x + 10); m.y = f(m.y + 50); }
}

export function updateSpecial(s, io) {
  if (s.done) return;
  const m = io.motion, n = s.strength;
  let face = m.face < 0 ? -1 : 1;
  switch (s.key) {
    case 'airHadouken': updateAirHadouken(s, io); break;
    case 'airTatsu':
      if (s.phase === 0) {
        effect(io, '0018C4B0', 5); attack(io, 60 + n);
        const speed = f(n ? 4.166666507720947 : 2.5), inputFace = io.inputFacing == null ? face : io.inputFacing === 0 ? -1 : io.inputFacing;
        m.vx = f(m.vx + (m.vx < 0 ? -speed : m.vx > 0 ? speed : inputFace < 0 ? -speed : speed));
        m.ax = 0; s.timer = n << 1; select(io, 8); s.phase = 1;
      } else if (s.phase === 1 || s.phase === 2) {
        integrate(m);
        if (m.y <= m.ground) { s.phase = 3; land(io); select(io, 3, 1); }
        else if (s.phase === 2) { if (io.advance().jumped) finish(s, io, 'air'); }
        else {
          if (signed(io.get(1)) < 0) { io.consume(1); if (--s.timer < 0) { s.phase = 2; select(io, 10); return; } }
          io.advance(); if (signed(io.get(1)) > 0) { io.consume(1); attack(io, 60 + n); }
        }
      } else if (io.advance().jumped) finish(s, io);
      break;
    case 'hadouken':
      if (s.phase === 0) { setup(io, 5); m.y = m.ground; airFlag(io, false); attack(io, 48 + n); select(io, n); s.phase = 1; }
      else if (io.advance().jumped) finish(s, io);
      else if (signed(io.get(1)) !== 0) {
        io.consume(1);
        io.spawn({ kind: 'hadouken', callback: '003458A0', sourceLaunch: '004B8300', group: 21, variant: 11 + n, impactVariant: 13,
          attackId: 48, x: f(m.x + face * 96), y: f(m.y + 113), vx: face * (n ? 9 : 6), vy: 0, ax: 0, ay: 0,
          face, marginX: 36, marginY: 36, expires: 'native-projected-bounds-or-hit', ownerSlot: '02BA' });
      }
      break;
    case 'shoryuken':
      if (s.phase === 0) {
        face = setup(io, 10); m.y = m.ground; airFlag(io, false);
        m.vx = f(face * (n ? 16.66666603088379 : 10)); m.ax = f(-face * 0.7291666269302368);
        m.vy = f(n ? 34.28571319580078 : 17.14285659790039); m.ay = f(-1.0714285373687744);
        s.quota0 = s.quota1 = 1; attack(io, 51 + n); select(io, 2 + n); s.phase = 1;
      } else if (s.phase === 1) {
        io.advance(); dpCommand(s, io); if (signed(io.get(1)) === 0) { s.phase = 2; airFlag(io, true); }
      } else if (s.phase === 2) {
        verticalDP(m); const old = m.vx; integrateX(m); if (f(old * m.vx) < 0) s.phase = 3; io.advance();
      } else if (s.phase === 3) {
        verticalDP(m); if (m.y > m.ground) { if (signed(io.get(1)) === 0) io.advance(); }
        else { s.phase = 4; land(io); }
      } else if (io.advance().jumped) finish(s, io);
      break;
    case 'tatsu':
      if (s.phase === 0) {
        face = setup(io, 10); m.y = m.ground; m.vy = f(8.571428298950195); m.ay = f(-0.8035714030265808);
        m.vx = f(face * (n ? 6.25 : 4.166666507720947)); m.ax = 0; airFlag(io, true);
        attack(io, 57 + n); select(io, 4); s.phase = 1;
      } else if (s.phase === 1) {
        const old = m.vy; integrate(m);
        if (f(old * m.vy) > 0) io.advance(); else { s.phase = 2; s.timer = n << 1; select(io, 6); tatsuCommand(s, io); }
      } else if (s.phase === 2) {
        if (signed(io.get(1)) < 0) { io.consume(1); if (--s.timer < 0) { s.phase = 3; select(io, 5); return; } }
        integrateX(m); io.advance(); tatsuCommand(s, io);
      } else if (s.phase === 3) {
        integrate(m); if (m.y <= m.ground) { s.phase = 4; land(io); select(io, 7); } else io.advance();
      } else if (io.advance().jumped) finish(s, io);
      break;
    case 'opticBlast':
      if (s.phase === 0) {
        // 00212410 leaves scratch6/7 intact. Preserve the actor-owned pulse
        // state across entries; newly created preview actors have zero scratch.
        s.pulseTimer=m.opticPulseTimer??0;s.pulseFrame=m.opticPulseFrame??0;
        effect(io, '00175C00', 0); effect(io, '00185490'); effect(io, '0018C4B0', 5);
        if (s.air) {
          m.vx = f(m.vx / 16); m.vy = f(m.vy / 8); m.ay = f(m.ay / 64); m.ax = 0;
          s.timer = 10; s.control.direction = 12; attack(io, 52); select(io, 3);
        } else {
          effect(io, '001861B0'); effect(io, '00183D10'); airFlag(io, false);
          attack(io, 49 + n); select(io, n * 2); s.control.direction = n ? 14 : 12; s.timer = n ? 10 : 12;
        }
        s.phase = 1;
      } else if (s.phase === 1) {
        io.advance(); if (signed(io.get(1)) !== 0) {
          s.phase = 2; s.control.target = 32; s.control.quota = 13;
          io.spawn({ kind: 'opticBeam', callback: '00352710', group: 21, variant: 8, attackId: s.air ? 52 : 49 + n,
            control: s.control, ownerVariant: s.air ? 3 : n * 2, face }); s.control.active = 255;
        }
      } else if (s.phase === 2) {
        s.control.active = 255;
        // 00212630 calls 00212DE0 here, before animation advance.
        s.pulseTimer=signed(s.pulseTimer-1);
        if(s.pulseTimer<0) {s.pulseTimer=1;s.pulseFrame^=1;effect(io,'00176160',0,80+s.pulseFrame,1);}
        m.opticPulseTimer=s.pulseTimer;m.opticPulseFrame=s.pulseFrame;
        io.advance();
        if (--s.timer <= 0) { s.phase = 3; s.control.target = 0; s.timer = 8; }
      } else if (s.phase === 3) {
        s.control.active = 255; io.advance();
        if (--s.timer < 0) { s.phase = 4; s.control.active = 0; effect(io, '00175C00', 0); select(io, s.air ? 7 : n ? 6 : 4); }
      } else if (io.advance().jumped) { effect(io, '001E3240', 31); effect(io, '001E3240', 32); finish(s, io, s.air ? 'air' : 'ground'); }
      // Native outer wrapper uses 001820A0 once/frame for the airborne case.
      if (s.air && !s.done) { if (io.airMotion) io.airMotion(); else effect(io, '001820A0'); if (m.y < m.ground) m.y = m.ground; }
      break;
    case 'geneSplice':
      if (s.phase === 0) {
        effect(io, '00175C00', 0); face = setup(io, 10); s.timer = (n << 1) + 1;
        m.vx = f(m.vx + face * (n ? 20 : 6.666666507720947)); m.vy = f(n ? 19.28571319580078 : 15); m.ay = f(-1.2053570747375488);
        if (face < 0) m.ax = m.ax < 0 ? f(-0.8333333134651184) : f(m.ax + 0.8333333134651184);
        else m.ax = m.ax < 0 ? f(m.ax - 0.8333333134651184) : f(-0.8333333134651184);
        attack(io, 48); select(io, 2, 20); s.phase = 1; io.clearPunch?.();
      } else if (s.phase === 1) {
        io.advance(); if (signed(io.get(1)) !== 15) { airFlag(io, true); integrate(m); brake(m); }
        if (io.get(1) === 1) { io.consume(1); attack(io, 48); }
        if (io.get(1) === 2) {
          io.consume(1); if (s.timer !== 0 && io.consumePunch?.()) {
            m.vy = f(m.vy + f(17.14285659790039)); --s.timer; attack(io, 48); select(io, s.timer & 1 ? 6 : 5, 20); return;
          }
        }
        if (io.get(1) === 3) {
          io.consume(1);
          io.spawn({kind:'cyclopsGeneBeam',callback:'003521D0',nativeMode:2,group:20,variant:1,attackId:66,
            x:m.x,y:f(m.y+f(171.42855834960938)),vx:0,vy:f(17.14285659790039),ax:0,ay:0,
            timer:120,marginX:16,marginY:48,rotation:32768,attackFlags:66,paletteWait:1,paletteIndex:1,face});
          s.phase = 2;
        }
      } else if (s.phase === 2) {
        io.advance(); integrate(m); brake(m);
        if (m.vy <= 0) { s.phase = 3; m.ay = f(-0.8035714030265808); m.vx = m.ax = 0; select(io, 3, 20); }
      } else if (s.phase === 3) {
        io.advance(); integrate(m); brake(m);
        // 001864A0 has opponent/action dependent early landing; adapter owns those fields.
        if (!io.landCheck) throw new TypeError('Gene Splice requires native 001864A0 landCheck adapter');
        if (io.landCheck('001864A0')) { s.phase = 4; land(io); stop(m); select(io, 4, 20); }
      } else if (io.advance().jumped) finish(s, io);
      break;
    case 'cycloneKick':
      if (s.phase === 0) {
        airFlag(io, true); effect(io, '00175C00', 0); face = setup(io, 5);
        m.vy = f(8.571428298950195); m.ay = f(-1.2053570747375488); m.vx = f(face * 7.5); m.ax = 0;
        attack(io, 63); select(io, 45); s.phase = 1;
      } else if (s.phase === 1) {
        integrate(m); if (m.y > m.ground) io.advance(); else { s.phase = 2; m.y = m.ground; airFlag(io, false); attack(io, 64); select(io, 46); }
      } else if (io.advance().jumped) { stop(m); finish(s, io); }
      break;
    default: throw new RangeError('Unsupported callback');
  }
}

// 00352FA0: coordinates already scaled to native world pixels, not sprite texels.
export function opticOrigin(motion, ownerVariant) {
  const pairs = [[96.66666412353516,132.8571319580078],[123.33332824707031,216.42855834960938],
    [80,274.28570556640625],[126.66666412353516,231.42855834960938]];
  const [x,y] = pairs[ownerVariant < 3 ? ownerVariant : 3];
  return { x: f(motion.x + (motion.face < 0 ? -x : x)), y: f(motion.y + y) };
}
// 00353430 / 003532F0. The renderer selects group21/variant8 at frameIndex.
export function opticFrame(direction, width, { child = false, terminal = false } = {}) {
  if (!Number.isInteger(direction) || direction < 0 || direction > 15 || ![0,16,32,48,64].includes(width)) throw new RangeError('Unsupported native optic selector');
  if (child && terminal && width === 64) return OPTIC_TABLES.terminalFrames[direction];
  return OPTIC_TABLES[child ? 'childFrames' : 'rootFrames'][width + direction * (width === 64 ? 2 : 1)];
}
export function opticChildPosition(previous, direction, width, { kind = 1, terminal = false, face = 1 } = {}) {
  opticFrame(direction, width);
  let x, y;
  if (terminal) { x = OPTIC_TABLES.edgePairs[direction * 2]; y = OPTIC_TABLES.edgePairs[direction * 2 + 1]; }
  else {
    const row = OPTIC_TABLES[kind === 1 ? 'primaryGeometry' : 'secondaryGeometry'][direction], i = width >> 3;
    x = row[i]; y = row[i + 1]; if (direction < 8) x = -x;
  }
  x = f(f(1.6666666269302368) * x); y = f(f(2.142857074737549) * y);
  if (face > 0) x = -x;
  return { x: f(previous.x + f(f(0.9800000190734863) * x)), y: f(previous.y - f(f(0.9800000190734863) * y)) };
}
// Non-hyper root scheduler, 00352740/00352990. The host owns native pool links,
// per-node collision, reflected ground placement and projected screen bounds.
export function createOpticRoot(spec) {
  if (spec.kind !== 'opticBeam') throw new TypeError('Expected native optic beam spawn');
  return { ...spec, current: 0, wait: 4, phase: 0, remaining: 2, cooldown: 0, timer: 0, reload: 0,
    quota: spec.control.quota, collisionTimer: 0, paletteWait: 1, paletteIndex: 1, paletteVariant: null, alive: true };
}
export function stepOpticRoot(root, io) {
  if (!root.control.active) { root.alive = false; return; }
  if (io.hitstop) return;
  if (root.current !== root.control.target) {
    root.wait = signed(root.wait - 1);
    if (root.wait < 0) { root.wait = 1; root.current += root.current < root.control.target ? 16 : -16; }
  }
  if (root.cooldown) --root.cooldown;
  root.phase ^= 2;
  if (--root.paletteWait <= 0) {
    const cycle = [[2,16],[2,17],[1,18],[1,19],[1,20]];
    [root.paletteWait, root.paletteVariant] = cycle[root.paletteIndex];
    io.palette?.(2, root.paletteVariant); root.paletteIndex = (root.paletteIndex + 1) % 5;
  }
  root.timer = signed(root.timer - 1);
  if (root.timer <= 0) {
    if (root.timer < 0) root.timer = root.reload;
    if (root.timer === 0) {
      if (root.quota) --root.quota;
      const success = io.spawnNode({ kind: 1, terminal: false, collisionEnabled: false });
      if (success && --root.remaining < 0) { root.remaining = 2; success.collisionEnabled = true; }
    }
  }
  if (--root.collisionTimer < 0) { root.collisionTimer = 10; io.resetRootAttack?.(root.attackId); }
  Object.assign(root, opticOrigin(io.motion, root.ownerVariant));
  root.direction = root.control.direction; root.frameIndex = opticFrame(root.direction, root.current);
}

// Raw constant banks from the matching ELF; geometry rows expose all 16 s16 words.
export const OPTIC_TABLES = freeze({"rootFrames":[98,87,76,65,54,43,32,21,10,21,32,43,54,65,76,87,96,85,74,63,52,41,30,19,8,19,30,41,52,63,74,85,94,83,72,61,50,39,28,17,6,17,28,39,50,61,72,83,92,81,70,59,48,37,26,15,4,15,26,37,48,59,70,81,88,89,77,78,66,67,55,56,44,45,33,34,22,23,11,12,0,1,11,12,22,23,33,34,44,45,55,56,66,67,77,78],"childFrames":[98,87,76,65,54,43,32,21,10,21,32,43,54,65,76,87,97,86,75,64,53,42,31,20,9,20,31,42,53,64,75,86,95,84,73,62,51,40,29,18,7,18,29,40,51,62,73,84,93,82,71,60,49,38,27,16,5,16,27,38,49,60,71,82,90,91,79,80,68,69,57,58,46,47,35,36,24,25,13,14,2,3,13,14,24,25,35,36,46,47,57,58,68,69,79,80],"terminalFrames":[103,102,101,100,99,104,105,106,107,106,105,104,99,100,101,102],"reflection":[0,1,2,3,4,3,2,1,0,15,14,13,12,13,14,15],"edgePairs":[0,-12,6,-11,12,-8,15,-5,16,0,14,5,11,7,6,11,0,12,-6,11,-11,7,-14,5,-16,0,-15,-5,-12,-8,-6,-11],"primaryGeometry":[[0,-27,0,-29,0,-29,0,-29,0,-26,0,0,0,0,0,0],[-10,-21,-12,-23,-11,-23,-13,-23,-13,-24,0,0,0,0,0,0],[-21,-16,-22,-18,-22,-18,-22,-19,-32,-24,0,0,0,0,0,0],[-18,-6,-31,-10,-31,-10,-31,-10,-32,-10,0,0,0,0,0,0],[-32,0,-32,0,-32,0,-32,0,-32,0,0,0,0,0,0,0],[-20,7,-31,10,-34,19,-34,19,-34,19,0,0,0,0,0,0],[-30,10,-25,19,-23,19,-23,19,-22,19,0,0,0,0,0,0],[-11,23,-12,23,-11,23,-13,23,-13,24,0,0,0,0,0,0],[0,29,0,29,0,29,0,29,0,29,0,0,0,0,0,0],[-11,23,-12,23,-11,23,-13,23,-13,24,0,0,0,0,0,0],[-30,10,-25,19,-23,19,-23,19,-22,19,0,0,0,0,0,0],[-20,7,-31,10,-34,19,-34,19,-34,19,0,0,0,0,0,0],[-32,0,-32,0,-32,0,-32,0,-32,0,0,0,0,0,0,0],[-18,-6,-31,-10,-31,-10,-31,-10,-32,-10,0,0,0,0,0,0],[-21,-16,-22,-18,-22,-18,-22,-19,-32,-24,0,0,0,0,0,0],[-10,-21,-12,-23,-11,-23,-13,-23,-13,-24,0,0,0,0,0,0]],"secondaryGeometry":[[0,-26,0,-26,0,-26,0,-26,0,-26,0,0,0,0,0,0],[-10,-21,-11,-21,-11,-21,-11,-21,-11,-21,0,0,0,0,0,0],[-35,-26,-21,-16,-21,-17,-21,-17,-21,-17,0,0,0,0,0,0],[-30,-10,-29,-10,-29,-10,-29,-10,-29,-10,0,0,0,0,0,0],[-32,0,-32,0,-32,0,-32,0,-32,0,0,0,0,0,0,0],[-27,9,-28,9,-28,9,-27,9,-27,9,0,0,0,0,0,0],[-23,17,-22,17,-22,18,-22,18,-22,18,0,0,0,0,0,0],[-11,23,-11,22,-10,21,-12,22,-11,22,0,0,0,0,0,0],[0,26,0,26,0,26,0,26,0,26,0,0,0,0,0,0],[-11,23,-11,22,-10,21,-12,22,-11,22,0,0,0,0,0,0],[-23,17,-22,17,-22,18,-22,18,-22,18,0,0,0,0,0,0],[-27,9,-28,9,-28,9,-27,9,-27,9,0,0,0,0,0,0],[-32,0,-32,0,-32,0,-32,0,-32,0,0,0,0,0,0,0],[-30,-10,-29,-10,-29,-10,-29,-10,-29,-10,0,0,0,0,0,0],[-35,-26,-21,-16,-21,-17,-21,-17,-21,-17,0,0,0,0,0,0],[-10,-21,-11,-21,-11,-21,-11,-21,-11,-21,0,0,0,0,0,0]],"airMotionDescriptors":{"0x44f290":[3,8192,3,0,4096,5120,1024,96],"0x44f2a0":[3,8192,4,0,4096,6144,2048,768]}});
