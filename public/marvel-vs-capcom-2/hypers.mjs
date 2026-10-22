// SLUS_204.86 hyper owner callbacks, not an emulator. Evidence and adapter
// obligations are recorded in analysis/HYPER_RECOVERY.md.
const f = Math.fround;
const signed = value => (value << 24) >> 24;
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const HYPERS = freeze({
  ryu: {
    shinkuHadouken: {state:5, callback:'001EBE60', descriptor:'0044F2B0', bars:1, words:[3,33024,5,0,4096,6144,2048,768]},
    shinkuTatsu: {state:6, callback:'001EC260', descriptor:'0044F2C0', bars:1, words:[3,37120,6,0,4096,5120,1024,96], groundOnly:true},
    shinShoryuken: {state:11, callback:'001EC850', descriptor:'0044F2D0', bars:3, words:[3,37120,11,0,2048,4096,6144,768], groundOnly:true},
  },
  cyclops: {
    megaOpticBlast: {state:1, callback:'002127D0', descriptor:'00450A50', bars:1, words:[3,33024,1,0,4096,6144,2048,96]},
    superOpticBlast: {state:2, callback:'00212EC0', descriptor:'00450A40', bars:1, words:[3,33024,2,0,4096,6144,2048,768]},
  },
});

export function createHyper(fighter, key, strength = 0, {air = false, assistedInput = false} = {}) {
  const profile = HYPERS[fighter]?.[key];
  if (!profile) throw new RangeError(`Unsupported hyper: ${fighter}/${key}`);
  if (strength !== 0 && strength !== 1) throw new RangeError('Native strength must be 0 or 1');
  if (air && profile.groundOnly) throw new RangeError('This hyper has only a grounded callback');
  return {fighter, key, strength, air, assistedInput, profile, phase:0, timer:0,
    quota:0, route:0, done:false, control:{direction:0, target:0, active:0, quota:0}};
}

const effect = (io, address, ...args) => io.effect?.(address, args);
const airborne = (io, value) => io.airborne?.(value);
const select = (io, variant, group = 22) => io.select(group, variant);
const stop = m => { m.vx = m.vy = m.ax = m.ay = 0; };
const integrate = m => {
  m.x = f(m.x + m.vx); m.vx = f(m.vx + m.ax);
  m.y = f(m.y + m.vy); m.vy = f(m.vy + m.ay);
};
function finish(s, io, mode = s.air ? 'air' : 'ground') {
  s.done = true; s.control.active = 0; io.finish(mode);
}
function flash(s, io, offset) {
  // 001830D0 -> 00183210 -> 0018C6B0 consumes whole bars here.
  // The adapter also owns the global superfreeze and opponent lock.
  if (io.superFlash) io.superFlash(s.profile.bars, offset);
  else effect(io, '001830D0', offset, s.profile.bars);
}
function pending(io, preserveFlag = false) {
  const id = io.get(11);
  if (id) { io.consume(11); io.setAttack(id); if (preserveFlag) io.attackFlags?.(0x10); }
}
function setupGround(io) {
  effect(io, '00185490'); effect(io, '00183D10');
  io.motion.y = io.motion.ground; airborne(io, false);
}
function setupCyclops(s, io) {
  effect(io, '00175C00', 0); effect(io, '00185490');
  if (s.air) {
    const m = io.motion;
    m.vx = f(m.vx / 16); m.vy = f(m.vy / 8); m.ay = f(m.ay / 64); m.ax = 0;
  } else { effect(io, '001861B0'); effect(io, '00183D10'); airborne(io, false); }
}
function pulse(s, io) {
  // 00212DE0 toggles effect frame every second update.
  if (--s.pulseTimer < 0) { s.pulseTimer = 1; s.pulseFrame ^= 1; effect(io, '00176160', 0, (io.palette ?? 0) * 2 + 80 + s.pulseFrame, 1); }
}
function mash(s, io, allowZero = false) {
  // 0018AB10 accepts all four attack edges (0x360), not punch only.
  if ((allowZero ? s.quota >= 0 : s.quota > 0) && io.consumeAttack?.()) { --s.quota; ++s.timer; }
}
const DIRECTIONS = [-1,4,12,-1,8,6,10,-1,0,2,14,-1,-1,-1,-1,-1];
function steer(s, io) {
  const held = io.inputSet;
  if (!held) return;
  const horizontal = Number(held.has('right')) - Number(held.has('left'));
  let index = horizontal === io.motion.face ? 2 : horizontal === -io.motion.face ? 1 : 0;
  if (held.has('down')) index |= 4;
  if (held.has('jump') || held.has('up')) index |= 8;
  const target = DIRECTIONS[index], current = s.control.direction;
  if (target >= 0 && target !== current) s.control.direction = (current + (((target-current)&15)<8 ? 1 : -1)) & 15;
}
function megaPose(s, io) { select(io, s.control.direction + (s.air ? 28 : 10), 21); }
function megaAim(io) {
  // 001748C0 / 00417700: atan2 -> rounded 256-angle -> 16 sectors.
  // Optional exact-angle adapter can replace browser libm at boundaries.
  const m = io.motion, target = io.target;
  if (!target) throw new Error('Mega Optic Blast requires the current opponent position');
  const targetAirborne = target.airborne ?? target.y > target.ground;
  const y = targetAirborne ? f(target.y + 56) : f(target.ground + 102);
  const angle = io.nativeAngle ? io.nativeAngle(f(y-f(m.y+102)), f(target.x-m.x))
    : Math.trunc(f(256 * f(Math.atan2(f(y-f(m.y+102)), f(target.x-m.x)))) / (2*Math.PI) + 0.5) & 255;
  let direction = ((320-signed(angle))&255) >> 4;
  if (m.face < 0) direction = (16-direction)&15;
  return direction;
}

