// Selected native HIT_DT reaction0/1/2 entry and update callbacks.
// State routing/evidence and unsupported common-engine branches:
// analysis/REACTION_RECOVERY.md (selected callback port appendix).
import {integrate,launchVector,pushProfile,applyPush} from './physics.mjs';
const f=Math.fround,signed=value=>(value<<24)>>24;
const effect=(io,address,...args)=>io.effect?.(address,args);
export const SUPPORTED_REACTION_TYPES=Object.freeze([0,1,2,4,6,10,12]);
const select=(io,variant)=>io.select(13,variant);
function groundVariant(player,row) {
  // 0018E6C0. Row80 is the back-facing pose-bank flag, independent of tier.
  let base=player.crouch?6:3;
  if(!player.crouch&&!(row[3]&0x80)&&(row[3]&0x70))base=0;
  const category=row[3]&0x70;
  return base+(category?(category===0x30?2:category===0x20?1:0):(row[9]>=12?2:row[9]>=5?1:0));
}
function airVariant(row) {const category=row[3]&0x70;return category===0x10?10:category===0x20?11:12;}
function directionalPose(direction,falling=false) {
  let n=direction;if(n>16)n=(32-signed(n))&31;
  return Math.trunc((n+2)/4)+(falling?21:16);
}
/**
 * Pure setup descriptor. Call initializeReaction once after applying damage,
 * then updateReaction once per unfrozen actor update. `attacker` is the actual
 * contacting actor, including projectile motion, not just its owning fighter.
 */
