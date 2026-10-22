// Selected normal update callbacks, not replacement animation timings.
// See analysis/NORMAL_UPDATE_REVIEW.md for native entry, landing and adapter gaps.
const f = Math.fround;
const integrate = m => { m.x=f(m.x+m.vx);m.vx=f(m.vx+m.ax);m.y=f(m.y+m.vy);m.vy=f(m.vy+m.ay); };
const brake = m => { if(m.ax && f(m.ax*m.vx)>0)m.ax=m.vx=0; }; // 001863F0
const effect = (io,address,...args) => io.effect?.(address,args);
export {integrate as integrateNormalMotion,brake as brakeNormalMotion};
export function startGroundNormal(motion,system) {
  // 001861B0 selected-character ELF tables: 447280/447370/447460=1024,
  // 448780=-160 for both PL00/PL06. Nonselected characters are unsupported.
  if(!['ryu','cyclops'].includes(motion.name))throw new RangeError('Unrecovered ground normal motion');
  const limit=f(f(system.scaleX*1024)/256),deceleration=f(f(system.scaleX*-160)/256);
  if(motion.face*motion.vx>0 && Math.abs(motion.vx)<=limit)motion.vx=0;
  motion.vy=motion.ay=0;
  if(motion.vx<0 && motion.ax < -deceleration)motion.ax=-deceleration;
  else if(motion.vx>0 && motion.ax > deceleration)motion.ax=deceleration;
}
export function recoverAirNormal(motion,jumpDirection=-1) {
  // 00184650. Native direction1E7 is -1 neutral,0 forward,1 back.
  motion.ay=f(-0.8035714030265808);motion.airborne=true;
  return {group:1,variant:jumpDirection<0?9:jumpDirection===1?11:10,jumpDirection:-1};
}
export function landNormalMotion(motion,jumpDirection=-1) {
  // 001865B0; visual/sound/actor-state side effects belong to the host.
  motion.vx=motion.vy=motion.ax=motion.ay=0;motion.y=motion.ground;motion.airborne=false;
  return {group:1,variant:jumpDirection<0?3:jumpDirection===0?4:5};
}
export function createNormalUpdate(fighter, action, {air=false,crouch=false}={}) {
  return {fighter,action:{...action},air,crouch,contactSlowed:false,phase:0,done:false};
}
function finish(state,io,mode) {state.done=true;io.finish(mode);}
function repeatHK(io) {
  if(io.heldMask&0x20) {io.consumeHK?.();return true;}
  return Boolean((io.consumeHK??io.repeatHK)?.());
}
function spawnCyclopsPunch(state,io) {
  const m=io.motion,face=m.face<0?-1:1;
  io.spawn({kind:'cyclopsNormalBeam',callback:'003521D0',nativeMode:state.crouch?1:0,
    group:20,variant:0,attackId:2,x:f(m.x-face*f(26.66666603088379)),
    y:f(m.y+f(state.crouch?137.14285278320312:188.57142639160156)),
    vx:f(face*f(13.333333015441895)),vy:0,ax:0,ay:0,timer:60,marginX:48,marginY:16,
    attackFlags:66,paletteWait:1,paletteIndex:1,expires:'00352540-native-timer-hit-block-projected-bounds'});
  // Compact group27/variant2 visual sibling, not a second damaging projectile.
  effect(io,'0019A3D0',state.crouch?1:0);
}
export function updateNormal(state,io) {
  if(state.done)return;
  const m=io.motion,a=state.action,face=m.face<0?-1:1;
  if(state.air) {
    // 001EA510 / 002118A0 call 00182380 before the air movement wrapper.
    if(!m.airContactSlowed && (io.hitFlags?.()??0)!==0) {
      state.contactSlowed=true;m.airContactSlowed=true;m.vy=f(m.vy*f(.75));
    }
    if(io.airMotion)io.airMotion();else integrate(m); // native 001820A0 belongs to adapter
    io.superJumpFall?.(); // 00182300: switch original super-jump falling acceleration
    const result=io.advance();
    if(result.jumped)finish(state,io,'air');
    else if(state.fighter==='ryu' && a.button?.endsWith('p') && a.strength===1 && io.get(1)!==0) {
      // 001EA5C0: air MP second impact, independent of whether first hit connected.
      io.consume(1);io.setAttack(22);
    }
    // Native SEQ530 tests 001864A0 after advance even when finishing the attack.
    if(io.landCheck?.('001864A0',state.done?4:20)) {state.done=true;io.landNormal?.();}
    return;
  }
  // 001EA040 / 00211570 integrate ALL normals, including residual ground motion.
  integrate(m);brake(m);
  if(state.fighter==='ryu' && a.group===20 && a.variant===1 && a.strength===2) {
    // 001EA280 forward HK has a callback-owned hop, not an ordinary aerial normal.
    if(state.phase===0) {
      io.advance();
      if(io.get(1)!==0) {
        state.phase=1;io.airborne?.(true);m.vx=f(face*f(7.0833330154418945));m.ax=0;
        m.vy=f(8.571428298950195);m.ay=f(-0.753348171710968); // BF40DB6D
      }
    } else if(state.phase===1) {
      io.advance();
      if(m.y<=m.ground) {
        state.phase=2;m.y=m.ground;m.vx=m.vy=m.ax=m.ay=0;io.airborne?.(false);
        effect(io,'00183D50');io.select(20,10);
      }
    } else if(io.advance().jumped) {effect(io,'opponent-field-01FF',5);finish(state,io,'ground');}
    return;
  }
  const result=io.advance();
  if(result.jumped) {finish(state,io,'ground');return;}
  if(state.fighter==='ryu') {
    if(!state.crouch && a.group===20 && a.variant===0 && a.strength===2) {
      // 001EA110: event0 is a per-update flag, deliberately NOT consumed.
      if(io.get(1)!==0) {io.consume(1);io.setAttack(19);}
      if(io.get(0)!==0)m.x=f(m.x+f(face*f(3.3333332538604736)));
    } else if(!state.crouch && a.group===8 && a.variant===1 && a.strength===1 && io.get(1)!==0) {
      io.consume(1);io.setAttack(26); // 001EA280 standing MK second impact
    }
  } else if(state.fighter==='cyclops') {
    if(a.button?.endsWith('p') && a.strength===2 && io.get(1)!==0) {
      io.consume(1);spawnCyclopsPunch(state,io); // 00211640 / 002116C0
    } else if(!state.crouch && a.button?.endsWith('k') && a.strength===2 && io.get(1)!==0 && repeatHK(io)) {
      // 00211740: (held362 | edges366)&20; clear366, restore attack and select followup.
      effect(io,'001855D0');io.setAttack(27);io.select(8,4);effect(io,'001E3710',22);
    }
  }
}