/**
 * io follows specials.mjs: select, advance, get, consume, spawn, finish,
 * motion{x,y,vx,vy,ax,ay,ground,face}, setAttack. See recovery note for the
 * meter/superfreeze, target, mash-input, projectile and contact obligations.
 */
export function updateHyper(s, io) {
  if (s.done) return;
  const m = io.motion, face = m.face < 0 ? -1 : 1;
  // Native Cyclops wrappers run 001820A0 before dispatch, including startup.
  if (s.fighter === 'cyclops' && s.air) {
    if (io.airMotion) io.airMotion(); else effect(io, '001820A0');
    if (m.y < m.ground) m.y = m.ground;
  }
  switch (s.key) {
    case 'shinkuHadouken':
      if (s.phase === 0) {
        stop(m); if (!s.air) setupGround(io);
        s.timer = 64; s.quota = s.assistedInput ? 12 : 24;
        io.setAttack(85); select(io, s.air ? 6 : 4); s.phase = 1;
      } else if (s.phase === 1) {
        io.advance(); if (signed(io.get(1))) { io.consume(1); s.phase = 2; flash(s, io, [40,137.14285278320312,0]); }
      } else if (s.phase === 2) {
        io.advance(); if (signed(io.get(1))) {
          io.consume(1); s.phase = 3; effect(io, '00192D60', s.air ? 1 : 0);
          io.spawn({kind:'shinkuHadouken', callback:'00345F40', launch:'00345D90', parameter:0,
            group:25, attackId:86, ownerVariant:s.air?6:4, face,
            offsetX:face*(s.air?173.333328:195), offsetY:s.air?154.285706:113.571426,
            control:s.control, ownerState:s, segmentCount:12, requiresNativeSegments:true});
        }
      } else if (s.phase === 3) {
        io.advance(); mash(s, io, true);
        if (--s.timer <= 0) { s.phase = 4; select(io, s.air ? 7 : 5); }
      } else if (io.advance().jumped) finish(s, io);
      break;
    case 'shinkuTatsu':
      if (s.phase === 0) {
        setupGround(io); io.setAttack(81); io.attackFlags?.(0x10);
        m.vx = m.ax = 0; m.vy = f(8.571428298950195); m.ay = f(-1.0714285373687744);
        select(io, 0); s.phase = 1;
      } else if (s.phase === 1) {
        io.advance(); if (signed(io.get(0))) { io.consume(0); s.phase = 2; flash(s, io, [80,137.14285278320312,0]); }
      } else if (s.phase === 2) {
        io.advance(); if (signed(io.get(1))) { io.consume(1); s.phase = 3; airborne(io, true); }
      } else if (s.phase === 3) {
        const previous = m.vy; integrate(m);
        if (f(previous*m.vy)>0) io.advance();
        else { s.phase = 4; s.timer = 8; effect(io, '00193090'); select(io, 1); }
      } else if (s.phase === 4 || s.phase === 5) {
        const jumped = io.advance().jumped;
        if (jumped) {
          if (s.phase === 4) { if (--s.timer <= 0) { s.phase = 5; select(io, 8); } }
          else { s.phase = 6; select(io, 2); }
        } else { m.y = f(m.y + f(-0.1339285671710968)); pending(io, s.phase === 4); }
      } else if (s.phase === 6) {
        integrate(m);
        if (m.y <= m.ground) { s.phase = 7; m.y = m.ground; airborne(io, false); select(io, 3); }
        else io.advance();
      } else if (io.advance().jumped) finish(s, io, 'ground');
      break;
    case 'shinShoryuken':
      if (s.phase === 0) {
        setupGround(io); stop(m); io.setAttack(89); select(io, 9); s.phase = 1; pending(io);
      } else if (s.phase === 1) {
        io.advance(); pending(io);
        if (signed(io.get(1))) { io.consume(1); s.phase = 2; flash(s, io, [-25,98.57143,0]); }
      } else if (s.phase === 2) {
        if (io.advance().jumped) {
          s.phase = 4; airborne(io, true); m.vx = f(face*3.3333332538604736); m.ax = 0;
          m.vy = f(34.28571319580078); m.ay = f(-1.0714285373687744); s.route = 1; select(io, 13);
        } else {
          const hit = io.hitFlags?.() ?? 0;
          if (hit && !(hit&1) && !io.target?.throwImmune) { s.phase = 3; s.route = 0; select(io, 10); }
        }
        pending(io);
      } else if (s.phase === 3) {
        io.advance();
        if (signed(io.get(1))) {
          io.consume(1); s.phase = 4; airborne(io, true); m.x = f(m.x+face*40);
          m.vx = f(face*1.666666627); m.ax = 0; m.vy = f(42.857139587402344); m.ay = f(-1.0714285373687744);
        }
        pending(io);
      } else if (s.phase === 4) {
        io.advance(); integrate(m);
        if (m.vy < 0) { s.phase = 5; m.vx = m.ax = 0; select(io, s.route ? 14 : 11); }
        pending(io);
      } else if (s.phase === 5) {
        io.advance(); integrate(m);
        if (m.y <= m.ground) {
          s.phase = 6; m.y = m.ground; airborne(io, false); select(io, s.route ? 15 : 12); effect(io, '00183D50');
        }
        pending(io);
      } else if (io.advance().jumped) finish(s, io, 'ground'); else pending(io);
      break;
    case 'megaOpticBlast':
      if (s.phase === 0) {
        setupCyclops(s, io); io.setAttack(54); select(io, s.air ? 27 : 9, 21);
        s.pulseTimer = s.pulseFrame = 0; s.phase = 1;
      } else if (s.phase === 1) {
        if (io.advance().jumped) {
          s.phase = 2; s.timer = 50; s.quota = 48;
          Object.assign(s.control, {active:255, target:64, quota:13, direction:megaAim(io)});
          megaPose(s, io);
          io.spawn({kind:'megaOpticBeam', callback:'00352710', launch:'00352670',
            group:21, variant:8, attackId:54, face, parameter:2, control:s.control, ownerState:s,
            requiresNativeSegments:true});
        } else if (signed(io.get(1))) {
          io.consume(1); flash(s, io, s.air ? [-6.666666507720947,222.8571319580078,0] : [-46.666664123535156,180,0]);
        }
      } else if (s.phase === 2) {
        s.control.active = 255; pulse(s, io);
        if (io.advance().jumped) { steer(s, io); megaPose(s, io); }
        mash(s, io);
        if (--s.timer < 0) { s.phase = 3; s.timer = 8; s.control.target = 0; }
      } else if (s.phase === 3) {
        s.control.active = 255;
        if (--s.timer < 0) { s.phase = 4; s.control.active = 0; select(io, s.air ? 44 : 26, 21); effect(io, '00175C00', 0); }
      } else if (io.advance().jumped) {
        effect(io, '001E3240', 31); effect(io, '001E3240', 32); effect(io, '00175C00', 0); finish(s, io);
      }
      break;
    case 'superOpticBlast':
      if (s.phase === 0) {
        setupCyclops(s, io); io.setAttack(56); select(io, s.air ? 9 : 0);
        s.pulseTimer = s.pulseFrame = 0; s.phase = 1;
      } else if (s.phase === 1) {
        if (io.advance().jumped) {
          s.phase = 2; s.control.target = 0; s.control.active = 0; s.timer = 60; s.quota = 48;
          io.spawn({kind:'superOpticBeam', callback:'00353790', launch:'00353730', parameter:0,
            group:22, variant:2, attackId:56, face, control:s.control, ownerState:s,
            requiresNativeSegments:true}); effect(io, '001E3710', 72);
        } else if (signed(io.get(1))) {
          io.consume(1); flash(s, io, s.air ? [-6.666666507720947,222.8571319580078,0] : [-46.666664123535156,180,0]);
        }
      } else if (s.phase === 2) {
        s.control.active = 255; effect(io, '00174170'); io.advance(); pulse(s, io); mash(s, io);
        if (--s.timer < 0) {
          s.phase = 3; s.control.active = 0; select(io, s.air ? 10 : 1);
          effect(io, '00175C00', 0); effect(io, '001E3240', 31); effect(io, '001E3240', 32); effect(io, '001E2490', 6, 72);
        }
      } else if (io.advance().jumped) finish(s, io);
      break;
    default: throw new RangeError('Unsupported hyper callback');
  }
}