export function createReaction(player,row,attacker,resources,{attackFlags=attacker.attack?.flags??0,attackerState5=attacker.ownerIndex===undefined?2:0}={}) {
  let type=row[1]&31;
  if(!SUPPORTED_REACTION_TYPES.includes(type))throw new RangeError(`Unported original reaction type ${type}`);
  if(type===12){
    //18DCF0: no remaining teammates disables the roster transition. The
    // one-fighter cabinet explicitly models its two absent teammates here.
    if(player.defeatedTeamCount>=2)type=2;
    else throw new RangeError('Reaction12 requires the unported native team-swap controller');
  }
  const wasAir=player.airborne||player.y>(player.ground??0);
  if(type===0&&wasAir)type=1; // 4490C0 airborne row routes0 to18DB70.
  if(type===4&&wasAir)type=2; // airborne table routes4 to18DC10.
  let direction=row[8],strength=row[9],noGroundRecovery=Boolean(player.noGroundRecovery);
  // 18F270 is a bounded OTG/air-combo escalation, not universal type1 knockdown.
  const escalates=type===1&&wasAir&&(row[18]&0x80)&&(attacker.otgFlags&1)&&attacker.airborne&&attacker.superJump&&(attacker.airComboCount>=2);
  if(escalates){type=2;strength=12;direction=Math.min(direction,27);noGroundRecovery=true;}
  if(type===2&&(row[1]&0x20))noGroundRecovery=!attacker.noGroundRecovery;
  if(!(row[18]&4)){
    const index=((player.facingIndex??0)-(attacker.facingIndex??0)+7)&15;
    strength=Math.max(0,Math.min(15,signed(strength)+resources.system.facingKnockbackAdjust[index]));
  }
  const vector=launchVector(direction,strength,resources.system);
  let vx=vector.vx,vy=vector.vy;
  const sourceFace=attacker.face<0?-1:1;
  if(attackFlags&0x10)vx=f(player.face*Math.abs(vx)); //18ED90, same-facing launch
  else if(attackFlags&0x1000){if((player.x<attacker.x&&vx<0)||(player.x>attacker.x&&vx>0))vx=-vx;}
  else {
    // 1BA is copied from the attacker's native1E6 (0 left /1 right).
    if(attackFlags&0x20){if(player.face<0)vx=-vx;}
    else if(sourceFace>0)vx=-vx;
    // 18ED20 (row40 or player stage5>=2) does not inherit source velocity.
    if(!(row[1]&0x40)&&attackerState5<2){
      if(vx!==0){
        if((vx<0&&attacker.vx<1.6666666269302368)||(vx>0&&attacker.vx>-1.6666666269302368))vx=f(vx+attacker.vx);
        vx=Math.max(-31.66666603088379,Math.min(31.66666603088379,vx));
      }
      vy=f(vy+f(attacker.vy/(attacker.superJump?2:1)));
    }
  }
  return {type,row:[...row],wasAir,direction,strength,launchX:f(vx),launchY:f(vy),phase:'entry',
    knockdown:type===2||type===10,noGroundRecovery,windup:wasAir?10:2,fallPose:false,
    timer:signed(row[6])||16,groundPose:groundVariant(player,row),airPose:airVariant(row),
    groundRollWindow:120,downTimer:signed(row[7]),done:false,resources,attacker};
}
export function initializeReaction(s,io) {
  const m=io.motion;
  effect(io,'0018E810'); // hit escalation/effects are a separate shared callback.
  if(s.type===6){
    select(io,s.wasAir?s.airPose:s.groundPose);s.timer=60;s.phase='capture';
    if(m.health<=0)fallbackLaunch(s,io);
  }else if(s.type===10){
    select(io,28);s.phase='type10Entry';
  }else if(s.type===4){
    //18DF40: VX is zero; 41092492 is vertical8.5714283, not horizontal.
    m.vx=m.ax=0;m.vy=f(8.571428298950195);m.ay=f(-1.0714285373687744);
    io.airborne?.(true);select(io,9);s.phase='type4';
  }else if(s.type===0){
    m.vx=0;m.pushQueue=pushProfile(s.row,s.resources.system);select(io,s.groundPose);s.phase='groundEntry';
  }else{
    select(io,s.wasAir?s.airPose:s.groundPose);io.airborne?.(true);s.phase='launchEntry';
    m.noGroundRecovery=s.noGroundRecovery;
  }
}
function finish(s,io,mode) {s.done=true;io.finish(mode);}
function fallbackLaunch(s,io) {
  //18F4C0 ->18F630(direction30,strength5), then ordinary forced-air type2.
  const vector=launchVector(30,5,s.resources.system);
  s.type=2;s.knockdown=true;s.direction=30;s.strength=5;
  s.launchX=f((s.attacker.face>0?-1:1)*vector.vx);s.launchY=vector.vy;
  s.windup=10;s.fallPose=false;s.phase='launchEntry';select(io,10);io.airborne?.(true);
}
function recover(s,io) {
  s.phase='airRecovery';io.motion.superJump=1;io.airborne?.(true);select(io,30);
  effect(io,'00191210');
}
function landing(s,io) {
  const m=io.motion;
  const landed=io.landCheck?io.landCheck('001864A0'):m.y<=(m.ground??0);
  if(!landed)return false;
  m.y=m.ground??0;effect(io,'001E3B30');effect(io,'00158C70');
  return true;
}
/** Same motion/animation IO as normals. No animation is stretched to a timer. */
export function updateReaction(s,io) {
  if(s.done)return;
  const m=io.motion;
  if(s.phase==='capture'){
    //18DFE0/176FA0 normalizes6 to native reaction5. It holds position, not
    // an authored knockback. Source interruption/death invokes18F4C0.
    if(s.attacker.state==='hurt'||s.attacker.state==='knockdown'){fallbackLaunch(s,io);return;}
    io.advance();
    if(--s.timer<=0){if(m.health<=0)fallbackLaunch(s,io);else finish(s,io,s.wasAir?'air':'ground');}
    return;
  }
  if(s.phase==='type10Entry'){
    //1775A0 retains the18EA00 gravity; unlike176A70 it does not replace it.
    m.vx=s.launchX;m.vy=s.launchY;m.ax=0;m.ay=f(-0.8035714030265808);
    s.phase='type10';s.fallPose=false;
  }
  if(s.phase==='type10'){
    integrate(m);m.vy=Math.max(f(-68.57142639160156),Math.min(f(68.57142639160156),m.vy));
    io.advance();
    if(!s.fallPose&&m.vy<=0){s.fallPose=true;select(io,29);}
    if(m.vy<=0&&landing(s,io)){s.phase='landed';io.airborne?.(false);select(io,26);}
    return;
  }
  if(s.phase==='type4'){
    //176E70 integrates only Y, then advances the original13:9 stream.
    m.y=f(m.y+m.vy);m.vy=f(m.vy+m.ay);
    if(m.ay!==0){if(landing(s,io)){m.vy=m.ay=0;io.airborne?.(false);}}
    else if(m.health>0&&s.groundRollWindow&&io.consumeGroundRecovery?.()){
      s.phase='groundRoll';m.vx=m.vy=m.ax=m.ay=0;selectRoll(io,2);return;
    }
    if(io.advance().jumped){s.phase='getup';m.vx=m.vy=m.ax=m.ay=0;select(io,31);}
    return;
  }
  if(s.phase==='groundEntry'){m.vy=m.ay=0;s.phase='ground';return;}
  if(s.phase==='ground'){
    applyPush(m,s.resources.system);if(io.advance().jumped)finish(s,io,'ground');return;
  }
  if(s.phase==='launchEntry'){
    m.vx=s.launchX;m.vy=s.launchY;m.ax=0;m.ay=f(-1.4732142686843872);s.phase='flight';
    //176A70 calls176AB0 in this same update.
  }
  if(s.phase==='flight'){
    //183050 permits the native small horizontal control only for knockdown.
    const held=io.inputSet??m.inputSet;
    if(s.knockdown&&m.health>0&&held&&(held.has('left')||held.has('right'))){
      const forward=held.has(m.face>0?'right':'left');
      m.vx=f(m.vx+f((forward?m.face:-m.face)*f(0.0520833320915699)));
    }
    integrate(m);m.vy=Math.max(f(-68.57142639160156),Math.min(f(68.57142639160156),m.vy));
    io.advance();
    if(!s.knockdown&&m.health>0){
      s.timer=signed(s.timer-1);
      if(s.timer<0){s.timer=0;if(m.vy<f(-12.857142448425293)){recover(s,io);return;}}
    }
    if(s.windup>0&&--s.windup===0)select(io,directionalPose(s.direction));
    if(!s.fallPose&&m.vy<0&&s.windup===0){s.fallPose=true;select(io,directionalPose(s.direction,true));}
    if(m.vy<0&&landing(s,io)){
      if(m.health>0&&!s.knockdown){m.vy=f(-m.vy/2);recover(s,io);}
      else {s.phase='landed';io.airborne?.(false);select(io,26);}
    }
    return;
  }
  if(s.phase==='landed'){
    //176CF0: native ground-roll acceptance can replace the get-up path.
    if(!s.noGroundRecovery&&m.health>0&&s.groundRollWindow&&io.consumeGroundRecovery?.()){
      s.phase='groundRoll';m.vx=m.vy=m.ax=m.ay=0;selectRoll(io,2);return;
    }
    if(io.advance().jumped){
      //187780 enters state23: zero motion, group13:31, native down timer row7.
      s.phase='getup';m.vx=m.vy=m.ax=m.ay=0;select(io,31);effect(io,'00191210');
    }
    return;
  }
  if(s.phase==='getup'){
    //17B060 advances the original get-up stream before ordinary air/ground exit.
    integrate(m);m.vy=Math.max(f(-68.57142639160156),Math.min(f(68.57142639160156),m.vy));
    if(io.advance().jumped)finish(s,io,m.y>(m.ground??0)?'air':'ground');
    else if(io.tryRecoverAction?.())s.done=true;
    return;
  }
  if(s.phase==='airRecovery'){
    //187450/17B060's group13:30 recovery pose retains18F320 motion.
    integrate(m);m.vy=Math.max(f(-68.57142639160156),Math.min(f(68.57142639160156),m.vy));
    if(io.advance().jumped){finish(s,io,'air');return;}
    if(io.tryRecoverAction?.()){s.done=true;return;}
    if(landing(s,io)){
      m.vx=m.vy=m.ax=m.ay=0;io.airborne?.(false);s.phase='ordinaryLand';
      io.select(1,m.jumpDirection===0?4:m.jumpDirection===1?5:3);
    }
    return;
  }
  if(s.phase==='ordinaryLand'){if(io.advance().jumped)finish(s,io,'ground');return;}
  if(s.phase==='groundRoll'){
    if(io.advance().jumped)finish(s,io,'ground');
  }
}
function selectRoll(io,variant) {io.select(17,variant);}
